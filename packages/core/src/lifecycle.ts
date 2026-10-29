import type { OpenAjangEvent, ActionDescriptor } from './types.js';
import { validate } from './validator.js';
import { parseStamp } from './parser.js';
import { eventId } from './identity.js';

export function registrationAction(d: OpenAjangEvent | Record<string, any>): ActionDescriptor | null {
  if (d.status === 'cancelled' || d.status === 'postponed' || d.status === 'completed') {
    return null;
  }
  const reg = d.registration;
  if (!reg || !reg.url) {
    return null;
  }
  const st = reg.status || 'unknown';
  if (st === 'closed' || st === 'not_yet_open') {
    return null;
  }
  const label = st === 'open' ? 'Register' : st === 'waitlist' ? 'Join waitlist' : 'View registration';
  return {
    label,
    url: reg.url
  };
}

/**
 * Formats an RFC 3339 timestamp as UTC string, preserving up to 6 fractional digits.
 */
function toUtcString(stamp: string, local = false): string {
  const parsed = parseStamp(stamp);
  if (parsed.fractional && parsed.fractional.length > 7) {
    throw new Error('Adapter declines precision beyond six fractional digits');
  }
  const iso = stamp.replace('Z', '+00:00');
  const d = new Date(iso);
  const baseIso = d.toISOString(); // e.g. 2026-11-14T10:00:00.000Z
  const datePart = baseIso.slice(0, 19);
  const frac = parsed.fractional;
  const result = datePart + frac + (local ? '' : 'Z');
  return result;
}

/**
 * Converts an OpenAjang event to Schema.org Event JSON-LD plus diagnostics.
 */
export function toSchemaOrg(event: OpenAjangEvent | Record<string, any>): {
  result: Record<string, any>;
  diagnostics: string[];
} {
  const d = validate(event);
  const diagnostics: string[] = [];

  const out: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    '@id': eventId(d),
    url: d.url,
    name: d.title,
    startDate: d.starts_at
  };

  if (d.ends_at) out.endDate = d.ends_at;
  if (d.same_as) out.sameAs = [...d.same_as];
  if (d.previous_starts_at) out.previousStartDate = [...d.previous_starts_at];

  if (d.description || d.summary) {
    out.description = d.description || d.summary;
  }

  const statuses: Record<string, string> = {
    scheduled: 'EventScheduled',
    postponed: 'EventPostponed',
    rescheduled: 'EventRescheduled',
    cancelled: 'EventCancelled'
  };

  if (statuses[d.status]) {
    out.eventStatus = 'https://schema.org/' + statuses[d.status];
  } else {
    diagnostics.push('completed has no exact Schema.org eventStatus mapping; omitted');
  }

  const modes: Record<string, string> = {
    physical: 'OfflineEventAttendanceMode',
    virtual: 'OnlineEventAttendanceMode',
    hybrid: 'MixedEventAttendanceMode'
  };
  out.eventAttendanceMode = 'https://schema.org/' + modes[d.location.type];

  const mapParty = (p: Record<string, any>) => {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(p)) {
      if (k === 'id') res['@id'] = v;
      else if (k === 'phone') res['telephone'] = v;
      else if (k === 'name' || k === 'url' || k === 'email') res[k] = v;
    }
    return res;
  };

  out.organizer = mapParty(d.organizer);

  const locations: any[] = [];
  if (d.location.physical) {
    const p = d.location.physical;
    const place: Record<string, any> = { '@type': 'Place' };
    if (p.name) place.name = p.name;
    if (p.url) place.url = p.url;
    if (p.instructions) place.description = p.instructions;
    if (p.id) place['@id'] = p.id;
    if (p.address) {
      const fieldMap: Record<string, string> = {
        street: 'streetAddress',
        locality: 'addressLocality',
        region: 'addressRegion',
        postal_code: 'postalCode',
        country: 'addressCountry'
      };
      const postal: Record<string, any> = { '@type': 'PostalAddress' };
      for (const [k, v] of Object.entries(p.address)) {
        if (fieldMap[k]) postal[fieldMap[k]] = v;
      }
      place.address = postal;
    }
    if (p.coordinates) {
      place.geo = {
        '@type': 'GeoCoordinates',
        latitude: p.coordinates.latitude,
        longitude: p.coordinates.longitude
      };
    }
    if (p.status && p.status !== 'confirmed') {
      diagnostics.push('Physical venue certainty not preserved structurally');
    }
    locations.push(place);
  }

  if (d.location.virtual) {
    const v = d.location.virtual;
    const item: Record<string, any> = {
      '@type': 'VirtualLocation',
      url: v.url
    };
    if (v.instructions) item.description = v.instructions;
    locations.push(item);
  }

  out.location = locations.length === 1 ? locations[0] : locations;

  if (d.image) out.image = d.image.url;
  if (d.tags) out.keywords = d.tags;

  if (d.tickets && d.tickets.length > 0) {
    const availMap: Record<string, string> = {
      available: 'InStock',
      limited: 'LimitedAvailability',
      sold_out: 'SoldOut',
      unavailable: 'OutOfStock'
    };
    out.offers = d.tickets.map(t => {
      const offer: Record<string, any> = {
        '@type': 'Offer',
        identifier: t.id,
        name: t.name
      };
      if (t.description) offer.description = t.description;
      if (t.url) offer.url = t.url;
      if (t.price) {
        offer.price = t.price.amount;
        offer.priceCurrency = t.price.currency;
      }
      if (t.availability && availMap[t.availability]) {
        offer.availability = 'https://schema.org/' + availMap[t.availability];
      }
      if (t.seller) offer.seller = mapParty(t.seller);
      if (t.sales_start) offer.validFrom = t.sales_start;
      if (t.sales_end) offer.validThrough = t.sales_end;
      return offer;
    });
  }

  const regAction = registrationAction(d);
  if (regAction) {
    out.potentialAction = {
      '@type': 'Action',
      identifier: 'registration',
      name: regAction.label,
      target: regAction.url
    };
  }

  if (d.registration) {
    diagnostics.push('Registration required/state are not preserved as native structured fields; action is an adapter convention');
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) {
    diagnostics.push('Date-only range retains unpublished hours; target display semantics may vary');
  }
  if (d.time_zone) {
    diagnostics.push('Separate civil time_zone omitted; encoded dates/offsets retained');
  }
  if (d.status_note) {
    out.description = [out.description, d.status_note].filter(Boolean).join('\n\n');
  }
  for (const k of ['publisher', 'series', 'extensions']) {
    if ((d as any)[k]) {
      diagnostics.push(`${k} omitted from structured mapping`);
    }
  }
  diagnostics.push('Source updated_at has no selected native Event mapping; omitted');
  diagnostics.push('Party kind unspecified; no Person/Organization type inferred');
  if (d.language) {
    diagnostics.push('Document language is not assumed to be spoken event language; omitted');
  }

  return { result: out, diagnostics };
}

