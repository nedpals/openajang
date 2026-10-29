import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import stream from 'node:stream';
import { MEDIA_TYPE } from '@openajang/core';
import type { ResolverOptions } from './types.js';
import { assertSafeUrl, isPrivateOrReservedIPv4, isPrivateOrReservedIPv6 } from './security.js';
import { ResolverSecurityError, ResolverDiscoveryError } from './types.js';

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 1048576; // 1 MiB

interface FetchResult {
  status: number;
  headers: Record<string, string>;
  text: string;
  url: string;
  redirectHistory: string[];
}

/**
 * Performs a single secure HTTP/HTTPS request:
 * - Checks target URL credentials and syntax
 * - Enforces public destination IP during DNS resolution (anti-SSRF)
 * - Enforces public socket remoteAddress upon connection (anti-DNS rebinding)
 * - Maintains request timeout through the entire body stream
 * - Streams and caps raw/compressed byte limits
 * - Streams, decompresses (gzip, deflate, br), and caps decompressed byte limits
 */
function requestOnce(
  targetUrl: URL,
  options: ResolverOptions,
  maxRawBytes: number,
  maxDecompressedBytes: number
): Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
  location?: string;
}> {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const allowPrivate = options.allowPrivateIps ?? false;

    let timeoutTimer: NodeJS.Timeout | null = null;
    let settled = false;

    const cleanup = () => {
      settled = true;
      if (timeoutTimer) {
        clearTimeout(timeoutTimer);
        timeoutTimer = null;
      }
    };

    const fail = (err: Error) => {
      if (settled) return;
      cleanup();
      req.destroy();
      reject(err);
    };

    // DNS lookup hook: verify all resolved IP addresses before connection
    const customLookup = (
      hostname: string,
      lookupOpts: any,
      cb: (err: Error | null, address: any, family?: number) => void
    ) => {
      dns.lookup(hostname, lookupOpts, (err, address, family) => {
        if (err) return cb(err, address, family);

        if (!allowPrivate) {
          const addrs = Array.isArray(address)
            ? address
            : [{ address, family: family || (net.isIPv4(address) ? 4 : 6) }];

          for (const item of addrs) {
            const ip = typeof item === 'string' ? item : item.address;
            const bad = net.isIPv4(ip)
              ? isPrivateOrReservedIPv4(ip)
              : isPrivateOrReservedIPv6(ip);
            if (bad) {
              return cb(
                new ResolverSecurityError(
                  `SSRF blocked: host "${hostname}" resolved to non-public destination IP ${ip}`
                ),
                address,
                family
              );
            }
          }
        }

        cb(null, address, family);
      });
    };

    const reqOptions: http.RequestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname.replace(/^\[|\]$/g, ''),
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: 'GET',
      agent: false,
      headers: {
        Accept: `${MEDIA_TYPE}, application/json;q=0.9, text/html;q=0.8`,
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'OpenAjang-Resolver/0.1.0'
      },
      lookup: customLookup
    };

    if (isHttps) {
      if (!net.isIP(reqOptions.hostname as string)) (reqOptions as https.RequestOptions).servername = reqOptions.hostname as string;
    }

    const req = client.request(reqOptions, res => {
      const statusCode = res.statusCode || 0;
      res.on('error', fail);
      res.on('aborted', () => fail(new ResolverSecurityError('Response was aborted')));
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === 'string') headers[k.toLowerCase()] = v;
        else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ');
      }

      // Check redirect status
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        cleanup();
        res.destroy();
        resolve({
          status: statusCode,
          headers,
          text: '',
          location: headers['location']
        });
        return;
      }

      // Track raw compressed bytes
      let rawBytes = 0;
      res.on('data', chunk => {
        rawBytes += chunk.length;
        if (rawBytes > maxRawBytes) {
          fail(
            new ResolverSecurityError(
              `Response wire size (${rawBytes} bytes) exceeded raw limit (${maxRawBytes} bytes)`
            )
          );
        }
      });

      // Setup decompression stream
      const encoding = (headers['content-encoding'] || '').toLowerCase().trim();
      let decompressor: stream.Readable;

      if (encoding === 'gzip' || encoding === 'x-gzip') {
        decompressor = res.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        decompressor = res.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        decompressor = res.pipe(zlib.createBrotliDecompress());
      } else if (!encoding || encoding === 'identity') {
        decompressor = res;
      } else {
        fail(new ResolverSecurityError(`Unsupported Content-Encoding: "${encoding}"`));
        return;
      }

      decompressor.on('error', err => {
        fail(new ResolverSecurityError(`Decompression failed: ${err.message}`));
      });

      // Track decompressed bytes
      let decompressedBytes = 0;
      const chunks: Buffer[] = [];

      decompressor.on('data', (chunk: Buffer) => {
        decompressedBytes += chunk.length;
        if (decompressedBytes > maxDecompressedBytes) {
          fail(
            new ResolverSecurityError(
              `Decompressed response size (${decompressedBytes} bytes) exceeded limit (${maxDecompressedBytes} bytes)`
            )
          );
          return;
        }
        chunks.push(chunk);
      });

      decompressor.on('end', () => {
        cleanup();
        let text: string;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
        catch { reject(new ResolverDiscoveryError('Response is not valid UTF-8')); return; }
        resolve({
          status: statusCode,
          headers,
          text
        });
      });
    });

    // Enforce public actual connection destination against DNS rebinding
    req.on('socket', (socket: net.Socket) => {
      const verifySocketDestination = () => {
        const remoteIp = socket.remoteAddress;
        if (!remoteIp) return;
        if (!allowPrivate) {
          const bad = net.isIPv4(remoteIp)
            ? isPrivateOrReservedIPv4(remoteIp)
            : isPrivateOrReservedIPv6(remoteIp);
          if (bad) {
            fail(
              new ResolverSecurityError(
                `SSRF blocked: connection connected to non-public actual destination IP ${remoteIp}`
              )
            );
          }
        }
      };

      if (socket.connecting) {
        socket.once('connect', verifySocketDestination);
      } else {
        verifySocketDestination();
      }
    });

    req.on('error', err => {
      fail(err);
    });

    // Timeout maintained across entire request and response body stream
    timeoutTimer = setTimeout(() => {
      fail(new ResolverSecurityError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.end();
  });
}

