import type { OpenAjangEvent } from '@openajang/core';
import type { DnsLookup, Transport } from './transport.js';

export type { DnsEntry, DnsLookup, Transport, TransportRequest, TransportResponse } from './transport.js';

export interface ResolverOptions {
  /**
   * Maximum allowed redirects when following HTTP redirects.
   * Default: 5.
   */
  maxRedirects?: number;

  /**
   * Request timeout in milliseconds.
   * Default: 10000 (10s).
   */
  timeoutMs?: number;

  /**
   * Maximum allowed byte size for retrieved JSON documents.
   * Default: 1048576 (1 MiB).
   */
  maxJsonBytes?: number;

  /**
   * Maximum allowed byte size for retrieved HTML pages during discovery.
   * Default: 1048576 (1 MiB).
   */
  maxHtmlBytes?: number;

  /**
   * Whether to allow private or loopback IP ranges.
   * Default: false (enforces strict SSRF protections).
   */
  allowPrivateIps?: boolean;

  /**
   * HTTP transport override. When omitted, a portable Fetch transport is used.
   * Node consumers should import `@openajang/resolver/node` or pass
   * `createNodeTransport()` to keep DNS pinning.
   */
  transport?: Transport;

  /**
   * DNS resolver used by the built-in transports for pre-flight checks.
   * Ignored by a custom transport that does its own resolution.
   */
  dnsLookup?: DnsLookup;

  /**
   * Additional validation applied to every redirect before it is followed.
   * Throw to reject the redirect. Protocol downgrade checks always run first.
   */
  validateRedirect?: (from: URL, to: URL) => void;
}

export interface RetrievalProvenance {
  suppliedUrl: string;
  /** Final URL fetched from the supplied URL, after redirects. */
  finalFetchedUrl: string;
  documentUrl: string;
  /** Human-facing event URL declared by the document. */
  declaredEventUrl: string;
  retrievedAt: string;
  sourceHost: string;
  redirectHistory: string[];
  viaDiscovery: boolean;
  contentType: string;
}

export interface ResolvedEvent {
  event: OpenAjangEvent;
  provenance: RetrievalProvenance;
  relationshipWarnings: string[];
}

export class ResolverSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolverSecurityError';
  }
}

export class ResolverDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolverDiscoveryError';
  }
}
