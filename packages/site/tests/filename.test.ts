import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { eventFilename, normalizeFilename, slugify } from '../src/scripts/filename.ts';

test('filename starts with the start date so files sort chronologically', () => {
  assert.equal(eventFilename('Community Build Night', '2026-11-21T18:00:00+08:00'), '2026-11-21-community-build-night.openajang.json');
  assert.equal(eventFilename('Meetup', '2026-12-05'), '2026-12-05-meetup.openajang.json');
  const names = [eventFilename('B', '2027-01-02'), eventFilename('A', '2026-12-31'), eventFilename('C', '2026-02-01')];
  assert.deepEqual([...names].sort().map((n) => n.slice(0, 10)), ['2026-02-01', '2026-12-31', '2027-01-02']);
});

test('missing title or date degrade without leaving stray separators', () => {
  assert.equal(eventFilename('', ''), 'event.openajang.json');
  assert.equal(eventFilename('Talk', ''), 'talk.openajang.json');
  assert.equal(eventFilename('', '2026-12-05T10:00:00Z'), '2026-12-05.openajang.json');
  assert.equal(eventFilename(undefined, undefined), 'event.openajang.json');
  assert.equal(eventFilename('Talk', 'tomorrow'), 'talk.openajang.json');
});

test('slugify drops accents and symbols and caps the length at a word boundary', () => {
  assert.equal(slugify('Café & Código: 2026!'), 'cafe-codigo-2026');
  assert.equal(slugify('  --Hello__World--  '), 'hello-world');
  assert.equal(slugify('日本語'), '');
  assert.equal(eventFilename('日本語', '2026-12-05'), '2026-12-05.openajang.json');
  const long = slugify('word '.repeat(30));
  assert.ok(long.length <= 60 && !long.endsWith('-') && long.startsWith('word-word'));
});

test('typed names are sanitized, keep one suffix, and fall back when empty', () => {
  const fallback = '2026-12-05-meetup.openajang.json';
  assert.equal(normalizeFilename('Spring Jam', fallback), 'spring-jam.openajang.json');
  assert.equal(normalizeFilename('spring-jam.openajang.json', fallback), 'spring-jam.openajang.json');
  assert.equal(normalizeFilename('spring-jam.json', fallback), 'spring-jam.openajang.json');
  assert.equal(normalizeFilename('../etc/passwd', fallback), 'etc-passwd.openajang.json');
  assert.equal(normalizeFilename('v1.2 launch', fallback), 'v1-2-launch.openajang.json');
  assert.equal(normalizeFilename('  ', fallback), fallback);
  assert.equal(normalizeFilename('???', fallback), fallback);
});
