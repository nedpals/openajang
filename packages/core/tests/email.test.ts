import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidEmail } from '../dist/parser.js';

test('email syntax accepts common and RFC forms', () => {
  for (const value of [
    'event@localhost',
    '"event host"@example.org',
    'user@exämple.com',
    '"a\tb"@x.com',
    'a@x_y.com',
    'test(c)@x.com',
    '"a".b@x.com'
  ]) {
    assert.equal(isValidEmail(value), true, value);
  }
});

test('email syntax rejects malformed addresses', () => {
  for (const value of [
    'event..host@example.org',
    '.event@example.org',
    'event.@example.org',
    'event@example.com:80',
    'event@example.com/path',
    'event@@example.org',
    'event example@example.org',
    'event@exämple..com',
    'event@example.com\\evil',
    'event@ex%41mple.com',
    'event@0x7f.1',
    'event@1.2.3.4'
  ]) {
    assert.equal(isValidEmail(value), false, value);
  }
});
