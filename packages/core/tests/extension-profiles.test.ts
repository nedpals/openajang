import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020Pkg from 'ajv/dist/2020.js';
import { validate } from '../dist/index.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (file: string) => JSON.parse(readFileSync(ROOT + file, 'utf8'));
const Ajv2020 = (Ajv2020Pkg as any).default || Ajv2020Pkg;

const KEY = 'org.example:eligibility-v1';
const dir = 'extensions/org.example-eligibility-v1/';
const check = new Ajv2020({ strict: true }).compile(read(dir + 'schema.json'));
const fixtures: Array<{ name: string; valid: boolean; value: unknown }> = read(dir + 'fixtures.json');

// Procedural rule from PROFILE.md that the schema cannot express.
function profileAccepts(value: any): boolean {
  if (!check(value)) return false;
  return value.minimum_age === undefined || value.maximum_age === undefined || value.maximum_age >= value.minimum_age;
}

for (const fixture of fixtures) {
  test(`reference profile fixture: ${fixture.name}`, () => {
    assert.equal(profileAccepts(fixture.value), fixture.valid);
  });
}

test('reference profile has valid and invalid fixtures', () => {
  assert.ok(fixtures.some(f => f.valid));
  assert.ok(fixtures.some(f => !f.valid));
});

test('core validation neither requires nor depends on the profile', () => {
  const base = read('examples/pycon-davao-2026.openajang.json');
  const without = structuredClone(base);
  delete without.extensions;
  assert.doesNotThrow(() => validate(without));
  for (const fixture of fixtures) {
    const event = structuredClone(without);
    event.extensions = { [KEY]: fixture.value };
    assert.doesNotThrow(() => validate(event), fixture.name);
  }
});
