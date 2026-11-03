import { validate, parseJsonStrict, MEDIA_TYPE } from '@openajang/core';
import type { ResolverOptions, ResolvedEvent, RetrievalProvenance } from './types.js';
import { discoverLinks, normalizeDiscoveryUrl } from './discovery.js';
import { ResolverSecurityError, ResolverDiscoveryError } from './types.js';
import { assertSafeUrl } from './security.js';
import type { Transport, TransportResponse } from './transport.js';
import { isRedirectStatus } from './transport.js';
import { createFetchTransport } from './transport-fetch.js';
import { utf8ByteLength } from './platform.js';

const DEFAULT_MAX_REDIRECTS = 5;
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_BYTES = 1048576;

interface FetchResult {
  status: number;
  headers: Record<string, string>;
  text: string;
  url: string;
  redirectHistory: string[];
}

function defaultTransport(options: ResolverOptions): Transport {
  return createFetchTransport({ dnsLookup: options.dnsLookup });
}

function requestHeaders(): Record<string, string> {
  return {
    Accept: `${MEDIA_TYPE}, application/json;q=0.9, text/html;q=0.8`,
    'Accept-Encoding': 'gzip, deflate, br',
    'User-Agent': 'OpenAjang-Resolver/0.1.0'
  };
}

/**
 * Fetches one document, applying URL policy, downgrade checks, and optional
 * caller redirect checks on every hop.
 */
