import type { OpenAjangEvent } from './types.js';
import { validate } from './validator.js';
import { parseStamp } from './parser.js';
import { eventId } from './identity.js';

export interface ICalendarOptions {
  /**
   * Revision SEQUENCE supplied by a stateful exporter. Omitted from the output
   * when not provided; it is never derived from updated_at.
   */
  sequence?: number;
}

const PRODID = '-//OpenAjang//iCalendar export 0.1//EN';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function escapeText(value: string): string {
  return value
    .replace(/\r\n|\r/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Folds a content line to at most 75 octets per physical line without splitting
 * a UTF-8 sequence; continuation lines begin with a single space.
 */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const lines: string[] = [];
  let current = '';
  let size = 0;
  let limit = 75;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (size + n > limit) {
      lines.push(current);
      current = ' ';
      size = 1;
      limit = 75;
    }
    current += ch;
    size += n;
  }
  lines.push(current);
  return lines.join('\r\n');
}

function formatUtc(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

function hasSubsecond(fractional: string): boolean {
  return /[1-9]/.test(fractional);
}

function decline(reason: string): { result: null; diagnostics: string[] } {
  return { result: null, diagnostics: ['Declined: ' + reason] };
}

/**
 * Converts an OpenAjang event to a single-event RFC 5545 iCalendar document plus
 * diagnostics. Declines when exact instants cannot be preserved: date-only starts
 * or ends, postponed events, unknown ends, zero-length events, and instants with
 * sub-second precision.
 */
export function toICalendar(
  event: OpenAjangEvent | Record<string, any>,
  options: ICalendarOptions = {}
): { result: string | null; diagnostics: string[] } {
  const d = validate(event);

  if (options.sequence !== undefined && (!Number.isSafeInteger(options.sequence) || options.sequence < 0)) {
    throw new RangeError('sequence must be a non-negative integer');
  }

  if (DATE_ONLY.test(d.starts_at) || (d.ends_at && DATE_ONLY.test(d.ends_at))) {
    return decline('clock times unpublished; no invented midnight or all-day event');
  }
  if (d.status === 'postponed') {
    return decline('postponed start is not active confirmed attendance');
  }
  if (!d.ends_at) {
    return decline('unknown end cannot be preserved; no zero-duration or invented end');
  }

  const start = parseStamp(d.starts_at);
  const end = parseStamp(d.ends_at);
  if (hasSubsecond(start.fractional) || hasSubsecond(end.fractional)) {
    return decline('iCalendar DATE-TIME has no sub-second precision; start/end not truncated');
  }
  if (end.epochSeconds <= start.epochSeconds) {
    return decline('iCalendar requires DTEND later than DTSTART');
  }

  const diagnostics: string[] = [];
  const updated = parseStamp(d.updated_at);
  if (hasSubsecond(updated.fractional)) {
    diagnostics.push('updated_at sub-second precision truncated in DTSTAMP and LAST-MODIFIED');
  }
  const stamp = formatUtc(updated.epochSeconds);

  const descParts: string[] = [d.description || d.summary || ''];
  const notes: string[] = [];
  let strippedControls = false;
  const text = (value: string): string => {
    if (CONTROL_CHARS.test(value)) strippedControls = true;
    CONTROL_CHARS.lastIndex = 0;
    return escapeText(value.replace(CONTROL_CHARS, ''));
  };

  descParts.push('Organizer: ' + d.organizer.name);
  if (d.status_note) descParts.push(d.status_note);
  if (d.status === 'rescheduled' || d.status === 'completed') {
    descParts.push('OpenAjang status: ' + d.status);
    diagnostics.push(`${d.status} mapped to STATUS:CONFIRMED; original status preserved descriptively`);
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:' + PRODID,
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:' + text(eventId(d)),
    'DTSTAMP:' + stamp,
    'LAST-MODIFIED:' + stamp,
    'DTSTART:' + formatUtc(start.epochSeconds),
    'DTEND:' + formatUtc(end.epochSeconds),
    'SUMMARY:' + text(d.title),
    'STATUS:' + (d.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'),
    'URL:' + d.url
  ];
  if (options.sequence !== undefined) {
    lines.push('SEQUENCE:' + options.sequence);
  } else {
    diagnostics.push('SEQUENCE omitted: no revision counter supplied; updated_at is not a monotonic revision number');
  }

  if (d.location.physical) {
    const p = d.location.physical;
    const addr = p.address ? Object.values(p.address).filter(v => typeof v === 'string' && v) : [];
    const loc = [p.name, ...addr].filter(Boolean).join(', ');
    if (loc) lines.push('LOCATION:' + text(loc));
    if (p.coordinates) {
      lines.push(`GEO:${p.coordinates.latitude};${p.coordinates.longitude}`);
    }
    if (p.instructions) notes.push('Venue instructions: ' + p.instructions);
    if (p.status && p.status !== 'confirmed') {
      notes.push('Venue status: ' + p.status);
      diagnostics.push('Venue certainty preserved descriptively only');
    }
  }

  if (d.location.virtual) {
    const v = d.location.virtual;
    notes.push(`Online (${v.platform || 'attendance information'}): ${v.url}`);
    if (v.instructions) notes.push(v.instructions);
    diagnostics.push('Virtual attendance retained descriptively; the page may not be a direct join URL');
  }
  descParts.push(...notes);

  if (d.registration) {
    const reg = d.registration;
    const active = d.status !== 'cancelled' && d.status !== 'completed';
    const state = reg.status || 'unknown';
    let line = `Registration: ${state}.`;
    if (reg.instructions) line += ' ' + reg.instructions;
    if (reg.url && active && state !== 'closed' && state !== 'not_yet_open') {
      line += ' ' + reg.url;
    }
    descParts.push(line);
    diagnostics.push('Registration retained descriptively; iCalendar has no registration semantics');
  }

  if (d.tickets && d.tickets.length > 0) {
    for (const t of d.tickets) {
      let line = `${t.name}: ${t.description || ''}`.trimEnd();
      line += t.price ? ` Price ${t.price.amount} ${t.price.currency}.` : ' Price not published.';
      line += ` Availability: ${t.availability || 'unknown'}.`;
      descParts.push(line);
    }
    diagnostics.push('Ticket prices/availability/coverage have no native mapping; descriptive text only; seller omitted');
  }

  descParts.push('Source: ' + d.url);
  lines.push('DESCRIPTION:' + text(descParts.filter(Boolean).join('\n\n')));

  if (d.tags && d.tags.length > 0) {
    lines.push('CATEGORIES:' + d.tags.map(text).join(','));
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');

  diagnostics.push('Organizer retained descriptively; no ORGANIZER, ATTENDEE, or METHOD emitted (not an invitation)');
  if (d.time_zone) {
    diagnostics.push('Separate civil time_zone omitted; exact instants exported as UTC');
  }
  for (const k of ['previous_starts_at', 'publisher', 'series', 'extensions', 'image', 'same_as', 'language']) {
    if ((d as any)[k]) diagnostics.push(`${k} not preserved structurally`);
  }
  if (strippedControls) {
    diagnostics.push('Unsupported control characters removed from text values');
  }

  return { result: lines.map(fold).join('\r\n') + '\r\n', diagnostics };
}
