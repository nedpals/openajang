import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { schemaOrgForPage } from '../src/scripts/schema-org.ts';

const event = JSON.parse(
  readFileSync(
    new URL('../../../examples/chasing-clouds-2026.openajang.json', import.meta.url),
    'utf8',
  ),
);
test('JSON-LD retains event identity and date precision while escaping HTML markup', () => {
  const title = '</script><img src=x onerror=alert(1)> & event';
  const converted = schemaOrgForPage({ ...event, title });
  assert.ok(!converted.json.includes('</script>'));
  const parsed = JSON.parse(converted.json);
  assert.equal(parsed.name, title);
  assert.equal(parsed['@id'], event.id);
  assert.equal(parsed.startDate, event.starts_at);
  assert.ok(converted.diagnostics.length);
});