/**
 * Converts an OpenAjang event to JSCalendar (RFC 8984) Event plus diagnostics.
 * Declines conversion when hours are unpublished (date-only), event is postponed, or end is missing.
 */
export function toJSCalendar(event: OpenAjangEvent | Record<string, any>): {
  result: Record<string, any> | null;
  diagnostics: string[];
} {
  const d = validate(event);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) {
    return {
      result: null,
      diagnostics: ['Declined: clock times unpublished; no invented midnight or all-day event']
    };
  }
  if (d.status === 'postponed') {
    return {
      result: null,
      diagnostics: ['Declined: postponed start is not active confirmed attendance']
    };
  }
  if (!d.ends_at) {
    return {
      result: null,
      diagnostics: ['Declined: unknown end cannot be preserved by JSCalendar default zero duration']
    };
  }

  let startUtc: string;
  let updatedUtc: string;
  try {
    startUtc = toUtcString(d.starts_at, true);
    updatedUtc = toUtcString(d.updated_at);
    toUtcString(d.ends_at);
  } catch (e: any) {
    return {
      result: null,
      diagnostics: ['Declined: ' + e.message]
    };
  }

  const pStart = parseStamp(d.starts_at);
  const pEnd = parseStamp(d.ends_at);

  const secDiff = pEnd.epochSeconds - pStart.epochSeconds;
  const fa = pStart.fractional ? pStart.fractional.slice(1) : '';
  const fb = pEnd.fractional ? pEnd.fractional.slice(1) : '';
  let durationStr = '';
  if (!fa && !fb) {
    durationStr = `PT${secDiff}S`;
  } else {
    const maxLen = Math.max(fa.length, fb.length);
    const faVal = BigInt(fa.padEnd(maxLen, '0'));
    const fbVal = BigInt(fb.padEnd(maxLen, '0'));
    const scale = 10n ** BigInt(maxLen);
    const totalDiff = BigInt(secDiff) * scale + (fbVal - faVal);
    const whole = totalDiff / scale;
    let rem = (totalDiff % scale).toString();
    if (rem.startsWith('-')) rem = rem.slice(1);
    rem = rem.padStart(maxLen, '0').replace(/0+$/, '');
    durationStr = rem.length > 0 ? `PT${whole}.${rem}S` : `PT${whole}S`;
  }

  const out: Record<string, any> = {
    '@type': 'Event',
    uid: eventId(d),
    title: d.title,
    start: startUtc,
    timeZone: 'Etc/UTC',
    updated: updatedUtc,
    status: d.status === 'cancelled' ? 'cancelled' : 'confirmed',
    duration: durationStr
  };

  const diagnostics: string[] = [];

  const descParts: string[] = [
    d.description || d.summary || '',
    'Organizer: ' + d.organizer.name,
    'Source: ' + d.url
  ];
  if (d.status_note) descParts.push(d.status_note);
  if (d.status === 'rescheduled' || d.status === 'completed') {
    descParts.push('OpenAjang status: ' + d.status);
    diagnostics.push('Lifecycle mapped to confirmed; original status preserved descriptively');
  }

  const links: Record<string, any> = {
    event: {
      '@type': 'Link',
      href: d.url,
      title: 'Event page'
    }
  };

  if (d.organizer.url) {
    links.organizer = {
      '@type': 'Link',
      href: d.organizer.url,
      title: d.organizer.name
    };
  }

  if (d.location.physical) {
    const p = d.location.physical;
    const loc: Record<string, any> = { '@type': 'Location' };
    if (p.name) loc.name = p.name;
    const parts: string[] = [];
    if (p.instructions) parts.push(p.instructions);
    if (p.address) {
      parts.push(Object.values(p.address).filter(Boolean).join(' '));
    }
    if (p.status && p.status !== 'confirmed') {
      parts.push('Venue status: ' + p.status);
      diagnostics.push('Venue certainty preserved descriptively only');
    }
    if (parts.length > 0) {
      loc.description = parts.join('\n');
    }
    if (p.coordinates) {
      loc.coordinates = `geo:${p.coordinates.latitude},${p.coordinates.longitude}`;
    }
    out.locations = { venue: loc };
  }

  if (d.location.virtual) {
    const v = d.location.virtual;
    out.virtualLocations = {
      online: {
        '@type': 'VirtualLocation',
        uri: v.url,
        name: v.platform || 'Online attendance',
        description: 'Public attendance/access-information page. ' + (v.instructions || '')
      }
    };
  }

  if (d.registration) {
    const reg = d.registration;
    descParts.push(`Registration: ${reg.status || 'unknown'}. ${reg.instructions || ''}`);
    const active = d.status !== 'cancelled' && (d.status as string) !== 'postponed' && d.status !== 'completed';
    const regStatus = reg.status || 'unknown';
    if (reg.url && active && regStatus !== 'closed' && regStatus !== 'not_yet_open') {
      const title = regStatus === 'open' ? 'Register' : regStatus === 'waitlist' ? 'Join waitlist' : 'View registration';
      links.registration = {
        '@type': 'Link',
        href: reg.url,
        title
      };
    }
    diagnostics.push('Registration semantics retained descriptively; link key is an adapter convention');
  }

  if (d.tickets) {
    const active = d.status !== 'cancelled' && (d.status as string) !== 'postponed' && d.status !== 'completed';
    d.tickets.forEach((t, i) => {
      let tDesc = t.name + ': ' + (t.description || '');
      if (t.price) {
        tDesc += ` Price ${t.price.amount} ${t.price.currency}`;
      } else {
        tDesc += ' Price not published.';
      }
      tDesc += ` Availability: ${t.availability || 'unknown'}`;
      descParts.push(tDesc);

      const avail = t.availability || 'unknown';
      if (t.url && active && avail !== 'sold_out' && avail !== 'unavailable') {
        links['ticket' + i] = {
          '@type': 'Link',
          href: t.url,
          title: t.name
        };
      }
    });
    diagnostics.push('Ticket prices/availability/coverage have no native mapping here; descriptive text and links only; seller omitted');
  }

  out.links = links;
  out.description = descParts.filter(Boolean).join('\n\n');
  diagnostics.push('Organizer retained descriptively; no calendar ownership or invitation role inferred');

  for (const k of ['time_zone', 'previous_starts_at', 'publisher', 'series', 'extensions', 'image', 'tags', 'same_as', 'language']) {
    if ((d as any)[k]) {
      diagnostics.push(`${k} not preserved structurally`);
    }
  }

  return { result: out, diagnostics };
}
