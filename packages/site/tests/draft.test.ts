import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { decodeDraft, encodeDraft } from '../src/scripts/draft.ts';
const names = ['title'];
function state() { return { original: { title: 'x' }, identity: 'id', edited: [], removedLocations: [], tickets: [], ticketsEdited: false, values: { title: 'x' }, dates: { start: {date:'',time:'',offset:'',dirty:false}, end: {date:'',time:'',offset:'',dirty:false} } }; }
test('large draft round trips and rejects oversized output', () => {
  const s = state(); s.original.title = 'a'.repeat(601180); s.values.title = s.original.title;
  assert.deepEqual(decodeDraft(JSON.parse(encodeDraft(s, names)), names), s);
  s.original.title = 'a'.repeat(5 * 1024 * 1024);
  assert.throws(() => encodeDraft(s, names), /limit/);
});
test('malformed history is rejected and special keys survive as data', () => {
  const s = state(); s.original = { ...s.original, ...JSON.parse('{"constructor":{"prototype":{"polluted":true}},"__proto__":{"x":1},"nested":{"prototype":42}}') }; 
  const restored = decodeDraft(JSON.parse(encodeDraft(s, names)), names);
  assert.deepEqual(restored.original, s.original); assert.equal(({} as any).polluted, undefined);
  (s.original as any).previous_starts_at = {};
  assert.throws(() => encodeDraft(s, names), /Invalid/);
});
test('draft preserves incomplete temporal controls and rejects malformed state', () => {
  const s: any = state();
  s.history = [{value:'2027-11-07', date:'2027-11-07', time:'01:30', offset:'', dirty:true}];
  s.dates['registration-opens'] = {date:'2027-01-01', time:'', offset:'', dirty:true};
  assert.deepEqual(decodeDraft(JSON.parse(encodeDraft(s, names)), names), s);
  s.history[0].dirty = 'yes';
  assert.throws(() => encodeDraft(s, names), /Invalid/);
});
