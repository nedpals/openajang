import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'node_modules/.cache/openajang-runtime');

const files = new Map([
  ['/bundle.mjs', 'bundle.mjs'],
  ['/runtime-smoke-lib.mjs', 'runtime-smoke-lib.mjs'],
  ['/browser-runner.mjs', 'browser-runner.mjs']
]);

const html = `<!doctype html>
<meta charset="utf-8">
<title>OpenAjang runtime smoke</title>
<script type="module" src="/browser-runner.mjs"></script>
`;

const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': "default-src 'none'; script-src 'self'"
    });
    res.end(html);
    return;
  }

  const file = files.get(req.url);
  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }

  const body = await readFile(path.join(root, file));
  res.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'content-security-policy': "default-src 'none'; script-src 'self'"
  });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => globalThis.__openajangSmoke, null, { timeout: 30000 });
  const result = await page.evaluate(() => globalThis.__openajangSmoke);

  if (!result.ok) {
    throw new Error(`Browser smoke failed: ${result.error}\n${errors.join('\n')}`);
  }
  console.log(`browser smoke passed: ${result.checks} checks`);
} finally {
  await browser?.close();
  server.close();
}
