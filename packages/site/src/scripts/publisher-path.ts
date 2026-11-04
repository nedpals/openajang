import { FILE_SUFFIX, normalizeFilename } from './filename.ts';

/** A site root for static event pages; reject credentials, query strings and fragments. */
export function publisherBase(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function publisherEventUrl(base: string, filename: string): string | null {
  const root = publisherBase(base);
  if (!root) return null;
  const name = normalizeFilename(filename, `event${FILE_SUFFIX}`);
  return new URL(`events/${name.slice(0, -FILE_SUFFIX.length)}/`, root).href;
}
