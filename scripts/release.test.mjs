import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).version;
function validate(ref) {
  return spawnSync(process.execPath, ['scripts/release.mjs', 'validate'], {
    encoding: 'utf8', env: { ...process.env, GITHUB_REF: ref, RELEASE_DIR: '/tmp' }
  });
}

test('release validation accepts the matching tag and rejects other refs and versions', () => {
  assert.equal(validate(`refs/tags/sdk-v${version}`).status, 0);
  assert.notEqual(validate('refs/heads/master').status, 0);
  assert.notEqual(validate('refs/tags/sdk-v999.0.0').status, 0);
  assert.notEqual(validate('refs/tags/sdk-v01.0.0').status, 0);
});

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync as readFile, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('publishing retries only skip identical tarballs and stop on errors', () => {
  const dir = mkdtempSync(join(tmpdir(), 'openajang-release-test-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const log = join(dir, 'publish.log');
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\necho "$2" >> "$RELEASE_TEST_LOG"\n', { mode: 0o755 });
  for (const name of ['core', 'resolver']) {
    const fixture = join(dir, name, 'package');
    mkdirSync(fixture, { recursive: true });
    writeFileSync(join(fixture, 'package.json'), JSON.stringify({
      name: `@openajang/${name}`, version,
      dependencies: name === 'resolver' ? { '@openajang/core': version } : {}
    }));
    execFileSync('tar', ['-czf', join(dir, `openajang-${name}-${version}.tgz`), '-C', join(dir, name), 'package']);
  }
  const mock = join(dir, 'mock.mjs');
  writeFileSync(mock, `
    import { createHash } from 'node:crypto';
    import { readFileSync } from 'node:fs';
    globalThis.fetch = async url => {
      const name = url.includes('resolver') ? 'resolver' : 'core';
      const mode = process.env.RELEASE_TEST_MODE;
      if (mode === 'error') return { status: 500 };
      if (mode === 'missing' || (mode === 'partial' && name === 'resolver')) return { status: 404 };
      const data = readFileSync(process.env.RELEASE_DIR + '/openajang-' + name + '-' + process.env.RELEASE_TEST_VERSION + '.tgz');
      const integrity = mode === 'mismatch' ? 'sha512-wrong' : 'sha512-' + createHash('sha512').update(data).digest('base64');
      return { status: 200, json: async () => ({ dist: { integrity } }) };
    };
  `);
  function run(mode) {
    return spawnSync(process.execPath, ['--import', mock, resolve('scripts/release.mjs'), 'publish'], {
      encoding: 'utf8', env: { ...process.env, GITHUB_REF: `refs/tags/sdk-v${version}`, RELEASE_DIR: dir,
        RELEASE_TEST_VERSION: version, RELEASE_TEST_MODE: mode, RELEASE_TEST_LOG: log, PATH: `${bin}:${process.env.PATH}` }
    });
  }
  assert.equal(run('mismatch').status, 1);
  assert.equal(run('error').status, 1);
  assert.equal(existsSync(log), false);
  const partial = run('partial');
  assert.equal(partial.status, 0, partial.stderr);
  assert.match(readFile(log, 'utf8'), /openajang-resolver-/);
  assert.doesNotMatch(readFile(log, 'utf8'), /openajang-core-/);
  assert.equal(run('missing').status, 0);
  const calls = readFile(log, 'utf8').trim().split('\n');
  assert.match(calls[1], /openajang-core-/);
  assert.match(calls[2], /openajang-resolver-/);
});
