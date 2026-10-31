import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Test public API
import {
  validate,
  validateSafe,
  parseJsonStrict,
  eventId,
  SCHEMA_ID,
  EVENT_SCHEMA,
  OpenAjangValidationError
} from '../dist/index.js';

import { registrationAction, toSchemaOrg, toJSCalendar, toICalendar } from '../dist/adapters.js';
import ICAL from 'ical.js';

// Internal helpers for deep unit tests
import { parseStamp, compareStamps, isValidUrl, isValidUri } from '../dist/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const EXAMPLES_DIR = path.join(ROOT, 'examples');

test('bundled schema matches the published source', () => {
  assert.deepStrictEqual(EVENT_SCHEMA, JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/0.1/event.json'), 'utf8')));
});

test('JSON property names cannot change the parsed object prototype', () => {
  const value = parseJsonStrict('{"__proto__":{"polluted":true}}') as Record<string, unknown>;
  assert.strictEqual(Object.getPrototypeOf(value), Object.prototype);
  assert.deepStrictEqual(value.__proto__, { polluted: true });
});

test('parser rejects unpaired Unicode and validation returns structured errors', () => {
  assert.throws(() => parseJsonStrict('{"x":"\\ud800"}'));
  const result = validateSafe({});
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.code === 'required' && error.path === ''));
});

test('tag uniqueness uses Unicode case folding', () => {
  const event = baseline();
  assert.doesNotThrow(() => validate({ ...event, tags: ['i', 'ı'] }));
  assert.throws(() => validate({ ...event, tags: ['Straße', 'STRASSE'] }));
});

function baseline() {
  return {
    $schema: SCHEMA_ID,
    type: 'event',
    id: 'urn:uuid:514f2697-c7d6-4fa0-975b-8c682a5dcf87',
    url: 'https://example.org/events/build-night-2026',
    title: 'Community Build Night',
    status: 'scheduled',
    starts_at: '2026-11-14T18:00:00+08:00',
    ends_at: '2026-11-14T20:00:00+08:00',
    organizer: { name: 'Example Community' },
    location: { type: 'physical', physical: { name: 'Community Hall' } },
    registration: {
      required: true,
      status: 'open',
      url: 'https://docs.google.com/forms/d/e/EXAMPLE/viewform'
    },
    updated_at: '2026-10-29T08:00:00Z'
  };
}

test('all eight examples validate', () => {
  const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.openajang.json'));
  assert.strictEqual(files.length, 8);
  for (const f of files) {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
    const parsed = parseJsonStrict(raw);
    const validated = validate(parsed);
    assert.ok(validated);
    assert.strictEqual(validated.type, 'event');
  }
});

test('extension-free fallbacks retain description', () => {
  const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.openajang.json'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
    const d: any = parseJsonStrict(raw);
    delete d.extensions;
    const validated = validate(d);
    assert.ok(validated.description);
  }
});

test('unknown properties ignored at all levels', () => {
  const d: any = baseline();
  d.future = null;
  d.organizer.future = { any: null };
  d.location.physical.future = true;
  assert.doesNotThrow(() => validate(d));
});

test('required fields validation', () => {
  const required = [
    '$schema',
    'type',
    'url',
    'title',
    'status',
    'starts_at',
    'location',
    'organizer',
    'updated_at'
  ];
  for (const field of required) {
    const d: any = baseline();
    delete d[field];
    assert.throws(() => validate(d), OpenAjangValidationError);
  }
});

test('invalid scalar values rejected', () => {
  const cases: Array<[string, any]> = [
    ['title', ' '],
    ['title', null],
    ['type', 'Event'],
    ['status', 'sold_out'],
    ['$schema', 'https://example.org/schema/other.json'],
    ['url', 'ftp://example.org/a'],
    ['url', 'https://user:secret@example.org/a'],
    ['url', 'https://example.org:99999/a'],
    ['id', 'relative-id'],
    ['time_zone', 'Moon/Tranquility'],
    ['language', 'en--US']
  ];
  for (const [field, val] of cases) {
    const d: any = baseline();
    d[field] = val;
    assert.throws(() => validate(d), OpenAjangValidationError, `Should fail for ${field}=${val}`);
  }
});

