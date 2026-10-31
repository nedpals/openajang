import { candidates } from './time-zone';
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
const touched = new Set<string>();
let identity: string;
let tickets: RecordObject[] = [];
let ticketsEdited = false;
let removedLocations = new Set<string>();
const zone = form.elements.namedItem('time_zone') as HTMLInputElement;
const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zoneList = document.querySelector<HTMLDataListElement>('#time-zones')!;
for (const name of (Intl as any).supportedValuesOf?.('timeZone') ?? []) { const option = document.createElement('option'); option.value = name; zoneList.append(option); }
const zoneSuggestion = document.querySelector<HTMLElement>('#zone-suggestion')!;
const useZone = document.querySelector<HTMLButtonElement>('#use-zone')!;
if (detectedZone) { zoneSuggestion.textContent = `Your browser suggests ${detectedZone}. Confirm that this is the event’s time zone.`; useZone.hidden = false; }
const dateFields = ['start', 'end'] as const;
const dateDirty = new Set<string>();
const dateErrors = new Map<string, string>();
function dateElement(prefix: string, suffix: string) { return document.querySelector<HTMLInputElement>(`#${prefix}-${suffix}`)!; }
function datePath(prefix: string) { return prefix === 'start' ? 'starts_at' : 'ends_at'; }
function syncDate(prefix: string) {
  const path = datePath(prefix); const date = dateElement(prefix, 'date').value; const time = dateElement(prefix, 'time').value;
  const input = form.elements.namedItem(path) as HTMLInputElement; const help = document.querySelector<HTMLElement>(`#${prefix}-time-help`)!;
  const group = document.querySelector<HTMLElement>(`#${prefix}-offset-group`)!; const select = document.querySelector<HTMLSelectElement>(`#${prefix}-offset`)!;
  dateErrors.delete(path); group.hidden = true; help.textContent = ''; input.value = date;
  if (time && !date) dateErrors.set(path, 'Choose a date for this time.');
  else if (date && time) {
    if (!zone.value) dateErrors.set(path, 'Choose the event time zone before entering a time.');
    else try {
      const choices = candidates(date, time, zone.value);
      if (!choices.length) dateErrors.set(path, 'This local time does not exist in that time zone. Choose another time.');
      else if (choices.length > 1) {
        const previous = select.value; select.replaceChildren(new Option('Choose an offset…', ''), ...choices.map(c => new Option(`UTC${c.offset}`, c.offset)));
        if (choices.some(c => c.offset === previous)) select.value = previous;
        group.hidden = false; const choice = choices.find(c => c.offset === select.value);
        if (!choice) dateErrors.set(path, 'This time occurs twice due to a clock change. Choose an offset.'); else { input.value = choice.value; help.textContent = `Local time: ${date} ${time} (UTC${choice.offset}).`; }
      } else { input.value = choices[0].value; help.textContent = `Local time: ${date} ${time} (UTC${choices[0].offset}).`; }
    } catch { dateErrors.set(path, 'Choose a valid IANA time zone, such as Asia/Manila.'); }
  }
  if (dateErrors.has(path)) help.textContent = dateErrors.get(path)!;
  edited.add(path);
}


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
  if (value === '' || ((path === 'tags' || path === 'previous_starts_at') && !value.trim())) delete target[last];
  else target[last] = path === 'registration.required' ? value === 'true' : (path === 'previous_starts_at' || path === 'tags') ? value.split('\n').map(v => v.trim()).filter(Boolean) : value;
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
  if (ticketsEdited) { if (tickets.length) result.tickets = structuredClone(tickets); else delete result.tickets; }
  for (const key of removedLocations) if (result.location) delete result.location[key];
  for (const input of inputs) if (edited.has(input.name)) set(result, input.name, input.value);
  if (result.location?.type === 'virtual' && result.location.physical && !Object.keys(result.location.physical).length) delete result.location.physical;
  // The URL is the identity when an imported document has no explicit ID.
  if (!original.id && result.url !== original.url && identity) result.id = identity;
  return result;
}
function load(value: RecordObject) {
  original = structuredClone(value); edited = new Set(); removedLocations = new Set(); dateDirty.clear(); dateErrors.clear(); touched.clear();
  tickets = structuredClone(value.tickets || []); ticketsEdited = false; renderTickets();
  identity = typeof value.url === 'string' ? eventId(value as OpenAjangEvent) : '';
  for (const input of inputs) { const v = get(value, input.name); input.value = v == null ? '' : Array.isArray(v) ? v.join('\n') : String(v); }
  for (const prefix of dateFields) {
    const stamp = value[datePath(prefix)] || ''; const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(stamp);
    dateElement(prefix, 'date').value = match?.[1] || ''; dateElement(prefix, 'time').value = match?.[2] || '';
    document.querySelector<HTMLElement>(`#${prefix}-offset-group`)!.hidden = true;
    document.querySelector<HTMLElement>(`#${prefix}-time-help`)!.textContent = stamp.includes('T') ? `Imported value: ${stamp}. It remains unchanged until edited.` : '';
  }
  refresh();
}
function escape(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!)); }
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function link(value: unknown, label: string): string { const url = safeUrl(value); return url ? `<a href="${escape(url)}" rel="noopener noreferrer">${escape(label)}</a>` : ''; }
function render(event: RecordObject, showImage = true): string {
  const imageUrl = showImage ? safeUrl(event.image?.url) : null;
  const image = imageUrl ? `<img class="event-image" src="${escape(imageUrl)}" alt="${escape(event.image?.alt || '')}" referrerpolicy="no-referrer" loading="lazy">` : '';
  const ticketText = Array.isArray(event.tickets) && event.tickets.length ? `<h4>Tickets</h4><ul>${event.tickets.map((ticket: RecordObject) => `<li>${escape(ticket.name || 'Ticket')}${ticket.price ? ` — ${escape(ticket.price.amount)} ${escape(ticket.price.currency)}` : ''}${ticket.availability ? ` · ${escape(String(ticket.availability).replaceAll('_', ' '))}` : ''}${link(ticket.url, 'Ticket details') ? ` · ${link(ticket.url, 'Ticket details')}` : ''}</li>`).join('')}</ul>` : '';
  const location = event.location || {}; const physical = location.physical || {}; const virtual = location.virtual || {}; const registration = event.registration;
  const venue = [physical.name, physical.address?.street, physical.address?.locality, physical.address?.region, physical.address?.postal_code, physical.address?.country].filter(Boolean).map(escape).join(', ');
  const venueStatus = physical.status === 'tentative' ? ' (tentative)' : physical.status === 'to_be_announced' && venue ? ' (to be announced)' : '';
  const where = [location.type !== 'virtual' ? `${venue || 'Venue to be announced'}${venueStatus}` : '', location.type !== 'physical' ? (link(virtual.url, virtual.platform || 'Online event') || 'Online details to be announced') : ''].filter(Boolean).join(' · ');
  const date = event.starts_at ? escape(event.starts_at) + (event.ends_at ? ` – ${escape(event.ends_at)}` : '') + (/^\d{4}-\d\d-\d\d$/.test(event.starts_at) ? ' (time not specified)' : '') : 'Date to be announced';
  const reg = registration ? `${registration.required === true ? 'Registration required' : registration.required === false ? 'Registration not required' : 'Registration details'}${registration.status ? ` · ${escape(String(registration.status).replaceAll('_', ' '))}` : ''}${registration.instructions ? `<br>${escape(registration.instructions)}` : ''}${link(registration.url, 'Registration details') ? `<br>${link(registration.url, 'Registration details')}` : ''}` : 'Registration details not specified';
  return `${image}<h3>${escape(event.title || 'Untitled event')}</h3>${event.summary ? `<p>${escape(event.summary)}</p>` : ''}${event.description ? `<p style="white-space:pre-wrap">${escape(event.description)}</p>` : ''}<p><strong>Status:</strong> ${escape(event.status || 'Not specified')}${event.status_note ? ` — ${escape(event.status_note)}` : ''}</p><p><strong>When:</strong> ${date}${event.time_zone ? ` · ${escape(event.time_zone)}` : ''}</p><p><strong>Where:</strong> ${where || 'Location to be announced'}</p><p><strong>Organizer:</strong> ${escape(event.organizer?.name || 'Not specified')}</p><p><strong>Registration:</strong> ${reg}</p>${physical.instructions && location.type !== 'virtual' ? `<p>${escape(physical.instructions)}</p>` : ''}${virtual.instructions && location.type !== 'physical' ? `<p>${escape(virtual.instructions)}</p>` : ''}${ticketText}${link(event.url, 'Event website') ? `<p>${link(event.url, 'Event website')}</p>` : ''}`;
}
function refresh() {
  const event = record(); preview.innerHTML = render(event, document.activeElement !== form.elements.namedItem('image.url'));
  for (const input of [...inputs, ...dateFields.map(prefix => dateElement(prefix, 'date')), ...document.querySelectorAll<HTMLInputElement>('#ticket-list input, #ticket-list select')]) { input.removeAttribute('aria-invalid'); if (input.getAttribute('aria-describedby')?.startsWith('error-')) input.removeAttribute('aria-describedby'); input.parentElement?.querySelectorAll('.field-error').forEach(error => error.remove()); }
  errors.replaceChildren();
  for (const section of form.querySelectorAll<HTMLDetailsElement>('details[data-fields]')) {
    const hasDetails = section.dataset.fields!.split(',').some(path => { const value = get(event, path); return value != null && value !== '' && (typeof value !== 'object' || Object.keys(value).length > 0); });
    section.querySelector<HTMLElement>('[data-detail-indicator]')!.textContent = hasDetails ? ' · Added' : ' · Optional';
  }
  let result;
  try { result = validateSafe(event); } catch { result = {valid:false, errors:[{path:'', message:'Validation could not complete.', code:'validation'}]}; }
  for (const [path, message] of dateErrors) result.errors.unshift({path: `/${path}`, message, code:'date'});
  if (dateErrors.size) result.valid = false;
  document.querySelector<HTMLElement>('#mobile-error-count')!.textContent = result.valid ? '(ready)' : `(${result.errors.length} to fix)`;
  validation.textContent = result.valid ? 'This event passes the bundled OpenAjang checks.' : `${result.errors.length} problem(s) to fix before export.`;
  for (const error of result.errors) {
    const li = document.createElement('li'); errors.append(li);
    let path = error.path.replace(/^\//, '').replaceAll('/', '.');
    const missing = error.message.match(/required property '([^']+)'/);
    if (missing) path = [path, missing[1]].filter(Boolean).join('.');
    const ticketPath = /^tickets\.(\d+)\.(.+)$/.exec(path);
    const input = path === 'starts_at' ? dateElement('start', 'date') : path === 'ends_at' ? dateElement('end', 'date') : ticketPath ? document.querySelector<HTMLInputElement>(`#ticket-${ticketPath[1]}-${ticketPath[2].replaceAll('.', '-')}`) : inputs.find(i => i.name === path);
    const friendly = error.code === 'required' ? 'This field is required.' : error.code === 'pattern' ? 'Enter a value that is not blank.' : error.code === 'format' ? 'Enter a valid value in the requested format.' : error.code === 'oneOf' ? 'Enter a valid date or date and time.' : error.message;
    if (input) { if (!input.id) input.id = `field-${input.name.replaceAll('.', '-')}`; const link = document.createElement('a'); link.href = `#${input.id}`; link.addEventListener('click', () => { let parent: HTMLElement | null = input.parentElement; while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; } }); link.textContent = `${input.closest('label')?.textContent?.trim() || path}: ${friendly}`; li.append(link); } else li.textContent = `${error.path || 'Document'}: ${friendly}`;
    if (input && touched.has(input.name || input.id)) { input.setAttribute('aria-invalid', 'true'); const hint = document.createElement('span'); hint.className = 'field-error'; hint.textContent = friendly; hint.id = `error-${input.name || input.id}`; input.setAttribute('aria-describedby', hint.id); input.parentElement?.append(hint); }
  }
  jsonButton.disabled = zipButton.disabled = !result.valid;
  const mode = (form.elements.namedItem('location.type') as HTMLSelectElement).value;
  document.querySelector<HTMLElement>('#physical-fields')!.hidden = mode === 'virtual';
  document.querySelector<HTMLElement>('#virtual-fields')!.hidden = mode === 'physical';
  const addPrevious = document.querySelector<HTMLButtonElement>('#add-previous')!;
  addPrevious.hidden = event.status !== 'rescheduled' || !original.starts_at || original.starts_at === event.starts_at || (event.previous_starts_at || []).includes(original.starts_at);
  document.querySelector<HTMLElement>('#history-label')!.hidden = (form.elements.namedItem('status') as HTMLSelectElement).value !== 'rescheduled' && !get(event, 'previous_starts_at');
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function same(a: RecordObject, b: RecordObject) { return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b)); }
function exportRecord(): RecordObject | null {
  const event = record();
  if (dateErrors.size || !validateSafe(event).valid) { refresh(); return null; }
  if (!same(event, original)) event.updated_at = new Date(Math.max(Date.now(), Date.parse(original.updated_at) + 1 || 0)).toISOString();
  if (!validateSafe(event).valid) { notice.textContent = 'The updated event did not pass validation.'; return null; }
  // Subsequent downloads of the same revision use the same timestamp and record.
  original = structuredClone(event); edited.clear(); removedLocations.clear(); ticketsEdited = false;
  return event;
}
function download(blob: Blob, name: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function html(event: RecordObject): string { return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(event.title)}</title><link rel="alternate" type="application/vnd.openajang+json" href="event.openajang.json"><style>body{font:1rem/1.6 system-ui,sans-serif;color:#29283d;background:#faf9f6;margin:0}main{max-width:45rem;margin:3rem auto;padding:0 1.25rem}h1{font-size:2rem}h3{font-size:1.6rem}.event-image{display:block;max-width:100%;max-height:24rem;object-fit:contain}a{color:#873816}p{overflow-wrap:anywhere}</style></head><body><main>${render(event)}</main></body></html>\n`; }
function renderTickets() {
  const list = document.querySelector<HTMLElement>('#ticket-list')!; list.replaceChildren();
  tickets.forEach((ticket, index) => {
    const group = document.createElement('div'); group.className = 'ticket-editor';
    const heading = document.createElement('h3'); heading.textContent = `Ticket ${index + 1}`; group.append(heading);
    const fields: [string, string, string][] = [['name','Ticket name','text'], ['description','Description','text'], ['url','Ticket URL','url'], ['price.amount','Price amount','text'], ['price.currency','Currency code (e.g. USD)','text'], ['availability','Availability','select']];
    for (const [path, title, type] of fields) {
      const label = document.createElement('label'); label.textContent = title;
      const control = type === 'select' ? document.createElement('select') : document.createElement('input');
      if (control instanceof HTMLSelectElement) for (const [value, text] of [['','Not specified'],['available','Available'],['limited','Limited'],['sold_out','Sold out'],['unavailable','Unavailable'],['unknown','Unknown']]) control.add(new Option(text, value));
      else control.type = type;
      control.value = String(get(ticket, path) ?? ''); control.id = `ticket-${index}-${path.replaceAll('.', '-')}`;
      control.addEventListener('input', () => { set(ticket, path, control.value); ticketsEdited = true; refresh(); });
      control.addEventListener('change', () => { set(ticket, path, control.value); ticketsEdited = true; refresh(); });
      label.append(control); group.append(label);
    }
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Remove ticket';
    remove.addEventListener('click', () => { if (!confirm(`Remove ticket ${ticket.name || index + 1}, including any imported details?`)) return; tickets.splice(index, 1); ticketsEdited = true; renderTickets(); refresh(); });
    group.append(remove); list.append(group);
  });
}
document.querySelector('#add-ticket')!.addEventListener('click', () => { tickets.push({id: crypto.randomUUID(), name: ''}); ticketsEdited = true; renderTickets(); refresh(); });
for (const prefix of dateFields) for (const suffix of ['date', 'time', 'offset']) dateElement(prefix, suffix).addEventListener('change', () => { if (suffix !== 'offset') dateElement(prefix, 'offset').value = ''; dateDirty.add(prefix); syncDate(prefix); refresh(); });
useZone.addEventListener('click', () => { zone.value = detectedZone; edited.add('time_zone'); for (const prefix of dateDirty) syncDate(prefix); refresh(); });
zone.addEventListener('change', () => { for (const prefix of dateDirty) { dateElement(prefix, 'offset').value = ''; syncDate(prefix); } refresh(); });
form.addEventListener('focusout', e => { const input = e.target as HTMLInputElement; if (input.name || input.id) { touched.add(input.name || input.id); refresh(); } });
form.addEventListener('input', e => { const input = e.target as HTMLInputElement; if (input.name) { edited.add(input.name); refresh(); } });
form.addEventListener('change', e => { const input = e.target as HTMLInputElement; if (input.name) { edited.add(input.name); refresh(); } });
document.querySelector('#add-previous')!.addEventListener('click', () => { const input = form.elements.namedItem('previous_starts_at') as HTMLTextAreaElement; input.value = [input.value.trim(), original.starts_at].filter(Boolean).join('\n'); edited.add(input.name); refresh(); });
for (const key of ['physical', 'virtual']) document.querySelector(`#clear-${key}`)!.addEventListener('click', () => {
  if (get(record(), `location.${key}`) && !confirm(`Remove all ${key === 'physical' ? 'venue' : 'online'} details, including imported fields?`)) return;
  removedLocations.add(key);
  for (const input of inputs.filter(i => i.name.startsWith(`location.${key}.`))) { input.value = ''; edited.delete(input.name); }
  notice.textContent = `Removed ${key === 'physical' ? 'venue' : 'online'} details from this event.`; refresh();
});
document.querySelector('#new')!.addEventListener('click', () => { if ((dateErrors.size > 0 || !same(record(), original)) && !confirm('Discard your changes and start a new event? Download your work first if you want to keep it.')) return; load(fresh()); notice.textContent = 'Started a new event.'; });
document.querySelector<HTMLInputElement>('#import')!.addEventListener('change', async e => {
  const input = e.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  if ((dateErrors.size > 0 || !same(record(), original)) && !confirm('Discard your changes and open this file? Download your work first if you want to keep it.')) { input.value = ''; return; }
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
