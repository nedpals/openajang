import { validate, parseJsonStrict, MEDIA_TYPE } from '@openajang/core';
import type { ResolverOptions, ResolvedEvent, RetrievalProvenance } from './types.js';
import { discoverLinks, normalizeDiscoveryUrl } from './discovery.js';
import { ResolverSecurityError, ResolverDiscoveryError } from './types.js';
import { safeFetchWithRedirects } from './transport.js';

const DEFAULT_MAX_BYTES = 1048576;

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

  const firstFetch = await safeFetchWithRedirects(
    urlString,
    options,
    Math.max(maxJsonBytes, maxHtmlBytes)
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
    if (Buffer.byteLength(firstFetch.text, 'utf8') > maxJsonBytes) {
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

    const jsonFetch = await safeFetchWithRedirects(documentUrl, options, maxJsonBytes);
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
