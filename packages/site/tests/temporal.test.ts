import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveTemporal } from '../src/scripts/temporal.ts';

test('registration boundaries allow omission but require a complete date and time', () => {
  assert.equal(resolveTemporal({ date: '', time: '', offset: '' }, '', true).value, '');
  assert.equal(resolveTemporal({ date: '2027-05-12', time: '', offset: '' }, 'Asia/Manila', true).control, 'time');
  assert.equal(resolveTemporal({ date: '', time: '12:00', offset: '' }, 'Asia/Manila', true).control, 'date');
  assert.equal(resolveTemporal({ date: '2027-05-12', time: '12:00', offset: '' }, 'Asia/Manila', true).value, '2027-05-12T12:00:00+08:00');
});
test('history supports date-only entries and rejects an empty entry', () => {
  assert.equal(resolveTemporal({ date: '2027-05-12', time: '', offset: '' }, '', false, true).value, '2027-05-12');
  assert.ok(resolveTemporal({ date: '', time: '', offset: '' }, '', false, true).message);
});
test('DST and zone failures target the control that can resolve the issue', () => {
  const state = { date: '2027-03-14', time: '02:30', offset: '' };
  assert.equal(resolveTemporal(state, 'America/New_York').control, 'time');
  assert.equal(resolveTemporal(state, '').control, 'zone');
  assert.equal(resolveTemporal(state, 'invalid').control, 'zone');
  const overlap = { date: '2027-11-07', time: '01:30', offset: '' };
  assert.equal(resolveTemporal(overlap, 'America/New_York').choices.length, 2);
  assert.equal(resolveTemporal(overlap, 'America/New_York').control, 'offset');
  const resolved = resolveTemporal({ ...overlap, offset: '-05:00' }, 'America/New_York');
  assert.equal(resolved.value, '2027-11-07T01:30:00-05:00');
  assert.equal(resolved.message, '');
});
