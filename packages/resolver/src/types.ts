import type { OpenAjangEvent } from '@openajang/core';

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