/**
 * Performs a safe HTTP/HTTPS fetch following redirects up to maxRedirects
 * with security checks on every single hop.
 */
export async function safeFetchWithRedirects(
  initialUrlString: string,
  options: ResolverOptions,
  maxDecompressedBytes: number
): Promise<FetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowPrivate = options.allowPrivateIps ?? false;
  const maxRawBytes = maxDecompressedBytes;

  let currentUrlString = initialUrlString;
  const redirectHistory: string[] = [];

  for (let hop = 0; hop <= maxRedirects; hop++) {
    // Assert URL syntax, scheme, and hostname safety
    const validatedUrl = assertSafeUrl(currentUrlString, allowPrivate);

    const result = await requestOnce(
      validatedUrl,
      options,
      maxRawBytes,
      maxDecompressedBytes
    );

    if (result.location) {
      const nextUrl = new URL(result.location, currentUrlString).toString();

      // Forbid HTTPS to HTTP security downgrade across redirects
      if (validatedUrl.protocol === 'https:' && new URL(nextUrl).protocol === 'http:') {
        throw new ResolverSecurityError(
          `Security downgrade rejected: redirect from HTTPS to HTTP (${nextUrl})`
        );
      }

      redirectHistory.push(currentUrlString);
      currentUrlString = nextUrl;
      continue;
    }

    return {
      status: result.status,
      headers: result.headers,
      text: result.text,
      url: currentUrlString,
      redirectHistory
    };
  }

  throw new ResolverSecurityError(`Too many redirects (exceeded limit of ${maxRedirects})`);
}
