import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { publisherBase, publisherEventUrl } from '../src/scripts/publisher-path.ts';

test('derive event URLs from a normalized filename and a nested site root', () => {
  assert.equal(publisherEventUrl('https://example.org/community/', '2027-build night.openajang.json'), 'https://example.org/community/events/2027-build-night/');
  assert.equal(publisherEventUrl('https://example.org/', 'event.openajang.json'), 'https://example.org/events/event/');
});

test('reject insecure or ambiguous site roots', () => {
  for (const value of ['http://example.org/', 'https://example.org/path', 'https://example.org/?x=1', 'https://user:pass@example.org/', 'https://example.org/#fragment', 'invalid']) {
    assert.equal(publisherBase(value), null, value);
    assert.equal(publisherEventUrl(value, 'event.openajang.json'), null, value);
  }
});
