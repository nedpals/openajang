/** One DNS answer selected for a request. */
export interface DnsEntry {
  address: string;
  family: 4 | 6;
}

/**
 * Optional DNS resolver used by the built-in transports to reject private
 * destinations before a connection is made.
 */
export type DnsLookup = (hostname: string) => Promise<DnsEntry[]>;

export interface TransportRequest {
  url: URL;
  headers: Record<string, string>;
  /** Resolver-owned deadline covering DNS, redirects, and the response body. */
  signal: AbortSignal;
  /** Maximum decoded body size. Adapters must stop reading past this. */
  maxBytes: number;
  allowPrivateIps: boolean;
  /** Per-request resolver override; adapters may ignore it. */
  dnsLookup?: DnsLookup;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  /** Decoded UTF-8 body, already capped at maxBytes. Empty for redirects. */
  text: string;
}

/**
 * A single HTTP hop. Redirects, URL policy, content types, and provenance are
 * owned by the resolver so every adapter behaves the same way.
 */
export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}

export const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export function isRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}
