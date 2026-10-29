import { Parser } from 'htmlparser2';
import { MEDIA_TYPE } from '@openajang/core';
import { ResolverDiscoveryError } from './types.js';

/**
 * Removes dot segments ('..' and '.') according to RFC 3986 section 5.2.4.
 */
export function removeDotSegments(path: string): string {
  let input = path;
  let output = '';

  while (input.length > 0) {
    if (input.startsWith('../')) {
      input = input.slice(3);
    } else if (input.startsWith('./')) {
      input = input.slice(2);
    } else if (input.startsWith('/./')) {
      input = input.slice(2);
    } else if (input === '/.') {
      input = '/';
    } else if (input.startsWith('/../')) {
      input = input.slice(3);
      const lastSlash = output.lastIndexOf('/');
      output = lastSlash >= 0 ? output.slice(0, lastSlash) : '';
    } else if (input === '/..') {
      input = '/';
      const lastSlash = output.lastIndexOf('/');
      output = lastSlash >= 0 ? output.slice(0, lastSlash) : '';
    } else if (input === '.' || input === '..') {
      input = '';
    } else {
      let cut = -1;
      if (input.startsWith('/')) {
        cut = input.indexOf('/', 1);
      } else {
        cut = input.indexOf('/');
      }
      if (cut < 0) {
        output += input;
        input = '';
      } else {
        output += input.slice(0, cut);
        input = input.slice(cut);
      }
    }
  }
  return output;
}

/**
 * Normalizes a URL for OpenAjang discovery comparisons according to SPEC section 8.2:
 * - Lowercase scheme and host
 * - Remove default ports (80 for http, 443 for https)
 * - Resolve dot segments in path
 * - Use '/' for empty HTTP path
 * - Remove fragments
 * - Preserve query order and path case
 * - Do not equate HTTP and HTTPS or strip trailing slashes
 */
export function normalizeDiscoveryUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ResolverDiscoveryError(`Invalid discovery URL: ${rawUrl}`);
  }

  const scheme = parsed.protocol.toLowerCase();
  if (scheme !== 'http:' && scheme !== 'https:') {
    throw new ResolverDiscoveryError(`Invalid scheme in discovery URL: ${scheme}`);
  }

  let host = parsed.hostname.toLowerCase();
  if (host.includes(':')) {
    host = `[${host.replace(/^\[|\]$/g, '')}]`;
  }

  const port = parsed.port;
  if (port) {
    const pNum = Number(port);
    if (!((scheme === 'https:' && pNum === 443) || (scheme === 'http:' && pNum === 80))) {
      host += `:${port}`;
    }
  }

  const cleanPath = removeDotSegments(parsed.pathname) || '/';
  const query = parsed.search; // includes '?' if query present, preserves order

  return `${scheme}//${host}${cleanPath}${query}`;
}

/**
 * Discovers the OpenAjang document URL from HTML contents per SPEC section 8.2:
 * - Real HTML parsing using htmlparser2
 * - Scans <head> only
 * - Checks rel="alternate" and type="application/vnd.openajang+json"
 * - Resolves href against final HTML URL, strictly ignoring <base> elements
 * - Deduplicates normalized URLs
 * - Rejects ambiguity (multiple distinct OpenAjang links)
 * - Returns discovered URL string, or null if none
 */
export function discoverOpenAjangUrl(
  html: string,
  finalHtmlUrl: string,
  maxHtmlBytes = 1048576
): string | null {
  return discoverLinks(html, finalHtmlUrl, maxHtmlBytes).documentUrl;
}

export function discoverLinks(html: string, finalHtmlUrl: string, maxHtmlBytes = 1048576): { documentUrl: string | null; canonicalUrl: string | null } {
  const byteLen = Buffer.byteLength(html, 'utf-8');
  if (byteLen > maxHtmlBytes) {
    throw new ResolverDiscoveryError(
      `HTML discovery input (${byteLen} bytes) exceeds limit (${maxHtmlBytes} bytes)`
    );
  }

  let inHead = false;
  const candidates = new Set<string>();
  const canonicals = new Set<string>();

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const tag = name.toLowerCase();
        if (tag === 'head') {
          inHead = true;
        } else if (tag === 'body') {
          inHead = false;
        } else if (tag === 'link' && inHead) {
          const rel = (attribs.rel || '').toLowerCase().split(/\s+/);
          const type = (attribs.type || '').split(';')[0].trim().toLowerCase();
          const href = attribs.href;
          if (rel.includes('canonical') && href) {
            try { canonicals.add(normalizeDiscoveryUrl(new URL(href, finalHtmlUrl).toString())); } catch { /* Ignore invalid links. */ }
          }
          if (rel.includes('alternate') && type === MEDIA_TYPE && href) {
            try {
              // Resolve href directly against finalHtmlUrl, deliberately ignoring <base> tags
              const resolved = new URL(href, finalHtmlUrl).toString();
              candidates.add(normalizeDiscoveryUrl(resolved));
            } catch {
            }
          }
        }
      },
      onclosetag(name) {
        if (name.toLowerCase() === 'head') {
          inHead = false;
        }
      }
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true }
  );

  parser.write(html);
  parser.end();

  if (candidates.size > 1) {
    throw new ResolverDiscoveryError(
      'Ambiguous OpenAjang links: multiple distinct alternate endpoints found in HTML head'
    );
  }

  const it = candidates.values().next();
  return { documentUrl: it.done ? null : it.value, canonicalUrl: canonicals.size === 1 ? [...canonicals][0] : null };
}
