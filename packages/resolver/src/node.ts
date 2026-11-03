import { createNodeTransport } from './transport-node.js';
import { resolveOpenAjang as resolvePortable } from './resolver.js';
import type { ResolverOptions, ResolvedEvent } from './types.js';

export type {
  ResolverOptions,
  ResolvedEvent,
  RetrievalProvenance,
  DnsEntry,
  DnsLookup,
  Transport,
  TransportRequest,
  TransportResponse
} from './types.js';

export {
  ResolverSecurityError,
  ResolverDiscoveryError
} from './types.js';

export {
  discoverOpenAjangUrl,
  normalizeDiscoveryUrl
} from './discovery.js';

export { createNodeTransport } from './transport-node.js';
export type { NodeTransportOptions } from './transport-node.js';

/**
 * Node entry point: keeps DNS pinning and actual-socket verification by using
 * the Node transport unless the caller supplies their own.
 */
export function resolveOpenAjang(
  urlString: string,
  options: ResolverOptions = {}
): Promise<ResolvedEvent> {
  return resolvePortable(urlString, {
    ...options,
    transport: options.transport ?? createNodeTransport({ dnsLookup: options.dnsLookup })
  });
}
