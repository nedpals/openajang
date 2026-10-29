import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import os from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Public API
import {
  resolveOpenAjang,
  discoverOpenAjangUrl,
  normalizeDiscoveryUrl,
  ResolverSecurityError,
  ResolverDiscoveryError
} from '../dist/index.js';

// Internal security helpers for unit tests
import {
  assertSafeUrl,
  assertSafeHostname,
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6
} from '../dist/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../../');
const EXAMPLES_DIR = path.join(ROOT, 'examples');

test('ssrf ip blocking and private ranges', () => {
  // IPv4 private & reserved
  assert.strictEqual(isPrivateOrReservedIPv4('127.0.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('10.0.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('172.16.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('172.31.255.255'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('192.168.1.1'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('169.254.169.254'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('0.0.0.0'), true);
  assert.strictEqual(isPrivateOrReservedIPv4('8.8.8.8'), false);
  assert.strictEqual(isPrivateOrReservedIPv4('1.1.1.1'), false);

  // IPv6
  assert.strictEqual(isPrivateOrReservedIPv6('::1'), true);
  assert.strictEqual(isPrivateOrReservedIPv6('fc00::1'), true);
  assert.strictEqual(isPrivateOrReservedIPv6('fe80::1'), true);
  assert.strictEqual(isPrivateOrReservedIPv6('::ffff:127.0.0.1'), true);
  assert.strictEqual(isPrivateOrReservedIPv6('::ffff:7f00:1'), true);
  assert.throws(() => assertSafeUrl('http://[::ffff:7f00:1]/'), ResolverSecurityError);
  assert.strictEqual(isPrivateOrReservedIPv6('2606:4700:4700::1111'), false);

  // Hostname assertion
  assert.throws(() => assertSafeHostname('localhost'), ResolverSecurityError);
  assert.throws(() => assertSafeHostname('sub.localhost'), ResolverSecurityError);
  assert.throws(() => assertSafeHostname('internal.server.local'), ResolverSecurityError);
  assert.throws(() => assertSafeHostname('meta-data.internal'), ResolverSecurityError);
  assert.throws(() => assertSafeHostname('127.0.0.1'), ResolverSecurityError);
  assert.throws(() => assertSafeHostname('169.254.169.254'), ResolverSecurityError);
  assert.doesNotThrow(() => assertSafeHostname('example.org'));
});

test('rejects hostnames resolving to private addresses before connecting', async () => {
  const original = dns.lookup;
  dns.lookup = ((_host: string, options: any, callback: any) => {
    if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }]);
    else callback(null, '127.0.0.1', 4);
  }) as typeof dns.lookup;
  try {
    await assert.rejects(resolveOpenAjang('http://public.example/event'), ResolverSecurityError);
  } finally {
    dns.lookup = original;
  }
});

test('assertSafeUrl rejects forbidden schemes and user credentials', () => {
  assert.throws(() => assertSafeUrl('ftp://example.org/test'), ResolverSecurityError);
  assert.throws(() => assertSafeUrl('file:///etc/passwd'), ResolverSecurityError);
  assert.throws(() => assertSafeUrl('javascript:alert(1)'), ResolverSecurityError);
  assert.throws(() => assertSafeUrl('https://user:pass@example.org/event.json'), ResolverSecurityError);
  assert.throws(() => assertSafeUrl('https://@example.org/event.json'), ResolverSecurityError);
  assert.doesNotThrow(() => assertSafeUrl('https://example.org/event.json'));
});

test('rejects mixed DNS answers containing private addresses', async () => {
  const original = dns.lookup;
  dns.lookup = ((_host: string, options: any, callback: any) => {
    if (options.all) callback(null, [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    else callback(null, '127.0.0.1', 4);
  }) as typeof dns.lookup;
  try {
    await assert.rejects(resolveOpenAjang('http://public.example/event'), ResolverSecurityError);
  } finally {
    dns.lookup = original;
  }
});

test('rejects redirect loops, malformed responses and unsupported encoding', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/loop') { res.writeHead(302, { Location: '/loop' }); res.end(); }
    else if (req.url === '/utf8') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(Buffer.from([0xff])); }
    else if (req.url === '/gzip') { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }); res.end('not gzip'); }
    else if (req.url === '/encoding') { res.writeHead(200, { 'Content-Encoding': 'unknown' }); res.end(); }
    else if (req.url === '/truncated') { res.writeHead(200, { 'Content-Length': '100' }); res.write('partial'); res.socket?.destroy(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    for (const path of ['/loop', '/utf8', '/gzip', '/encoding', '/truncated']) {
      await assert.rejects(resolveOpenAjang(base + path, { allowPrivateIps: true, timeoutMs: 1000, maxRedirects: 2 }), path);
    }
  } finally { server.close(); }
});

