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

export { resolveOpenAjang } from './resolver.js';

export { createFetchTransport } from './transport-fetch.js';
export type { FetchTransportOptions } from './transport-fetch.js';
