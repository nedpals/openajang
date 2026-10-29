import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { ResolverSecurityError } from './types.js';

function isNonPublic(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return true;
  const address = ipaddr.process(ip);
  if (address.range() !== 'unicast') return true;
  // IPv6 global unicast space; do not accept unspecified or reserved ranges.
  if (address.kind() === 'ipv6' && !address.match(ipaddr.parse('2000::'), 3)) return true;
  return false;
}

export function isPrivateOrReservedIPv4(ip: string): boolean {
  return !net.isIPv4(ip) || isNonPublic(ip);
}

export function isPrivateOrReservedIPv6(ip: string): boolean {
  const value = ip.replace(/^\[|\]$/g, '');
  return !net.isIPv6(value) || isNonPublic(value);
}

export function assertSafeHostname(hostname: string, allowPrivate = false): void {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!allowPrivate && (host === 'localhost' || host.endsWith('.localhost') ||
    host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') ||
    host.endsWith('.onion') || (net.isIP(host) !== 0 && isNonPublic(host)))) {
    throw new ResolverSecurityError(`Non-public destination: ${host}`);
  }
}

export function assertSafeUrl(urlString: string, allowPrivate = false): URL {
  let url: URL;
  try { url = new URL(urlString); } catch {
    throw new ResolverSecurityError(`Invalid URL: ${urlString}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ResolverSecurityError('Only HTTP(S) URLs are allowed');
  }
  if (url.username || url.password || /^https?:\/\/[^/?#]*@/i.test(urlString)) {
    throw new ResolverSecurityError('URL credentials are forbidden');
  }
  assertSafeHostname(url.hostname, allowPrivate);
  return url;
}
