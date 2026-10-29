import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseJsonStrict, validate } from '../dist/index.js';

const cases = JSON.parse(readFileSync('tests/conformance/cases.json', 'utf8'));
const baseline = JSON.parse(readFileSync('examples/pycon-davao-2026.openajang.json', 'utf8'));
for (const fixture of cases) {
  test(`conformance: ${fixture.name}`, () => {
    let accepted = false;
    try {
      const event = fixture.raw === undefined ? structuredClone(baseline) : parseJsonStrict(fixture.raw);
      if (fixture.changes) {
        for (const [path, value] of Object.entries(fixture.changes)) {
          const parts = path.split('.');
          let obj = event;
          for (const key of parts.slice(0, -1)) obj = obj[key];
          obj[parts.at(-1)!] = value;
        }
      }
      validate(event);
      accepted = true;
    } catch {}
    assert.equal(accepted, fixture.valid);
  });
}
