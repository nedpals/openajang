/** Drafts include both the imported baseline and editable values. */
export const DRAFT_LIMIT = 4 * 1024 * 1024;
const object = (v: unknown): v is Record<string, any> => v !== null && typeof v === 'object' && !Array.isArray(v);
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
function safeTree(v: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return true;
  if (Array.isArray(v)) return v.length <= 10000 && v.every(x => safeTree(x, depth + 1));
  return object(v) && Object.keys(v).length <= 10000 && Object.values(v).every(x => safeTree(x, depth + 1));
}
export function decodeDraft(value: unknown, names: string[]) {
  if (!object(value) || value.format !== 'openajang-builder-draft' || value.version !== 1 || !object(value.state)) throw new Error('Invalid or unsupported draft file.');
  const s = value.state;
  if (!safeTree(s) || !object(s.original) ||
    (s.original.tickets !== undefined && (!Array.isArray(s.original.tickets) || !s.original.tickets.every(object))) ||
    (s.original.previous_starts_at !== undefined && !strings(s.original.previous_starts_at)) ||
    ['starts_at', 'ends_at', 'url'].some(k => s.original[k] !== undefined && typeof s.original[k] !== 'string') ||
    typeof s.identity !== 'string' || !strings(s.edited) || s.edited.some((n: string) => !names.includes(n)) ||
    !strings(s.removedLocations) || s.removedLocations.some((n: string) => !['physical', 'virtual'].includes(n)) ||
    !Array.isArray(s.tickets) || !s.tickets.every(object) || typeof s.ticketsEdited !== 'boolean' ||
    (s.history !== undefined && (!Array.isArray(s.history) || !s.history.every((item: unknown) => object(item) && ['value', 'date', 'time', 'offset'].every(k => typeof item[k] === 'string') && typeof item.dirty === 'boolean'))) ||
    !object(s.values) || names.some(n => !Object.hasOwn(s.values, n) || typeof s.values[n] !== 'string') || !object(s.dates) ||
    ['start', 'end', ...['registration-opens', 'registration-closes'].filter(p => s.dates[p] !== undefined)].some(p => !object(s.dates[p]) || ['date', 'time', 'offset'].some(k => typeof s.dates[p][k] !== 'string') || typeof s.dates[p].dirty !== 'boolean')) throw new Error('Invalid or unsupported draft file.');
  return structuredClone(s);
}
export function encodeDraft(state: unknown, names: string[]): string {
  const envelope = { format: 'openajang-builder-draft', version: 1, state };
  decodeDraft(envelope, names);
  const text = JSON.stringify(envelope, null, 2) + '\n';
  if (new TextEncoder().encode(text).length > DRAFT_LIMIT) throw new Error('Draft exceeds the 4 MiB limit.');
  return text;
}
