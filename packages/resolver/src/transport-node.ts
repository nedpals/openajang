import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import stream from 'node:stream';
import { ResolverSecurityError, ResolverDiscoveryError } from './types.js';
import { isPrivateOrReservedIPv4, isPrivateOrReservedIPv6 } from './security.js';
import type { DnsEntry, DnsLookup, Transport, TransportRequest, TransportResponse } from './transport.js';
import { concatBytes, decodeUtf8 } from './platform.js';

export interface NodeTransportOptions {
  dnsLookup?: DnsLookup;
}

function validateEntries(hostname: string, entries: readonly DnsEntry[]): void {
  for (const entry of entries) {
    const bad = entry.family === 6
      ? isPrivateOrReservedIPv6(entry.address)
      : isPrivateOrReservedIPv4(entry.address);
    if (bad) {
      throw new ResolverSecurityError(
        `SSRF blocked: host "${hostname}" resolved to non-public destination IP ${entry.address}`
      );
    }
  }
}

function lookupEntries(hostname: string, lookup?: DnsLookup): Promise<DnsEntry[]> {
  if (lookup) return lookup(hostname);
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(addresses.map((entry) => ({ address: entry.address, family: entry.family as 4 | 6 })));
    });
  });
}

async function pinnedLookup(
  hostname: string,
  allowPrivateIps: boolean,
  lookup?: DnsLookup
): Promise<{ address: string; family: 4 | 6 }> {
  if (net.isIPv4(hostname)) {
    if (!allowPrivateIps && isPrivateOrReservedIPv4(hostname)) {
      throw new ResolverSecurityError(`SSRF blocked: non-public destination IP ${hostname}`);
    }
    return { address: hostname, family: 4 };
  }
  if (net.isIPv6(hostname)) {
    if (!allowPrivateIps && isPrivateOrReservedIPv6(hostname)) {
      throw new ResolverSecurityError(`SSRF blocked: non-public destination IP ${hostname}`);
    }
    return { address: hostname, family: 6 };
  }

  const entries = await lookupEntries(hostname, lookup);
  if (entries.length === 0) {
    throw new ResolverSecurityError(`DNS resolution returned no addresses for "${hostname}"`);
  }
  if (!allowPrivateIps) validateEntries(hostname, entries);
  return entries[0];
}

function responseHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') out[key.toLowerCase()] = value;
    else if (Array.isArray(value)) out[key.toLowerCase()] = value.join(', ');
  }
  return out;
}

function timeoutError(): ResolverSecurityError {
  return new ResolverSecurityError('Request timed out');
}

/**
 * Node.js transport with DNS pinning, actual-socket destination verification,
 * bounded decompression, and raw/decompressed byte caps.
 */
export function createNodeTransport(options: NodeTransportOptions = {}): Transport {
  return {
    async request(input: TransportRequest): Promise<TransportResponse> {
      const { url, signal, maxBytes, allowPrivateIps } = input;

      if (signal.aborted) throw timeoutError();

      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      const hostname = url.hostname.replace(/^\[|\]$/g, '');
      const pinned = await pinnedLookup(
        hostname,
        allowPrivateIps,
        input.dnsLookup ?? options.dnsLookup
      );

      if (signal.aborted) throw timeoutError();

      return new Promise<TransportResponse>((resolve, reject) => {
        let request: http.ClientRequest | null = null;
        let settled = false;
        const fail = (err: Error) => {
          if (settled) return;
          settled = true;
          request?.destroy();
          reject(err);
        };

        const reqOptions: http.RequestOptions = {
          protocol: url.protocol,
          hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method: 'GET',
          agent: false,
          headers: input.headers,
          lookup: (_host, lookupOptions: any, callback: any) => {
            if (typeof lookupOptions === 'function') {
              callback = lookupOptions;
              lookupOptions = {};
            }
            if (lookupOptions && lookupOptions.all) {
              callback(null, [{ address: pinned.address, family: pinned.family }]);
            } else {
              callback(null, pinned.address, pinned.family);
            }
          },
          signal
        };

        if (isHttps && !net.isIP(hostname)) {
          (reqOptions as https.RequestOptions).servername = hostname;
        }

        request = client.request(reqOptions, (res) => {
          const status = res.statusCode || 0;
          const headers = responseHeaders(res.headers);

          res.on('error', fail);
          res.on('aborted', () => fail(new ResolverSecurityError('Response was aborted')));

          if (status >= 300 && status < 400) {
            settled = true;
            res.destroy();
            resolve({ status, headers, text: '' });
            return;
          }

          if (status < 200 || status >= 300) {
            settled = true;
            res.destroy();
            resolve({ status, headers, text: '' });
            return;
          }

          let rawBytes = 0;
          res.on('data', (chunk: Buffer) => {
            rawBytes += chunk.length;
            if (rawBytes > maxBytes) {
              fail(
                new ResolverSecurityError(
                  `Response wire size (${rawBytes} bytes) exceeded raw limit (${maxBytes} bytes)`
                )
              );
            }
          });

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

          decompressor.on('error', (err) => {
            fail(new ResolverSecurityError(`Decompression failed: ${err.message}`));
          });

          let decompressedBytes = 0;
          const chunks: Uint8Array[] = [];

          decompressor.on('data', (chunk: Buffer) => {
            decompressedBytes += chunk.length;
            if (decompressedBytes > maxBytes) {
              fail(
                new ResolverSecurityError(
                  `Decompressed response size (${decompressedBytes} bytes) exceeded limit (${maxBytes} bytes)`
                )
              );
              return;
            }
            chunks.push(chunk);
          });

          decompressor.on('end', () => {
            if (settled) return;
            settled = true;
            let text: string;
            try {
              text = decodeUtf8(concatBytes(chunks, decompressedBytes));
            } catch {
              reject(new ResolverDiscoveryError('Response is not valid UTF-8'));
              return;
            }
            resolve({ status, headers, text });
          });
        });

        const clientRequest = request;
        clientRequest.on('socket', (socket: net.Socket) => {
          const verify = () => {
            const remoteIp = socket.remoteAddress;
            if (!remoteIp || allowPrivateIps) return;
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
          };
          if (socket.connecting) socket.once('connect', verify);
          else verify();
        });

        clientRequest.on('error', (err) => {
          fail(signal.aborted ? timeoutError() : err);
        });

        clientRequest.end();
      });
    }
  };
}
