import { Miniflare } from 'miniflare';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'node_modules/.cache/openajang-runtime');

const mf = new Miniflare({
  modules: true,
  modulesRoot: root,
  scriptPath: path.join(root, 'worker.mjs'),
  compatibilityDate: '2026-08-06',
  compatibilityFlags: []
});

try {
  const response = await mf.dispatchFetch('http://localhost/');
  const body = await response.json();
  if (!body.ok) {
    throw new Error(`Worker smoke failed: ${body.error}`);
  }
  console.log(`worker smoke passed: ${body.checks} checks`);
} finally {
  await mf.dispose();
}
