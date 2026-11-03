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
 * Node entry point. Uses the Node transport for DNS pinning and socket checks
 * unless the caller supplies another transport.
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
