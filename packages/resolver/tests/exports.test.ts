import test from 'node:test';
import assert from 'node:assert/strict';

test('the Node root export includes both transport factories', async () => {
  const root = await import('@openajang/resolver');
  assert.equal(typeof root.resolveOpenAjang, 'function');
  assert.equal(typeof root.createNodeTransport, 'function');
  assert.equal(typeof root.createFetchTransport, 'function');
});

test('the fetch subpath exports the portable factory', async () => {
  const fetchEntry = await import('@openajang/resolver/fetch');
  assert.equal(typeof fetchEntry.resolveOpenAjang, 'function');
  assert.equal(typeof fetchEntry.createFetchTransport, 'function');
});
