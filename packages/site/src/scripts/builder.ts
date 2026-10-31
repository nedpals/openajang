import { Buffer } from 'buffer';
import { eventId, parseJsonStrict, SCHEMA_ID, validateSafe, type OpenAjangEvent } from '@openajang/core';
import { strToU8, zipSync } from 'fflate';

globalThis.Buffer = Buffer;
type RecordObject = Record<string, any>;
const form = document.querySelector<HTMLFormElement>('#builder-form')!;
const inputs = [...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]')];
const notice = document.querySelector<HTMLElement>('#notice')!;
const preview = document.querySelector<HTMLElement>('#preview')!;
const validation = document.querySelector<HTMLElement>('#validation')!;
const errors = document.querySelector<HTMLElement>('#errors')!;
const jsonButton = document.querySelector<HTMLButtonElement>('#json')!;
const zipButton = document.querySelector<HTMLButtonElement>('#zip')!;
let original: RecordObject;
let edited = new Set<string>();
let identity: string;
let removedLocations = new Set<string>();

function fresh(): RecordObject {
  return { $schema: SCHEMA_ID, type: 'event', id: `urn:uuid:${crypto.randomUUID()}`, url: '', title: '', status: 'scheduled', starts_at: '', location: { type: 'physical', physical: {} }, organizer: { name: '' }, updated_at: new Date().toISOString() };
}
function get(obj: RecordObject, path: string): any { return path.split('.').reduce((v, k) => v?.[k], obj); }
function set(obj: RecordObject, path: string, value: string) {
  const parts = path.split('.'); const last = parts.pop()!;
  let target = obj;
  for (const part of parts) {
    if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part])) target[part] = {};
    target = target[part];
  }
  if (value === '') delete target[last];
  else target[last] = path === 'registration.required' ? value === 'true' : path === 'previous_starts_at' ? value.split('\n').map(v => v.trim()).filter(Boolean) : value;
  // Remove only empty containers; preserve all unexposed properties.
  function prune(node: RecordObject, keys: string[]) {
    const key = keys.shift(); if (!key || !node[key] || typeof node[key] !== 'object') return;
    prune(node[key], keys);
    if (!Object.keys(node[key]).length) delete node[key];
  }
  prune(obj, parts.slice());
}
function record(): RecordObject {
  const result = structuredClone(original);
  for (const key of removedLocations) if (result.location) delete result.location[key];
  for (const input of inputs) if (edited.has(input.name)) set(result, input.name, input.value);
  if (result.location?.type === 'virtual' && result.location.physical && !Object.keys(result.location.physical).length) delete result.location.physical;
  // The URL is the identity when an imported document has no explicit ID.
  if (!original.id && result.url !== original.url && identity) result.id = identity;
  return result;
}
function load(value: RecordObject) {
  original = structuredClone(value); edited = new Set(); removedLocations = new Set();
  identity = typeof value.url === 'string' ? eventId(value as OpenAjangEvent) : '';
  for (const input of inputs) { const v = get(value, input.name); input.value = v == null ? '' : Array.isArray(v) ? v.join('\n') : String(v); }
  refresh();
}
function escape(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function link(value: unknown, label: string): string { const url = safeUrl(value); return url ? `<a href="${escape(url)}" rel="noopener noreferrer">${escape(label)}</a>` : ''; }
function render(event: RecordObject): string {
  const location = event.location || {}; const physical = location.physical || {}; const virtual = location.virtual || {}; const registration = event.registration;
  const venue = [physical.name, physical.address?.locality].filter(Boolean).map(escape).join(', ');
  const venueStatus = physical.status === 'tentative' ? ' (tentative)' : physical.status === 'to_be_announced' && venue ? ' (to be announced)' : '';
  const where = [location.type !== 'virtual' ? `${venue || 'Venue to be announced'}${venueStatus}` : '', location.type !== 'physical' ? (link(virtual.url, virtual.platform || 'Online event') || 'Online details to be announced') : ''].filter(Boolean).join(' · ');
  const date = event.starts_at ? escape(event.starts_at) + (event.ends_at ? ` – ${escape(event.ends_at)}` : '') + (/^\d{4}-\d\d-\d\d$/.test(event.starts_at) ? ' (time not specified)' : '') : 'Date to be announced';
  const reg = registration ? `${registration.required === true ? 'Registration required' : registration.required === false ? 'Registration not required' : 'Registration details'}${registration.status ? ` · ${escape(String(registration.status).replaceAll('_', ' '))}` : ''}${registration.instructions ? `<br>${escape(registration.instructions)}` : ''}${link(registration.url, 'Registration details') ? `<br>${link(registration.url, 'Registration details')}` : ''}` : 'Registration details not specified';
  return `<h3>${escape(event.title || 'Untitled event')}</h3>${event.summary ? `<p>${escape(event.summary)}</p>` : ''}<p><strong>Status:</strong> ${escape(event.status || 'Not specified')}${event.status_note ? ` — ${escape(event.status_note)}` : ''}</p><p><strong>When:</strong> ${date}${event.time_zone ? ` · ${escape(event.time_zone)}` : ''}</p><p><strong>Where:</strong> ${where || 'Location to be announced'}</p><p><strong>Organizer:</strong> ${escape(event.organizer?.name || 'Not specified')}</p><p><strong>Registration:</strong> ${reg}</p>${link(event.url, 'Event website') ? `<p>${link(event.url, 'Event website')}</p>` : ''}`;
}
function refresh() {
  const event = record(); preview.innerHTML = render(event);
  for (const input of inputs) { input.removeAttribute('aria-invalid'); input.parentElement?.querySelectorAll('.field-error').forEach(error => error.remove()); }
  errors.replaceChildren();
  let result;
  try { result = validateSafe(event); } catch { result = {valid:false, errors:[{path:'', message:'Validation could not complete.', code:'validation'}]}; }
  validation.textContent = result.valid ? 'This event passes the bundled OpenAjang checks.' : `${result.errors.length} problem(s) to fix before export.`;
  for (const error of result.errors) {
    const li = document.createElement('li'); li.textContent = `${error.path || 'Document'}: ${error.message}`; errors.append(li);
    let path = error.path.replace(/^\//, '').replaceAll('/', '.');
    const missing = error.message.match(/required property '([^']+)'/);
    if (missing) path = [path, missing[1]].filter(Boolean).join('.');
    const input = inputs.find(i => i.name === path);
    if (input) { input.setAttribute('aria-invalid', 'true'); const hint = document.createElement('span'); hint.className = 'field-error'; hint.textContent = error.message; input.parentElement?.append(hint); }
  }
  jsonButton.disabled = zipButton.disabled = !result.valid;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function same(a: RecordObject, b: RecordObject) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function exportRecord(): RecordObject | null {
  const event = record();
  if (!validateSafe(event).valid) { refresh(); return null; }
  if (!same(event, original)) event.updated_at = new Date(Math.max(Date.now(), Date.parse(original.updated_at) + 1 || 0)).toISOString();
  if (!validateSafe(event).valid) { notice.textContent = 'The updated event did not pass validation.'; return null; }
  // Subsequent downloads of the same revision use the same timestamp and record.
  original = structuredClone(event); edited.clear(); removedLocations.clear();
  return event;
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function html(event: RecordObject): string { return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(event.title)}</title><link rel="alternate" type="application/vnd.openajang+json" href="event.openajang.json"><style>body{font:1rem/1.6 system-ui,sans-serif;color:#29283d;background:#faf9f6;margin:0}main{max-width:45rem;margin:3rem auto;padding:0 1.25rem}h1{font-size:2rem}h3{font-size:1.6rem}a{color:#873816}p{overflow-wrap:anywhere}</style></head><body><main>${render(event)}</main></body></html>\n`; }
form.addEventListener('input', e => { const input = e.target as HTMLInputElement; if (input.name) { edited.add(input.name); refresh(); } });
form.addEventListener('change', e => { const input = e.target as HTMLInputElement; if (input.name) { edited.add(input.name); refresh(); } });
for (const key of ['physical', 'virtual']) document.querySelector(`#clear-${key}`)!.addEventListener('click', () => {
  removedLocations.add(key);
  for (const input of inputs.filter(i => i.name.startsWith(`location.${key}.`))) { input.value = ''; edited.delete(input.name); }
  notice.textContent = `Removed ${key === 'physical' ? 'venue' : 'online'} details from this event.`; refresh();
});
document.querySelector('#new')!.addEventListener('click', () => { load(fresh()); notice.textContent = 'Started a new event.'; });
document.querySelector<HTMLInputElement>('#import')!.addEventListener('change', async e => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error('File exceeds the 1 MiB limit.');
    const value = parseJsonStrict(new TextDecoder('utf-8', {fatal:true}).decode(await file.arrayBuffer()));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an event object.');
    const checked = validateSafe(value);
    if (!checked.valid) throw new Error('The file is not a valid OpenAjang event: ' + checked.errors.map(error => `${error.path || 'Document'}: ${error.message}`).join('; '));
    load(value as RecordObject); notice.textContent = `Opened ${file.name}. Unexposed fields are preserved.`;
  } catch (error) { notice.textContent = `Could not import file: ${error instanceof Error ? error.message : 'invalid JSON'}`; }
  input.value = '';
});
jsonButton.addEventListener('click', () => { const event = exportRecord(); if (event) download(new Blob([JSON.stringify(event, null, 2) + '\n'], {type:'application/vnd.openajang+json'}), 'event.openajang.json'); });
zipButton.addEventListener('click', () => { const event = exportRecord(); if (!event) return; const json = JSON.stringify(event, null, 2) + '\n'; const readme = 'Publish these files together in the same directory on your website.\nOpen index.html to view the event. Its discovery link points to event.openajang.json.\nSet the event URL to the public page URL and upload both files over HTTPS.\n'; const zip = zipSync({'index.html':strToU8(html(event)), 'event.openajang.json':strToU8(json), 'README.txt':strToU8(readme)}); download(new Blob([zip as BlobPart], {type:'application/zip'}), 'openajang-publishing-kit.zip'); });
load(fresh());
