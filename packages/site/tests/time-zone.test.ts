import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { candidates } from '../src/scripts/time-zone.ts';

test('resolves ordinary local time with the event zone offset', () => {
  assert.deepEqual(candidates('2027-05-12', '14:30', 'Asia/Manila').map(c => c.value), ['2027-05-12T14:30:00+08:00']);
});
test('rejects a missing clock-change time and offers both repeated times', () => {
  assert.equal(candidates('2027-03-14', '02:30', 'America/New_York').length, 0);
  assert.deepEqual(candidates('2027-11-07', '01:30', 'America/New_York').map(c => c.offset).sort(), ['-04:00', '-05:00']);
});