test('rejects an untrusted TLS certificate', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openajang-tls-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
    '-out', cert, '-days', '1', '-subj', '/CN=localhost'], { stdio: 'ignore' });
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (_req, res) => res.end('{}'));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await assert.rejects(resolveOpenAjang(`https://127.0.0.1:${(server.address() as any).port}/`, { allowPrivateIps: true }),
      (error: any) => error.code === 'DEPTH_ZERO_SELF_SIGNED_CERT');
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('rejects HTTPS redirects to HTTP even when private addresses are allowed', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'openajang-downgrade-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key,
    '-out', cert, '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
  const server = https.createServer({ key: fs.readFileSync(key), cert: fs.readFileSync(cert) }, (_req, res) => {
    res.writeHead(302, { Location: 'http://127.0.0.1/event' }); res.end();
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `https://127.0.0.1:${(server.address() as any).port}/`;
    const code = `import { resolveOpenAjang } from './packages/resolver/dist/index.js';
      try { await resolveOpenAjang(${JSON.stringify(url)}, { allowPrivateIps: true }); process.exitCode = 1; }
      catch (error) { if (!error.message.includes('Security downgrade rejected')) throw error; }`;
    await promisify(execFile)(process.execPath, ['--input-type=module', '-e', code], {
      cwd: ROOT, env: { ...process.env, NODE_EXTRA_CA_CERTS: cert }
    });
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('discovery url normalization per SPEC section 8.2', () => {
  assert.strictEqual(
    normalizeDiscoveryUrl('HTTPS://EXAMPLE.ORG:443/a/../b#part'),
    'https://example.org/b'
  );
  assert.strictEqual(
    normalizeDiscoveryUrl('https://example.org/a//b'),
    'https://example.org/a//b'
  );
  assert.notStrictEqual(
    normalizeDiscoveryUrl('https://example.org/a'),
    normalizeDiscoveryUrl('https://example.org/a/')
  );
  assert.notStrictEqual(
    normalizeDiscoveryUrl('https://example.org/?a=1&b=2'),
    normalizeDiscoveryUrl('https://example.org/?b=2&a=1')
  );
});

test('discoverOpenAjangUrl parses link in head and ignores base tag with real html parser', () => {
  const link = '<link rel="alternate" type="application/vnd.openajang+json" href="event.json">';
  const html = `<head><base href="https://wrong.example/"><link rel="ALTERNATE" type="APPLICATION/VND.OPENAJANG+JSON" href="event.json"></head>`;
  assert.strictEqual(
    discoverOpenAjangUrl(html, 'https://example.org/events/page'),
    'https://example.org/events/event.json'
  );

  // Duplicates of identical link resolved are deduplicated
  assert.strictEqual(
    discoverOpenAjangUrl(`<head>${link}${link}</head>`, 'https://example.org/events/page'),
    'https://example.org/events/event.json'
  );

  // Link in body is ignored
  assert.strictEqual(
    discoverOpenAjangUrl(`<body>${link}</body>`, 'https://example.org/events/page'),
    null
  );
  assert.strictEqual(discoverOpenAjangUrl(`<head><!-- ${link} --><script>${JSON.stringify(link)}</script></head>`, 'https://example.org/'), null);

  // Ambiguous links throw
  const link2 = '<link rel="alternate" type="application/vnd.openajang+json" href="other.json">';
  assert.throws(
    () => discoverOpenAjangUrl(`<head>${link}${link2}</head>`, 'https://example.org/events/page'),
    ResolverDiscoveryError
  );

  // Exceeding byte limit throws
  const giant = 'x'.repeat(1048577);
  assert.throws(
    () => discoverOpenAjangUrl(giant, 'https://example.org/'),
    ResolverDiscoveryError
  );
});

test('end-to-end resolution with mock server', async () => {
  const sampleEventRaw = fs.readFileSync(
    path.join(EXAMPLES_DIR, 'pycon-davao-2026.openajang.json'),
    'utf-8'
  );
  const sampleEvent = JSON.parse(sampleEventRaw);

  const server = http.createServer((req, res) => {
    if (req.url === '/direct.json') {
      res.writeHead(200, { 'Content-Type': 'application/vnd.openajang+json' });
      res.end(sampleEventRaw);
    } else if (req.url === '/page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Event Page</title>
  <link rel="alternate" type="application/vnd.openajang+json" href="/direct.json">
</head>
<body><h1>PyCon Davao</h1></body>
</html>`);
    } else if (req.url === '/canonical-page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<head><link rel="canonical" href="${sampleEvent.url}"><link rel="alternate" type="application/vnd.openajang+json" href="/direct.json"></head>`);
    } else if (req.url === '/redirect-page') {
      res.writeHead(302, { Location: '/page' });
      res.end();
    } else if (req.url === '/invalid.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"broken": true}');
    } else if (req.url === '/huge.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('x'.repeat(2000000));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Direct JSON resolution
    const directRes = await resolveOpenAjang(`${baseUrl}/direct.json`, { allowPrivateIps: true });
    assert.strictEqual(directRes.event.title, sampleEvent.title);
    assert.strictEqual(directRes.provenance.viaDiscovery, false);
    assert.strictEqual(directRes.provenance.sourceHost, '127.0.0.1');

    // HTML Discovery resolution
    const htmlRes = await resolveOpenAjang(`${baseUrl}/page`, { allowPrivateIps: true });
    assert.strictEqual(htmlRes.event.title, sampleEvent.title);
    assert.strictEqual(htmlRes.provenance.viaDiscovery, true);
    assert.strictEqual(htmlRes.provenance.finalEventUrl, `${baseUrl}/page`);
    assert.strictEqual(htmlRes.provenance.documentUrl, `${baseUrl}/direct.json`);
    const canonicalRes = await resolveOpenAjang(`${baseUrl}/canonical-page`, { allowPrivateIps: true });
    assert.deepStrictEqual(canonicalRes.relationshipWarnings, []);

    // Redirect followed
    const redirRes = await resolveOpenAjang(`${baseUrl}/redirect-page`, { allowPrivateIps: true });
    assert.strictEqual(redirRes.event.title, sampleEvent.title);
    assert.strictEqual(redirRes.provenance.redirectHistory.length, 1);

    // Default SSRF protection blocks 127.0.0.1 without allowPrivateIps
    await assert.rejects(
      async () => resolveOpenAjang(`${baseUrl}/direct.json`),
      ResolverSecurityError
    );

    // Invalid JSON fails validation
    await assert.rejects(
      async () => resolveOpenAjang(`${baseUrl}/invalid.json`, { allowPrivateIps: true })
    );

    // Oversized response fails
    await assert.rejects(
      async () => resolveOpenAjang(`${baseUrl}/huge.json`, { allowPrivateIps: true }),
      ResolverSecurityError
    );
  } finally {
    server.close();
  }
});

test('compressed response streaming and decompression bomb defense', async () => {
  const sampleEventRaw = fs.readFileSync(
    path.join(EXAMPLES_DIR, 'pycon-davao-2026.openajang.json'),
    'utf-8'
  );
  const sampleEvent = JSON.parse(sampleEventRaw);

  const server = http.createServer((req, res) => {
    if (req.url === '/gzip-event.json') {
      res.writeHead(200, {
        'Content-Type': 'application/vnd.openajang+json',
        'Content-Encoding': 'gzip'
      });
      const gz = zlib.createGzip();
      gz.pipe(res);
      gz.end(sampleEventRaw);
    } else if (req.url === '/decompression-bomb.json') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip'
      });
      const gz = zlib.createGzip();
      gz.pipe(res);
      // Send 5 MB of compressed whitespace/zeros
      gz.write(Buffer.alloc(5 * 1024 * 1024, 0x20));
      gz.end();
    }
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Normal gzip stream decompresses properly
    const res = await resolveOpenAjang(`${baseUrl}/gzip-event.json`, { allowPrivateIps: true });
    assert.strictEqual(res.event.title, sampleEvent.title);

    // Decompression bomb is detected and terminated while streaming
    await assert.rejects(
      async () => resolveOpenAjang(`${baseUrl}/decompression-bomb.json`, {
        allowPrivateIps: true,
        maxJsonBytes: 100 * 1024 // 100 KB limit
      }),
      ResolverSecurityError
    );
  } finally {
    server.close();
  }
});

test('timeout is maintained through slow response body streaming', async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write('{"title": "Slow');
    // Intentionally keep connection open without finishing body
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await assert.rejects(
      async () => resolveOpenAjang(`${baseUrl}/slow`, {
        allowPrivateIps: true,
        timeoutMs: 300 // aborts within 300ms even though headers arrived
      }),
      ResolverSecurityError
    );
  } finally {
    server.close();
  }
});
