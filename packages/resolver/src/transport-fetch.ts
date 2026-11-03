import { ResolverSecurityError, ResolverDiscoveryError } from './types.js';
import { isPrivateOrReservedIPv4, isPrivateOrReservedIPv6 } from './security.js';
import type { DnsEntry, DnsLookup, Transport, TransportRequest, TransportResponse } from './transport.js';
import { concatBytes, decodeUtf8, headersToRecord } from './platform.js';

export interface FetchTransportOptions {
  fetch?: typeof globalThis.fetch;
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

function timeoutError(): ResolverSecurityError {
  return new ResolverSecurityError('Request timed out');
}

async function readBody(
  response: Response,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new ResolverSecurityError(
          `Response body exceeded limit of ${maxBytes} bytes`
        );
      }
      chunks.push(value);
    }
  } catch (err) {
    if (err instanceof ResolverSecurityError) throw err;
    if (signal.aborted) throw timeoutError();
    throw new ResolverSecurityError(
      `Response stream error: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  try {
    return decodeUtf8(concatBytes(chunks, received));
  } catch {
    throw new ResolverDiscoveryError('Response is not valid UTF-8');
  }
}

/**
 * Fetch-based transport. Fetch cannot expose the connected address, so this
 * adapter cannot pin DNS. A supplied dnsLookup is checked before the request,
 * which still leaves a time-of-check/time-of-use window. On platforms with
 * egress controls, such as Cloudflare Workers, the platform blocks private
 * network access.
 */
export function createFetchTransport(options: FetchTransportOptions = {}): Transport {
  return {
    async request(input: TransportRequest): Promise<TransportResponse> {
      const { url, headers, signal, maxBytes, allowPrivateIps } = input;
      if (signal.aborted) throw timeoutError();

      const lookup = input.dnsLookup ?? options.dnsLookup;
      if (lookup && !allowPrivateIps) {
        const hostname = url.hostname.replace(/^\[|\]$/g, '');
        const entries = await lookup(hostname);
        if (entries.length === 0) {
          throw new ResolverSecurityError(`DNS resolution returned no addresses for "${hostname}"`);
        }
        validateEntries(hostname, entries);
      }

      const requestHeaders: Record<string, string> = { ...headers };
      // Accept-Encoding is a forbidden request header in browsers and fetch
      // negotiates decoding itself. Node's transport keeps its own header.
      delete requestHeaders['accept-encoding'];

      let response: Response;
      try {
        response = await (options.fetch ?? globalThis.fetch)(url.toString(), {
          method: 'GET',
          headers: requestHeaders,
          redirect: 'manual',
          signal
        });
      } catch (err) {
        if (signal.aborted) throw timeoutError();
        throw new ResolverSecurityError(
          `Request error: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const responseHeaders = headersToRecord(response.headers);
      if (response.status < 200 || response.status >= 300) {
        await response.body?.cancel().catch(() => {});
        return { status: response.status, headers: responseHeaders, text: '' };
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number.parseInt(contentLength, 10) > maxBytes) {
        await response.body?.cancel().catch(() => {});
        throw new ResolverSecurityError(
          `Content-Length ${contentLength} exceeds limit of ${maxBytes} bytes`
        );
      }

      const text = await readBody(response, maxBytes, signal);
      return { status: response.status, headers: responseHeaders, text };
    }
  };
}
