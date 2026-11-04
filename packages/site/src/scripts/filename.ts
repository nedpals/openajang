export const FILE_SUFFIX = '.openajang.json';
const MAX_SLUG = 60;

export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= MAX_SLUG) return slug;
  const cut = slug.slice(0, MAX_SLUG);
  const boundary = cut.lastIndexOf('-');
  return (boundary > 0 ? cut.slice(0, boundary) : cut).replace(/-+$/, '');
}

/**
 * `YYYY-MM-DD-slug.openajang.json`, so files sort by start date. The date is the start as written
 * (a date, or the date part of a date-time). A missing date or title is left out; with neither,
 * the name is `event.openajang.json`.
 */
export function eventFilename(title: unknown, startsAt: unknown): string {
  const date = typeof startsAt === 'string' ? /^\d{4}-\d{2}-\d{2}/.exec(startsAt)?.[0] : undefined;
  const slug = typeof title === 'string' ? slugify(title) : '';
  return `${[date, slug || (date ? '' : 'event')].filter(Boolean).join('-')}${FILE_SUFFIX}`;
}

/** Makes typed input safe as a file name: lowercase letters, digits and hyphens, ending in `.openajang.json`. */
export function normalizeFilename(input: string, fallback: string): string {
  const base = slugify(input.trim().replace(/(\.openajang)?\.json$/i, '').replace(/\./g, '-'));
  return base ? `${base}${FILE_SUFFIX}` : fallback;
}
