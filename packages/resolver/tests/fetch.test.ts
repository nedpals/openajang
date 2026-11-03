import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  resolveOpenAjang,
  createFetchTransport,
  ResolverSecurityError,
  ResolverDiscoveryError,
  type Transport
} from '../dist/fetch.js';
import { MEDIA_TYPE } from '@openajang/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EVENT = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../examples/pycon-davao-2026.openajang.json'), 'utf8')
);
const EVENT_TEXT = JSON.stringify(EVENT);
const JSON_HEADERS = { 'content-type': MEDIA_TYPE };

function jsonResponse(text = EVENT_TEXT): Response {
  return new Response(text, { status: 200, headers: JSON_HEADERS });
}

test('fetch transport resolves a direct JSON document', async () => {
  const transport = createFetchTransport({
    fetch: async () => jsonResponse()
  });
  const result = await resolveOpenAjang('https://example.org/event.json', { transport });
  assert.equal(result.event.title, EVENT.title);
  assert.equal(result.provenance.viaDiscovery, false);
  assert.equal(result.provenance.documentUrl, 'https://example.org/event.json');
});

test('fetch transport follows redirects and applies validateRedirect', async () => {
  const seen: string[] = [];
  let calls = 0;
  const transport = createFetchTransport({
    fetch: async (input) => {
      calls++;
      if (calls === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: 'https://example.org/final.json' }
        });
      }
      assert.equal(String(input), 'https://example.org/final.json');
      return jsonResponse();
    }
  });

  const result = await resolveOpenAjang('https://example.org/start', {
    transport,
    validateRedirect: (from, to) => {
      seen.push(`${from} -> ${to}`);
    }
  });

  assert.equal(result.event.title, EVENT.title);
  assert.deepEqual(seen, ['https://example.org/start -> https://example.org/final.json']);
  assert.deepEqual(result.provenance.redirectHistory, ['https://example.org/start']);
});

test('fetch transport strips browser-restricted headers', async () => {
  let seen: Record<string, string> = {};
  const transport = createFetchTransport({
    fetch: async (_input, init) => {
      seen = (init?.headers ?? {}) as Record<string, string>;
      return jsonResponse();
    }
  });

  await resolveOpenAjang('https://example.org/event.json', { transport });
  const names = Object.keys(seen).map((key) => key.toLowerCase());
  assert.equal(names.includes('accept-encoding'), false);
  assert.equal(names.includes('user-agent'), false);
});

test('fetch transport follows a real redirect and decompresses gzip', async () => {
  const payload = JSON.stringify(EVENT);
  const server = createServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { location: '/event.json' });
      res.end();
      return;
    }
    if (req.url === '/event.json') {
      res.writeHead(200, { 'content-type': MEDIA_TYPE, 'content-encoding': 'gzip' });
      res.end(gzipSync(payload));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;

  try {
    const transport = createFetchTransport();
    const result = await resolveOpenAjang(`http://127.0.0.1:${port}/start`, {
      allowPrivateIps: true,
      transport
    });
    assert.equal(result.event.title, EVENT.title);
    assert.deepEqual(result.provenance.redirectHistory, [`http://127.0.0.1:${port}/start`]);
  } finally {
    server.close();
  }
});

test('fetch transport rejects private DNS answers before fetching', async () => {
  let fetched = false;
  const transport = createFetchTransport({
    dnsLookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetch: async () => {
      fetched = true;
      return jsonResponse();
    }
  });

  await assert.rejects(
    resolveOpenAjang('https://public.example/event.json', { transport }),
    ResolverSecurityError
  );
  assert.equal(fetched, false);
});

test('fetch transport reports opaque browser redirects clearly', async () => {
  const transport = createFetchTransport({
    fetch: async () =>
      ({
        type: 'opaqueredirect',
        status: 0,
        headers: new Headers(),
        body: null
      }) as unknown as Response
  });

  await assert.rejects(
    resolveOpenAjang('https://example.org/start', { transport }),
    /Redirects cannot be followed in this browser context/
  );
});

test('the deadline covers DNS lookups', async () => {
  const transport = createFetchTransport({
    dnsLookup: async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return [{ address: '8.8.8.8', family: 4 }];
    },
    fetch: async () => jsonResponse()
  });

  const started = Date.now();
  await assert.rejects(
    resolveOpenAjang('https://public.example/event.json', { transport, timeoutMs: 150 }),
    ResolverSecurityError
  );
  assert.ok(Date.now() - started < 1000, 'deadline should fire before the lookup finishes');
});

test('the deadline covers a transport that ignores the signal', async () => {
  const transport: Transport = {
    async request() {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { status: 200, headers: JSON_HEADERS, text: EVENT_TEXT };
    }
  };

  const started = Date.now();
  await assert.rejects(
    resolveOpenAjang('https://example.org/event.json', { transport, timeoutMs: 150 }),
    ResolverSecurityError
  );
  assert.ok(Date.now() - started < 1000, 'deadline should not wait for the transport');
});

test('fetch transport rejects oversized and invalid UTF-8 bodies', async () => {
  const transport = createFetchTransport({
    fetch: async () => new Response('0123456789', { status: 200 })
  });
  await assert.rejects(
    transport.request({
      url: new URL('https://example.org/event.json'),
      headers: {},
      signal: AbortSignal.timeout(1000),
      maxBytes: 5,
      allowPrivateIps: false
    }),
    ResolverSecurityError
  );

  const badUtf8 = createFetchTransport({
    fetch: async () =>
      new Response(new Uint8Array([0xff, 0xfe]), {
        status: 200,
        headers: JSON_HEADERS
      })
  });
  await assert.rejects(
    badUtf8.request({
      url: new URL('https://example.org/event.json'),
      headers: {},
      signal: AbortSignal.timeout(1000),
      maxBytes: 1024,
      allowPrivateIps: false
    }),
    ResolverDiscoveryError
  );
});

test('a custom transport can stand in for the whole fetch path', async () => {
  const transport: Transport = {
    async request(req) {
      assert.equal(req.url.hostname, 'example.org');
      return { status: 200, headers: JSON_HEADERS, text: EVENT_TEXT };
    }
  };
  const result = await resolveOpenAjang('https://example.org/event.json', { transport });
  assert.equal(result.event.title, EVENT.title);
});
