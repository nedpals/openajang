import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { normalizeDiagnostics } from '../src/scripts/diagnostics.ts';
import { validateSafe } from '@openajang/core';
const example = () => JSON.parse(readFileSync('examples/pycon-davao-2026.openajang.json', 'utf8'));
const diagnostics = (value: unknown) => normalizeDiagnostics(validateSafe(value).errors, value);

test('empty document reports core requirements without conditional artifacts', () => {
  const errors = diagnostics({});
  assert.ok(errors.some(error => error.path === '/title'));
  assert.ok(!errors.some(error => error.path === '/previous_starts_at' || error.code === 'if'));
});
test('rescheduled events retain the history requirement and collapse invalid date branches', () => {
  assert.ok(diagnostics({ status: 'rescheduled' }).some(error => error.path === '/previous_starts_at'));
  const errors = diagnostics({ status: 'rescheduled', previous_starts_at: ['garbage'] }).filter(error => error.path === '/previous_starts_at/0');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /valid date/);
});
test('switching attendance explains both retained data and missing destination', () => {
  const event = example(); event.location.type = 'virtual';
  const errors = diagnostics(event);
  assert.ok(errors.some(error => error.path === '/location/physical' && error.code === 'remove-location'));
  assert.ok(errors.some(error => error.path === '/location/virtual/url'));
  assert.ok(!errors.some(error => /schema|must NOT/.test(error.message)));
});
test('ordering errors identify the boundary that needs correction', () => {
  const event = example(); event.registration.opens_at = '2027-01-02T00:00:00Z'; event.registration.closes_at = '2027-01-01T00:00:00Z';
  assert.ok(diagnostics(event).some(error => error.path === '/registration/closes_at' && /after/.test(error.message)));
  delete event.registration; event.ends_at = '2000-01-01T00:00:00Z';
  assert.ok(diagnostics(event).some(error => error.path === '/ends_at'));
});
test('price, currency and registration dependency errors give relevant guidance', () => {
  const event = example(); event.tickets[0].price = { amount: '-1', currency: 'usd' }; delete event.registration.required;
  const errors = diagnostics(event);
  assert.ok(errors.some(error => /nonnegative decimal/.test(error.message)));
  assert.ok(errors.some(error => /uppercase currency/.test(error.message)));
  assert.ok(errors.some(error => error.path === '/registration/required' && /whether/.test(error.message)));
});

test('procedural rule codes map to page copy at the exact path', () => {
  const event = { ...example(), tags: ['a', 'A'], tickets: [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }] };
  const errors = diagnostics(event);
  assert.ok(errors.some(error => error.path === '/tags/1' && /repeated tag/.test(error.message)));
  assert.ok(errors.some(error => error.path === '/tickets/1/id' && /different ID/.test(error.message)));
});
