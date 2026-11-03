import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(repo, 'node_modules/.cache/openajang-runtime');
const outfile = path.join(outdir, 'bundle.mjs');
const fixture = path.join(repo, 'examples/pycon-davao-2026.openajang.json');
const resolverEntry = path.join(repo, 'packages/resolver/dist/fetch.js');

const entry = [
  "import * as core from '@openajang/core';",
  `import * as resolver from ${JSON.stringify(resolverEntry)};`,
  `import fixture from ${JSON.stringify(fixture)};`,
  'export { core, resolver, fixture };',
  ''
].join('\n');

await mkdir(outdir, { recursive: true });

await build({
  stdin: {
    contents: entry,
    resolveDir: path.join(repo, 'packages/resolver'),
    loader: 'js',
    sourcefile: 'runtime-smoke-entry.mjs'
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default', 'browser', 'workerd', 'worker'],
  target: 'es2022',
  write: true,
  outfile,
  legalComments: 'none'
});

// The Workers and browser runners live beside the bundle so relative module
// imports stay inside the runtime's module root.
const smokeLib = await readFile(path.join(repo, 'scripts/runtime-smoke-lib.mjs'), 'utf8');
await writeFile(path.join(outdir, 'runtime-smoke-lib.mjs'), smokeLib);

const worker = [
  "import { runSmoke } from './runtime-smoke-lib.mjs';",
  "import * as bundle from './bundle.mjs';",
  '',
  'export default {',
  '  async fetch() {',
  '    try {',
  '      const result = await runSmoke(bundle);',
  '      return Response.json({ ok: true, ...result });',
  '    } catch (err) {',
  '      return Response.json({ ok: false, error: err?.stack ?? String(err) }, { status: 500 });',
  '    }',
  '  }',
  '};',
  ''
].join('\n');
await writeFile(path.join(outdir, 'worker.mjs'), worker);

const browserRunner = [
  "import { runSmoke } from './runtime-smoke-lib.mjs';",
  "import * as bundle from './bundle.mjs';",
  '',
  'try {',
  '  const result = await runSmoke(bundle);',
  '  globalThis.__openajangSmoke = { ok: true, ...result };',
  '} catch (err) {',
  '  globalThis.__openajangSmoke = { ok: false, error: err?.stack ?? String(err) };',
  '}',
  ''
].join('\n');
await writeFile(path.join(outdir, 'browser-runner.mjs'), browserRunner);

console.log(outfile);
