import test from 'node:test';
import assert from 'node:assert';
import { validateSafe, SCHEMA_ID } from '../dist/index.js';

function baseline(): any {
  return {
    $schema: SCHEMA_ID,
    type: 'event',
    id: 'urn:uuid:514f2697-c7d6-4fa0-975b-8c682a5dcf87',
    url: 'https://example.org/events/build-night-2026',
    title: 'Community Build Night',
    status: 'scheduled',
    starts_at: '2026-11-14T18:00:00+08:00',
    organizer: { name: 'Example Community' },
    location: { type: 'physical', physical: { name: 'Community Hall' } },
    updated_at: '2026-10-29T08:00:00Z'
  };
}

const codes = (event: unknown) => validateSafe(event).errors.map(error => `${error.code} ${error.path}`);

// Codes are public API: renaming or removing one breaks consumers that map codes to copy.
test('procedural rules report stable codes at the offending path', () => {
  const event = baseline();
  event.ends_at = '2026-11-14T17:00:00+08:00';
  event.registration = { required: true, status: 'open', opens_at: '2026-11-02T00:00:00Z', closes_at: '2026-11-01T00:00:00Z' };
  event.tickets = [
    { id: 'a', name: 'A' },
    { id: 'a', name: 'B', sales_start: '2026-11-02T00:00:00Z', sales_end: '2026-11-01T00:00:00Z' }
  ];
  event.tags = ['Straße', 'STRASSE'];
  event.status = 'rescheduled';
  event.previous_starts_at = ['2026-11-14T10:00:00Z'];
  event.location.physical.name = 'TBA';
  assert.deepStrictEqual(codes(event).sort(), [
    'end-before-start /ends_at',
    'history-contains-current-start /previous_starts_at/0',
    'placeholder-venue /location/physical/name',
    'registration-close-before-open /registration/closes_at',
    'tag-duplicate /tags/1',
    'ticket-id-duplicate /tickets/1/id',
    'ticket-sales-end-before-start /tickets/1/sales_end'
  ]);
});

test('procedural errors are collected alongside schema errors without crashing', () => {
  const event = baseline();
  event.title = 5;
  event.tags = ['a', 'A'];
  event.ends_at = 'garbage';
  event.tickets = [null, { id: 3, name: 'x' }];
  const found = codes(event);
  assert.ok(found.includes('type /title'));
  assert.ok(found.includes('tag-duplicate /tags/1'));
  assert.ok(!found.some(code => code.startsWith('end-')));
});

test('schema diagnostics carry the Ajv params', () => {
  const missing = validateSafe({}).errors.filter(error => error.code === 'required');
  assert.ok(missing.some(error => error.params?.missingProperty === 'title'));
});

test('a document missing starts_at does not crash procedural checks', () => {
  const event = baseline();
  delete event.starts_at;
  event.ends_at = '2026-11-14T20:00:00+08:00';
  assert.doesNotThrow(() => validateSafe(event));
  assert.ok(codes(event).includes('required '));
});
