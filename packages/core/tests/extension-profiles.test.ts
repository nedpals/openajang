import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020Pkg from 'ajv/dist/2020.js';
import { validate } from '../dist/index.js';
import { isValidLanguageTag } from '../dist/parser.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const read = (file: string) => JSON.parse(readFileSync(ROOT + file, 'utf8'));
const Ajv2020 = (Ajv2020Pkg as any).default || Ajv2020Pkg;

interface Fixture { name: string; valid: boolean; value: unknown }
interface Profile {
  key: string;
  dir: string;
  // Rules from PROFILE.md that the schema cannot express.
  extraRules: (value: any) => boolean;
}

const profiles: Profile[] = [
  {
    key: 'org.example:eligibility-v1',
    dir: 'extensions/org.example-eligibility-v1/',
    extraRules: v => v.minimum_age === undefined || v.maximum_age === undefined || v.maximum_age >= v.minimum_age
  },
  {
    key: 'unstable:event_languages',
    dir: 'extensions/unstable-event_languages/',
    extraRules: v => [...(v.working ?? []), ...(v.presentations ?? [])].every(isValidLanguageTag)
  }
];

function profileAccepts(profile: Profile, check: (value: unknown) => boolean, value: unknown): boolean {
  return check(value) && profile.extraRules(value);
}

const baseline = () => read('examples/pycon-davao-2026.openajang.json');

for (const profile of profiles) {
  const check = new Ajv2020({ strict: true }).compile(read(profile.dir + 'schema.json'));
  const fixtures: Fixture[] = read(profile.dir + 'fixtures.json');

  // Profile conformance: does a value meet this profile?
  for (const fixture of fixtures) {
    test(`profile conformance ${profile.key}: ${fixture.name}`, () => {
      assert.equal(profileAccepts(profile, check, fixture.value), fixture.valid);
    });
  }

  test(`profile conformance ${profile.key}: has valid and invalid fixtures`, () => {
    assert.ok(fixtures.some(f => f.valid));
    assert.ok(fixtures.some(f => !f.valid));
  });

  // Core conformance: is the document a valid event? Never depends on the profile.
  test(`core conformance ${profile.key}: stays valid for every fixture value, valid or not`, () => {
    const without = baseline();
    delete without.extensions;
    assert.doesNotThrow(() => validate(without));
    for (const fixture of fixtures) {
      const event = structuredClone(without);
      event.extensions = { [profile.key]: fixture.value };
      assert.doesNotThrow(() => validate(event), fixture.name);
    }
  });
}

// Fallback review: automation can confirm the core text mentions a fact the
// extension also carries. It cannot confirm the text is true or sufficient.
interface FallbackCase {
  name: string;
  example?: string;
  inline?: Record<string, any>;
  claims: Array<{ tag: string; term: string; field: string }>;
  fallbackAdequate: boolean;
  review?: string;
}

test('fallback cases: core text carries what the extension carries', () => {
  const cases: FallbackCase[] = read('extensions/unstable-event_languages/fallback-cases.json');
  assert.ok(cases.some(c => c.fallbackAdequate));
  assert.ok(cases.some(c => !c.fallbackAdequate));
  for (const c of cases) {
    const doc = c.example ? read(c.example) : { ...baseline(), ...c.inline };
    const stripped = structuredClone(doc);
    delete stripped.extensions;
    assert.doesNotThrow(() => validate(stripped), c.name);
    const declared = new Set<string>(Object.values(doc.extensions?.['unstable:event_languages'] ?? {}).flat() as string[]);
    const adequate = c.claims.every(claim => declared.has(claim.tag) && String(stripped[claim.field]).includes(claim.term));
    assert.equal(adequate, c.fallbackAdequate, c.name);
    if (!c.fallbackAdequate) assert.ok(c.review, `${c.name} needs a human review note`);
  }
});