test('strict json parsing rules', () => {
  assert.throws(() => parseJsonStrict('{"title":"a","title":"b"}'));
  assert.throws(() => parseJsonStrict('{"x":NaN}'));
  assert.throws(() => parseJsonStrict('{"x":Infinity}'));

  const d: any = baseline();
  d.title = '\ud800';
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('uri and url rules', () => {
  for (const val of [
    'https://example.org/<script>',
    'https://example.org/%broken',
    'https://example.org/a#b#c',
    'https://example.org/é'
  ]) {
    const d: any = baseline();
    d.url = val;
    assert.throws(() => validate(d), OpenAjangValidationError, `Should fail for url ${val}`);
  }
  const d: any = baseline();
  d.url = 'https://example.org/%C3%A9';
  assert.doesNotThrow(() => validate(d));
});

test('date and date-time ordering and rules', () => {
  for (const bad of [
    '2026-02-30',
    '2026-11-14T18:00:00',
    '2026-11-14T18:00:60Z',
    '2026-11-14t18:00:00z',
    '2026-11-14T18:00:00-00:00',
    '2026-11-14T18:00:00+08:99'
  ]) {
    const d: any = baseline();
    d.starts_at = bad;
    assert.throws(() => validate(d), OpenAjangValidationError, `Should fail for starts_at ${bad}`);
  }

  for (const end of ['2026-11-14', '2026-11-14T18:00:00+08:00', '2026-11-14T17:00:00+08:00']) {
    const d: any = baseline();
    d.ends_at = end;
    assert.throws(() => validate(d), OpenAjangValidationError, `Should fail for ends_at ${end}`);
  }

  const d: any = baseline();
  d.starts_at = '2026-11-14';
  d.ends_at = '2026-11-14';
  assert.doesNotThrow(() => validate(d));
  d.ends_at = '2026-11-13';
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('rescheduled history precision and validation', () => {
  const d: any = baseline();
  d.status = 'rescheduled';
  d.previous_starts_at = ['2026-10-17'];
  assert.doesNotThrow(() => validate(d));

  // Current start instant match rejected
  d.previous_starts_at = ['2026-11-14T10:00:00Z']; // same as 18:00+08:00
  assert.throws(() => validate(d), OpenAjangValidationError);

  // Duplicates rejected
  d.previous_starts_at = ['2026-10-17', '2026-10-17'];
  assert.throws(() => validate(d), OpenAjangValidationError);

  // Missing previous_starts_at rejected for rescheduled
  delete d.previous_starts_at;
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('submicrosecond end ordering', () => {
  const d: any = baseline();
  d.starts_at = '2026-11-14T10:00:00.0000001Z';
  d.ends_at = '2026-11-14T10:00:00.0000002Z';
  assert.doesNotThrow(() => validate(d));

  d.ends_at = '2026-11-14T10:00:00.0000000Z';
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('location rules and venue status', () => {
  const cases = [
    { type: 'physical', physical: {} },
    { type: 'physical', physical: { name: 'TBA' } },
    { type: 'virtual', virtual: { url: 'https://example.org/info' }, physical: { name: 'Hall' } },
    { type: 'hybrid', physical: { name: 'Hall' } },
    { type: 'physical', physical: { name: 'Hall', coordinates: { latitude: 91, longitude: 0 } } },
    { type: 'physical', physical: { name: 'Hall', address: { country: 'ZZ' } } }
  ];
  for (const loc of cases) {
    const d: any = baseline();
    d.location = loc;
    assert.throws(() => validate(d), OpenAjangValidationError);
  }

  // To be announced venue
  const d: any = baseline();
  d.location = {
    type: 'physical',
    physical: { status: 'to_be_announced', address: { country: 'PH' } }
  };
  assert.doesNotThrow(() => validate(d));

  // Virtual and hybrid
  d.location = { type: 'virtual', virtual: { url: 'https://example.org/info' } };
  assert.doesNotThrow(() => validate(d));

  d.location = {
    type: 'hybrid',
    physical: { name: 'Hall' },
    virtual: { url: 'https://example.org/info' }
  };
  assert.doesNotThrow(() => validate(d));
});

test('tickets and tags validation', () => {
  for (const amount of ['-1', '01', '1e2', 'PHP 10', '1,000', '1.']) {
    const d: any = baseline();
    d.tickets = [{ id: 'general', name: 'General', price: { amount, currency: 'PHP' } }];
    assert.throws(() => validate(d), OpenAjangValidationError, `Should fail for amount ${amount}`);
  }

  // Duplicate ticket ids
  const d: any = baseline();
  d.tickets = [
    { id: 'a', name: 'A' },
    { id: 'a', name: 'B' }
  ];
  assert.throws(() => validate(d), OpenAjangValidationError);

  // Duplicate tags after case folding
  d.tickets = undefined;
  d.tags = ['Straße', 'STRASSE'];
  assert.throws(() => validate(d), OpenAjangValidationError);

  // Valid free ticket
  d.tags = undefined;
  d.tickets = [{ id: 'free', name: 'Free', price: { amount: '0', currency: 'PHP' } }];
  assert.doesNotThrow(() => validate(d));

  // Invalid currency
  d.tickets[0].price.currency = 'ZZZ';
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('reserved schedule property rejected', () => {
  const d: any = baseline();
  d.schedule = { type: 'weekly' };
  assert.throws(() => validate(d), OpenAjangValidationError);
});

test('registration actions', () => {
  const states: Array<[string | undefined, string | null]> = [
    ['open', 'Register'],
    ['waitlist', 'Join waitlist'],
    ['unknown', 'View registration'],
    [undefined, 'View registration'],
    ['closed', null],
    ['not_yet_open', null]
  ];

  for (const [state, label] of states) {
    const d: any = baseline();
    if (state !== undefined) {
      d.registration.status = state;
    } else {
      delete d.registration.status;
    }
    const act = registrationAction(d);
    assert.strictEqual(act ? act.label : null, label);
  }

  for (const st of ['cancelled', 'postponed', 'completed']) {
    const d: any = baseline();
    d.status = st;
    assert.strictEqual(registrationAction(d), null);
  }
});

test('schema.org conversion on all examples', () => {
  const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.openajang.json'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
    const d: any = parseJsonStrict(raw);
    const { result, diagnostics } = toSchemaOrg(d);
    assert.strictEqual(result['@id'], eventId(d));
    assert.strictEqual(result.startDate, d.starts_at);
    assert.strictEqual(result.dateModified, undefined);
    assert.ok(diagnostics.length > 0);
  }
});

test('jscalendar conversion instant preservation and declines', () => {
  const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.openajang.json'));
  for (const f of files) {
    const raw = fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8');
    const d: any = parseJsonStrict(raw);
    const { result, diagnostics } = toJSCalendar(d);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) {
      assert.strictEqual(result, null);
      assert.ok(diagnostics[0].includes('Declined'));
    } else {
      assert.ok(result);
      assert.strictEqual(result.uid, eventId(d));
      assert.strictEqual(result.timeZone, 'Etc/UTC');
      assert.ok(result.duration.startsWith('PT'));
    }
  }
});

function parseIcs(text: string) {
  const comp = new ICAL.Component(ICAL.parse(text));
  const vevent = comp.getFirstSubcomponent('vevent');
  assert.ok(vevent);
  return { comp, vevent: vevent as any };
}

function icsOf(d: any, options?: any) {
  const { result, diagnostics } = toICalendar(d, options);
  assert.ok(result, diagnostics.join('; '));
  return { text: result as string, diagnostics };
}

test('icalendar export maps a timed event to exact UTC instants', () => {
  const d: any = baseline();
  const { text } = icsOf(d);
  assert.ok(text.includes('\r\nDTSTART:20261114T100000Z\r\n'));
  assert.ok(text.includes('\r\nDTEND:20261114T120000Z\r\n'));
  const { comp, vevent } = parseIcs(text);
  assert.strictEqual(comp.getFirstPropertyValue('version'), '2.0');
  assert.strictEqual(comp.getFirstPropertyValue('method'), null);
  assert.strictEqual(vevent.getFirstPropertyValue('uid'), d.id);
  assert.strictEqual(vevent.getFirstPropertyValue('summary'), d.title);
  assert.strictEqual(vevent.getFirstPropertyValue('status'), 'CONFIRMED');
  assert.strictEqual(vevent.getFirstPropertyValue('url'), d.url);
  assert.strictEqual(vevent.getFirstPropertyValue('location'), 'Community Hall');
  assert.strictEqual(vevent.getFirstPropertyValue('dtstart').toUnixTime(), Date.parse('2026-11-14T10:00:00Z') / 1000);
  assert.strictEqual(vevent.getFirstPropertyValue('dtend').toUnixTime(), Date.parse('2026-11-14T12:00:00Z') / 1000);
  assert.strictEqual(vevent.getFirstPropertyValue('dtstamp').toUnixTime(), Date.parse(d.updated_at) / 1000);
  assert.strictEqual(vevent.getFirstProperty('organizer'), null);
  assert.strictEqual(vevent.getFirstProperty('sequence'), null);
});

test('icalendar export preserves instants across offset and DST transitions', () => {
  const d: any = baseline();
  d.starts_at = '2026-03-08T01:30:00-05:00';
  d.ends_at = '2026-03-08T03:30:00-04:00';
  const { text } = icsOf(d);
  assert.ok(text.includes('DTSTART:20260308T063000Z'));
  assert.ok(text.includes('DTEND:20260308T073000Z'));

  d.starts_at = '2026-11-14T23:30:00-08:00';
  d.ends_at = '2026-11-15T14:15:00+05:45';
  d.time_zone = 'America/Los_Angeles';
  const out = icsOf(d);
  assert.ok(out.text.includes('DTSTART:20261115T073000Z'));
  assert.ok(out.text.includes('DTEND:20261115T083000Z'));
  assert.ok(out.diagnostics.some(n => n.includes('time_zone')));
});

test('icalendar UID is the effective event ID and stable across reschedules', () => {
  const d: any = baseline();
  const first = icsOf(d).text;
  d.status = 'rescheduled';
  d.previous_starts_at = [d.starts_at];
  d.starts_at = '2026-11-21T18:00:00+08:00';
  d.ends_at = '2026-11-21T20:00:00+08:00';
  d.updated_at = '2026-11-01T09:00:00Z';
  const second = icsOf(d, { sequence: 1 });
  const a = parseIcs(first).vevent;
  const b = parseIcs(second.text).vevent;
  assert.strictEqual(a.getFirstPropertyValue('uid'), b.getFirstPropertyValue('uid'));
  assert.notStrictEqual(a.getFirstPropertyValue('dtstart').toString(), b.getFirstPropertyValue('dtstart').toString());
  assert.strictEqual(b.getFirstPropertyValue('sequence'), 1);
  assert.strictEqual(b.getFirstPropertyValue('status'), 'CONFIRMED');
  assert.strictEqual(b.getFirstPropertyValue('dtstamp').toUnixTime(), Date.parse('2026-11-01T09:00:00Z') / 1000);
  assert.ok(second.diagnostics.some(n => n.includes('rescheduled')));
  assert.ok(String(b.getFirstPropertyValue('description')).includes('OpenAjang status: rescheduled'));

  delete d.id;
  assert.strictEqual(parseIcs(icsOf(d).text).vevent.getFirstPropertyValue('uid'), d.url);
});

test('icalendar export is deterministic and omits SEQUENCE unless supplied', () => {
  const d: any = baseline();
  const a = icsOf(d);
  assert.strictEqual(a.text, icsOf(d).text);
  assert.ok(a.diagnostics.some(n => n.startsWith('SEQUENCE omitted')));
  assert.throws(() => toICalendar(d, { sequence: -1 }), RangeError);
  assert.throws(() => toICalendar(d, { sequence: 1.5 }), RangeError);
});

test('icalendar export escapes text, folds lines, and keeps UTF-8 intact', () => {
  const d: any = baseline();
  d.title = 'Semi;colon, comma \\ backslash';
  d.description = 'Line one\r\nLine two ' + 'ñandú 🎉 '.repeat(40);
  d.location.physical.address = { street: '1 Main St', locality: 'Dávao' };
  d.tags = ['a,b', 'c'];
  const { text } = icsOf(d);
  for (const line of text.split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length <= 75, line);
  }
  assert.ok(!/\n(?!$)/.test(text.replace(/\r\n/g, '')));
  const { vevent } = parseIcs(text);
  assert.strictEqual(vevent.getFirstPropertyValue('summary'), d.title);
  const desc = String(vevent.getFirstPropertyValue('description'));
  assert.ok(desc.startsWith('Line one\nLine two ñandú 🎉'));
  assert.strictEqual(vevent.getFirstPropertyValue('location'), 'Community Hall, 1 Main St, Dávao');
  assert.deepStrictEqual(vevent.getFirstProperty('categories').getValues(), ['a,b', 'c']);
});

test('icalendar export maps cancelled to STATUS:CANCELLED and drops registration link', () => {
  const d: any = baseline();
  d.status = 'cancelled';
  const { text } = icsOf(d);
  const { vevent } = parseIcs(text);
  assert.strictEqual(vevent.getFirstPropertyValue('status'), 'CANCELLED');
  assert.ok(!String(vevent.getFirstPropertyValue('description')).includes('docs.google.com'));
});

test('icalendar export retains venue coordinates and virtual attendance', () => {
  const d: any = baseline();
  d.location = {
    type: 'hybrid',
    physical: { status: 'tentative', name: 'Hall', coordinates: { latitude: 7.07, longitude: 125.6 } },
    virtual: { url: 'https://example.org/live', platform: 'Zoom' }
  };
  const out = icsOf(d);
  const { vevent } = parseIcs(out.text);
  const geo = vevent.getFirstPropertyValue('geo');
  assert.deepStrictEqual(geo, [7.07, 125.6]);
  const desc = String(vevent.getFirstPropertyValue('description'));
  assert.ok(desc.includes('Venue status: tentative'));
  assert.ok(desc.includes('Online (Zoom): https://example.org/live'));
  assert.ok(out.diagnostics.some(n => n.includes('Venue certainty')));
});

test('icalendar export declines when fidelity cannot be preserved', () => {
  const cases: Array<[string, (d: any) => void, RegExp]> = [
    ['unknown end', d => { delete d.ends_at; }, /unknown end/],
    ['date-only', d => { d.starts_at = '2026-11-14'; d.ends_at = '2026-11-15'; }, /clock times unpublished/],
    ['date-only with unknown end', d => { d.starts_at = '2026-11-14'; delete d.ends_at; }, /clock times unpublished/],
    ['postponed', d => { d.status = 'postponed'; delete d.ends_at; }, /postponed/],
    ['postponed with known times', d => { d.status = 'postponed'; }, /postponed/],
    ['sub-second start', d => { d.starts_at = '2026-11-14T18:00:00.5+08:00'; }, /sub-second/],
    ['sub-second end', d => { d.ends_at = '2026-11-14T20:00:00.250+08:00'; }, /sub-second/],
    ['zero duration', d => { d.ends_at = d.starts_at; }, /DTEND later/]
  ];
  for (const [name, mutate, pattern] of cases) {
    const d: any = baseline();
    mutate(d);
    let r;
    try {
      r = toICalendar(d);
    } catch {
      continue; // rejected earlier by the validator
    }
    assert.strictEqual(r.result, null, name);
    assert.ok(r.diagnostics[0].startsWith('Declined'), name);
    assert.match(r.diagnostics[0], pattern, name);
  }
});

test('icalendar export accepts zero-valued fractional seconds', () => {
  const d: any = baseline();
  d.starts_at = '2026-11-14T18:00:00.000+08:00';
  assert.ok(icsOf(d).text.includes('DTSTART:20261114T100000Z'));
});

test('icalendar export of examples matches committed fixtures', () => {
  const generated = path.join(ROOT, 'generated');
  const files = fs.readdirSync(EXAMPLES_DIR).filter(f => f.endsWith('.openajang.json'));
  let produced = 0;
  for (const f of files) {
    const d: any = parseJsonStrict(fs.readFileSync(path.join(EXAMPLES_DIR, f), 'utf-8'));
    const { result } = toICalendar(d);
    const fixture = path.join(generated, f.replace('.openajang.json', '.ics'));
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.starts_at)) {
      assert.strictEqual(result, null);
      assert.ok(!fs.existsSync(fixture));
    } else {
      produced++;
      assert.strictEqual(result, fs.readFileSync(fixture, 'utf-8'));
      assert.strictEqual(parseIcs(result as string).vevent.getFirstPropertyValue('uid'), d.id ?? d.url);
    }
  }
  assert.ok(produced >= 1);
});