async function fetchWithRedirects(
  initialUrlString: string,
  options: ResolverOptions,
  maxBytes: number,
  transport: Transport,
  signal: AbortSignal
): Promise<FetchResult> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const allowPrivate = options.allowPrivateIps ?? false;
  const headers = requestHeaders();

  let currentUrlString = initialUrlString;
  const redirectHistory: string[] = [];

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validatedUrl = assertSafeUrl(currentUrlString, allowPrivate);

    let response: TransportResponse;
    try {
      response = await transport.request({
        url: validatedUrl,
        headers,
        signal,
        maxBytes,
        allowPrivateIps: allowPrivate,
        dnsLookup: options.dnsLookup
      });
    } catch (err) {
      if (signal.aborted) {
        throw new ResolverSecurityError(
          `Request timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
        );
      }
      throw err;
    }

    const location = response.headers['location'];
    if (isRedirectStatus(response.status) && location) {
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, currentUrlString);
      } catch {
        throw new ResolverDiscoveryError(`Invalid redirect location from ${currentUrlString}`);
      }

      if (validatedUrl.protocol === 'https:' && nextUrl.protocol === 'http:') {
        throw new ResolverSecurityError(
          `Security downgrade rejected: redirect from HTTPS to HTTP (${nextUrl.toString()})`
        );
      }

      options.validateRedirect?.(validatedUrl, nextUrl);

      redirectHistory.push(currentUrlString);
      currentUrlString = nextUrl.toString();
      continue;
    }

    if (isRedirectStatus(response.status)) {
      throw new ResolverDiscoveryError(
        `Redirect response from ${currentUrlString} is missing a Location header`
      );
    }

    return {
      status: response.status,
      headers: response.headers,
      text: response.text,
      url: currentUrlString,
      redirectHistory
    };
  }

  throw new ResolverSecurityError(`Too many redirects (exceeded limit of ${maxRedirects})`);
}

/**
 * Resolves an OpenAjang event from an Event URL or direct JSON URL:
 * - Checks SSRF and URL safety against non-public IPs and DNS rebinding
 * - If response is JSON, validates and returns with provenance
 * - If response is HTML, parses <head> for OpenAjang discovery link and fetches the JSON
 * - Checks relationship consistency between final HTML URL and event.url
 */
export async function resolveOpenAjang(
  urlString: string,
  options: ResolverOptions = {}
): Promise<ResolvedEvent> {
  const maxJsonBytes = options.maxJsonBytes ?? DEFAULT_MAX_BYTES;
  const maxHtmlBytes = options.maxHtmlBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const transport = options.transport ?? defaultTransport(options);
  const signal = AbortSignal.timeout(timeoutMs);

  const firstFetch = await fetchWithRedirects(
    urlString,
    options,
    Math.max(maxJsonBytes, maxHtmlBytes),
    transport,
    signal
  );

  if (firstFetch.status !== 200) {
    throw new ResolverDiscoveryError(`HTTP ${firstFetch.status} received from ${firstFetch.url}`);
  }

  const contentType = (firstFetch.headers['content-type'] || '').toLowerCase();
  const mime = contentType.split(';')[0].trim();

  let documentText: string;
  let documentUrl: string;
  let finalEventUrl: string;
  let viaDiscovery = false;
  let canonicalUrl: string | null = null;
  const redirectHistory = [...firstFetch.redirectHistory];
  let docContentType = contentType;

  if (mime === MEDIA_TYPE || mime === 'application/json') {
    if (utf8ByteLength(firstFetch.text) > maxJsonBytes) {
      throw new ResolverSecurityError('JSON response exceeds limit');
    }
    documentText = firstFetch.text;
    documentUrl = firstFetch.url;
    finalEventUrl = firstFetch.url;
  } else if (mime === 'text/html' || mime === 'application/xhtml+xml') {
    finalEventUrl = firstFetch.url;
    const links = discoverLinks(firstFetch.text, finalEventUrl, maxHtmlBytes);
    const discoveredLink = links.documentUrl;
    canonicalUrl = links.canonicalUrl;
    if (!discoveredLink) {
      throw new ResolverDiscoveryError(
        `No OpenAjang discovery link found in HTML <head> at ${finalEventUrl}`
      );
    }

    viaDiscovery = true;
    documentUrl = discoveredLink;

    const jsonFetch = await fetchWithRedirects(
      documentUrl,
      options,
      maxJsonBytes,
      transport,
      signal
    );
    if (jsonFetch.status !== 200) {
      throw new ResolverDiscoveryError(
        `Discovered OpenAjang endpoint returned HTTP ${jsonFetch.status}`
      );
    }

    const jsonMime = (jsonFetch.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (jsonMime !== MEDIA_TYPE && jsonMime !== 'application/json') {
      throw new ResolverDiscoveryError(
        `Discovered OpenAjang endpoint must return JSON, got Content-Type: ${jsonFetch.headers['content-type']}`
      );
    }

    documentText = jsonFetch.text;
    documentUrl = jsonFetch.url;
    docContentType = jsonFetch.headers['content-type'] || '';
    redirectHistory.push(...jsonFetch.redirectHistory);
  } else {
    throw new ResolverDiscoveryError(
      `Unsupported Content-Type "${contentType}". Expected ${MEDIA_TYPE}, application/json, or text/html.`
    );
  }

  const rawData = parseJsonStrict(documentText);
  const event = validate(rawData);

  const relationshipWarnings: string[] = [];

  if (viaDiscovery) {
    const normFinalHtml = normalizeDiscoveryUrl(finalEventUrl);
    const normEventUrl = normalizeDiscoveryUrl(event.url);
    if (normFinalHtml !== normEventUrl && canonicalUrl !== normEventUrl) {
      relationshipWarnings.push(
        `Document "url" (${event.url}) does not match the final discovered HTML page URL (${finalEventUrl}).`
      );
    }
  }

  const provenance: RetrievalProvenance = {
    suppliedUrl: urlString,
    finalFetchedUrl: firstFetch.url,
    documentUrl,
    declaredEventUrl: event.url,
    retrievedAt: new Date().toISOString(),
    sourceHost: new URL(documentUrl).hostname,
    redirectHistory,
    viaDiscovery,
    contentType: docContentType
  };

  return {
    event,
    provenance,
    relationshipWarnings
  };
}
