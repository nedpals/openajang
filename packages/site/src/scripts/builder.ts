import { render, escape } from './event-html';
import { decodeDraft, encodeDraft, DRAFT_LIMIT } from './draft';
import { normalizeDiagnostics } from './diagnostics';
import { schemaOrgForPage } from './schema-org';
import { resolveTemporal, type TemporalControl } from './temporal';
import { Buffer } from 'buffer';
import {
  eventId,
  parseJsonStrict,
  SCHEMA_ID,
  validateSafe,
  type OpenAjangEvent,
} from '@openajang/core';
import { strToU8, zipSync } from 'fflate';

globalThis.Buffer = Buffer;
const banner = document.querySelector<HTMLElement>('.test-banner');
if (banner) new ResizeObserver(() => document.documentElement.style.setProperty('--builder-banner-height', `${banner.offsetHeight}px`)).observe(banner);
type RecordObject = Record<string, any>;
const form = document.querySelector<HTMLFormElement>('#builder-form')!;
const inputs = [
  ...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[name]'),
];
const notice = document.querySelector<HTMLElement>('#notice')!;
const generatedJson = document.querySelector<HTMLTextAreaElement>('#generated-json')!;
const validation = document.querySelector<HTMLElement>('#validation')!;
const errors = document.querySelector<HTMLElement>('#errors')!;
// Keep the pressed link alive until its click handler moves focus to the field.
errors.addEventListener('pointerdown', (event) => {
  if ((event.target as Element).closest('a')) event.preventDefault();
});
const jsonButton = document.querySelector<HTMLButtonElement>('#json')!;
const zipButton = document.querySelector<HTMLButtonElement>('#zip')!;
let original: RecordObject;
let edited = new Set<string>();
const touched = new Set<string>();
let identity: string;
let tickets: RecordObject[] = [];
let ticketsEdited = false;
let savedDraft = "";
let validationTimer = 0;
let removedLocations = new Set<string>();
const zone = form.elements.namedItem('time_zone') as HTMLInputElement;
const detectedZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const zoneList = document.querySelector<HTMLDataListElement>('#time-zones')!;
for (const name of (Intl as any).supportedValuesOf?.('timeZone') ?? []) {
  const option = document.createElement('option');
  option.value = name;
  zoneList.append(option);
}
const zoneSuggestion = document.querySelector<HTMLElement>('#zone-suggestion')!;
const useZone = document.querySelector<HTMLButtonElement>('#use-zone')!;
if (detectedZone) {
  zoneSuggestion.textContent = `Your browser reports ${detectedZone}. Use it only if the event happens in that zone.`;
  useZone.hidden = false;
}
const dateFields = ['start', 'end', 'registration-opens', 'registration-closes'];
let history: { value: string; date: string; time: string; offset: string; dirty: boolean }[] = [];
const dateDirty = new Set<string>();
const dateErrors = new Map<string, string>();
const dateErrorControls = new Map<string, TemporalControl>();
function dateElement(prefix: string, suffix: string) {
  return document.querySelector<HTMLInputElement>(`#${prefix}-${suffix}`)!;
}
function datePath(prefix: string) {
  return prefix === 'start' ? 'starts_at' : prefix === 'end' ? 'ends_at' : prefix.startsWith('history-') ? `previous_starts_at.${prefix.slice(8)}` : `registration.${prefix.slice(13)}_at`;
}
function syncDate(prefix: string) {
  const path = datePath(prefix);
  const date = dateElement(prefix, 'date').value;
  const time = dateElement(prefix, 'time').value;
  const input = (prefix.startsWith('history-') ? document.querySelector(`#${prefix}-value`) : form.elements.namedItem(path)) as HTMLInputElement;
  const help = document.querySelector<HTMLElement>(`#${prefix}-time-help`)!;
  const group = document.querySelector<HTMLElement>(`#${prefix}-offset-group`)!;
  const select = document.querySelector<HTMLSelectElement>(`#${prefix}-offset`)!;
  dateErrors.delete(path);
  dateErrorControls.delete(path);
  const resolved = resolveTemporal({ date, time, offset: select.value }, zone.value, prefix.startsWith('registration-'), prefix.startsWith('history-'));
  const previous = select.value;
  group.hidden = resolved.choices.length < 2;
  select.replaceChildren(new Option('Choose an offset…', ''), ...resolved.choices.map(choice => new Option(`UTC${choice.offset}`, choice.offset)));
  if (resolved.choices.some(choice => choice.offset === previous)) select.value = previous;
  input.value = resolved.value;
  help.textContent = resolved.message || (date && time ? `Local time: ${date} ${time} (${resolved.value.slice(-6)}).` : '');
  if (resolved.message) {
    dateErrors.set(path, resolved.message);
    dateErrorControls.set(path, resolved.control);
  }
  if (prefix.startsWith('history-')) {
    const item = history[Number(prefix.slice(8))];
    Object.assign(item, { value: input.value, date, time, offset: select.value, dirty: true });
    syncHistory();
  } else edited.add(path);
}

function fresh(): RecordObject {
  return {
    $schema: SCHEMA_ID,
    type: 'event',
    id: `urn:uuid:${crypto.randomUUID()}`,
    url: '',
    title: '',
    status: 'scheduled',
    starts_at: '',
    location: { type: 'physical', physical: {} },
    organizer: { name: '' },
    updated_at: new Date().toISOString(),
  };
}
function get(obj: RecordObject, path: string): any {
  return path.split('.').reduce((v, k) => v != null && Object.hasOwn(v, k) ? v[k] : undefined, obj);
}
function set(obj: RecordObject, path: string, value: string) {
  const parts = path.split('.');
  const last = parts.pop()!;
  let target = obj;
  for (const part of parts) {
    if (!target[part] || typeof target[part] !== 'object' || Array.isArray(target[part]))
      target[part] = {};
    target = target[part];
  }
  if (value === '' || ((path === 'tags' || path === 'previous_starts_at') && !value.trim()))
    delete target[last];
  else
    target[last] =
      path === 'registration.required'
        ? value === 'true'
        : path === 'previous_starts_at' || path === 'tags'
          ? value
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean)
          : value;
  // Remove only empty containers; preserve all unexposed properties.
  function prune(node: RecordObject, keys: string[]) {
    const key = keys.shift();
    if (!key || !node[key] || typeof node[key] !== 'object') return;
    prune(node[key], keys);
    if (!Object.keys(node[key]).length) delete node[key];
  }
  prune(obj, parts.slice());
}
function record(): RecordObject {
  const result = structuredClone(original);
  if (ticketsEdited) {
    if (tickets.length) result.tickets = structuredClone(tickets);
    else delete result.tickets;
  }
  for (const key of removedLocations) if (result.location) delete result.location[key];
  for (const input of inputs) if (edited.has(input.name)) set(result, input.name, input.value);
  if (
    result.location?.type === 'virtual' &&
    result.location.physical &&
    !Object.keys(result.location.physical).length
  )
    delete result.location.physical;
  // The URL is the identity when an imported document has no explicit ID.
  if (!original.id && result.url !== original.url && identity) result.id = identity;
  return result;
}
function load(value: RecordObject) {
  original = structuredClone(value);
  edited = new Set();
  removedLocations = new Set();
  dateDirty.clear();
  dateErrors.clear();
  dateErrorControls.clear();
  touched.clear();
  history = (value.previous_starts_at || []).map(historyItem);
  renderHistory();
  tickets = structuredClone(value.tickets || []);
  ticketsEdited = false;
  renderTickets();
  identity = typeof value.url === 'string' ? eventId(value as OpenAjangEvent) : '';
  for (const input of inputs) {
    const v = get(value, input.name);
    input.value = v == null ? '' : Array.isArray(v) ? v.join('\n') : String(v);
  }
  for (const prefix of dateFields) {
    const stamp = get(value, datePath(prefix)) || '';
    const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(stamp);
    for (const suffix of ['date', 'time', 'offset']) dateElement(prefix, suffix).setAttribute('aria-describedby', `${prefix}-time-help ${prefix}-zone-context`);
    dateElement(prefix, 'date').value = match?.[1] || '';
    dateElement(prefix, 'time').value = match?.[2] || '';
    document.querySelector<HTMLElement>(`#${prefix}-offset-group`)!.hidden = true;
    document.querySelector<HTMLElement>(`#${prefix}-time-help`)!.textContent = stamp.includes('T')
      ? `Imported value: ${stamp}. This stays unchanged until you edit it.`
      : '';
  }
  refresh();
  savedDraft = draftSnapshot();
}
function refresh() {
  const event = record();
  for (const context of document.querySelectorAll<HTMLElement>('[data-time-zone-context]')) {
    context.textContent = zone.value ? `Time zone for edits: ${zone.value}.` : 'Set the time zone above before entering a time.';
  }
  generatedJson.value = JSON.stringify(event, null, 2);
  for (const input of [
    ...inputs,
    ...dateFields.flatMap((prefix) => ['date', 'time', 'offset'].map(suffix => dateElement(prefix, suffix))),
    ...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#history-list input, #history-list select'),
    ...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('#ticket-list input, #ticket-list textarea, #ticket-list select'),
  ]) {
    input.removeAttribute('aria-invalid');
    const described = input.getAttribute('aria-describedby')?.split(/\s+/).filter((id) => !id.startsWith('error-'));
    if (described?.length) input.setAttribute('aria-describedby', described.join(' '));
    else input.removeAttribute('aria-describedby');
    input.parentElement?.querySelectorAll('.field-error').forEach((error) => error.remove());
  }
  errors.replaceChildren();
  for (const section of form.querySelectorAll<HTMLDetailsElement>('details[data-fields]')) {
    const hasDetails = section.dataset.fields!.split(',').some((path) => {
      const value = get(event, path);
      return (
        value != null &&
        value !== '' &&
        (typeof value !== 'object' || Object.keys(value).length > 0)
      );
    });
    section.querySelector<HTMLElement>('[data-detail-indicator]')!.textContent = hasDetails
      ? ' · Added'
      : ' · Optional';
  }
  let result;
  try {
    result = validateSafe(event);
  } catch {
    result = {
      valid: false,
      errors: [
        {
          path: '',
          message: 'Validation could not complete.',
          code: 'validation',
        },
      ],
    };
  }
  for (const [path, message] of dateErrors)
    result.errors.unshift({ path: `/${path.replaceAll('.', '/')}`, message, code: 'date' });
  if (dateErrors.size) result.valid = false;
  document.querySelector<HTMLElement>('#export-notice')!.textContent = '';
  const statusHelp = document.querySelector<HTMLElement>('#status-help')!;
  statusHelp.textContent = event.status === 'postponed' ? 'Postponed: keep the last scheduled start until the new date is confirmed.' : event.status === 'rescheduled' ? 'Rescheduled: enter the new start, then list the earlier starts below.' : 'Pick the status that describes the event today. It stays the same event when the status changes.';
  result.errors = normalizeDiagnostics(result.errors, event).filter((error) =>
    !(dateErrors.has(error.path.slice(1).replaceAll('/', '.')) && error.code !== 'date'));

  document.querySelector<HTMLElement>('#mobile-error-count')!.textContent = result.valid
    ? '(ready)'
    : `(${result.errors.length} to fix)`;
  clearTimeout(validationTimer);
  const message = result.valid ? 'This event passes validation. You can download it.' : `${result.errors.length} ${result.errors.length === 1 ? 'problem' : 'problems'} to fix before you can download.`;
  validationTimer = window.setTimeout(() => {
    validation.textContent = message;
    validation.dataset.state = result.valid ? 'valid' : 'invalid';
  }, 500);
  const shownFields = new Set<HTMLElement>();
  for (const error of result.errors) {
    const li = document.createElement('li');
    errors.append(li);
    let path = error.path.replace(/^\//, '').replaceAll('/', '.');
    const missing = error.message.match(/required property '([^']+)'/);
    if (missing) path = [path, missing[1]].filter(Boolean).join('.');
    const historyPath = /^previous_starts_at\.(\d+)/.exec(path);
    const ticketPath = /^tickets\.(\d+)\.(.+)$/.exec(path);
    const temporalPrefix = path === 'starts_at' ? 'start' : path === 'ends_at' ? 'end' : path === 'registration.opens_at' ? 'registration-opens' : path === 'registration.closes_at' ? 'registration-closes' : historyPath ? `history-${historyPath[1]}` : null;
    const temporalControl = dateErrorControls.get(path) || 'date';
    const input =
      temporalPrefix ? (temporalControl === 'zone' ? zone : dateElement(temporalPrefix, temporalControl)) :
      error.code === 'remove-location' && path === 'location.physical' ? document.querySelector<HTMLButtonElement>('#clear-physical') :
      error.code === 'remove-location' && path === 'location.virtual' ? document.querySelector<HTMLButtonElement>('#clear-virtual') :
      path === 'previous_starts_at' ? (document.querySelector<HTMLInputElement>('#history-0-date') || document.querySelector<HTMLButtonElement>('#add-history')) :
      path === 'starts_at'
        ? dateElement('start', 'date')
        : path === 'ends_at'
          ? dateElement('end', 'date')
          : ticketPath
            ? document.querySelector<HTMLInputElement>(
                `#ticket-${ticketPath[1]}-${ticketPath[2].replaceAll('.', '-')}`,
              )
            : inputs.find((i) => i.name === path);
    const friendly =
      error.code === 'required'
        ? 'This field is required.'
        : error.code === 'pattern'
          ? 'Enter a value that is not blank.'
          : error.code === 'format'
            ? 'Enter a valid value in the requested format.'
            : error.code === 'oneOf'
              ? 'Enter a valid date or date and time.'
              : error.message;
    if (input) {
      if (!input.id) input.id = `field-${input.name.replaceAll('.', '-')}`;
      const link = document.createElement('a');
      link.href = `#${input.id}`;
      link.addEventListener('click', (event) => {
        event.preventDefault();
        let parent: HTMLElement | null = input.parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
        input.focus();
      });
      link.textContent = `${input.closest('label')?.textContent?.trim() || path}: ${friendly}`;
      li.append(link);
    } else li.textContent = `${error.path || 'Document'}: ${friendly}`;
    if (input && (touched.has(input.name || input.id) || touched.has(path)) && !shownFields.has(input)) {
      shownFields.add(input);
      input.setAttribute('aria-invalid', 'true');
      const hint = document.createElement('span');
      hint.className = 'field-error';
      hint.textContent = friendly;
      hint.id = `error-${input.name || input.id}`;
      input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), hint.id].filter(Boolean).join(' '));
      input.parentElement?.append(hint);
    }
  }
  jsonButton.disabled = zipButton.disabled = !result.valid;
  const mode = (form.elements.namedItem('location.type') as HTMLSelectElement).value;
  document.querySelector<HTMLElement>('#physical-fields')!.hidden = mode === 'virtual';
  document.querySelector<HTMLElement>('#virtual-fields')!.hidden = mode === 'physical';
  const addPrevious = document.querySelector<HTMLButtonElement>('#add-previous')!;
  addPrevious.hidden =
    event.status !== 'rescheduled' ||
    !original.starts_at ||
    original.starts_at === event.starts_at ||
    (Array.isArray(event.previous_starts_at) && event.previous_starts_at.includes(original.starts_at));
  document.querySelector<HTMLElement>('#history-label')!.hidden =
    (form.elements.namedItem('status') as HTMLSelectElement).value !== 'rescheduled' &&
    history.length === 0;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  return value;
}
function same(a: RecordObject, b: RecordObject) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
function draftState() {
  return {
    original, identity, edited: [...edited], removedLocations: [...removedLocations], tickets, ticketsEdited,
    values: Object.fromEntries(inputs.map((input) => [input.name, input.value])),
    history: structuredClone(history),
    dates: Object.fromEntries(dateFields.map((prefix) => [prefix, {
      date: dateElement(prefix, 'date').value, time: dateElement(prefix, 'time').value,
      offset: dateElement(prefix, 'offset').value, dirty: dateDirty.has(prefix),
    }])),
  };
}
function draftSnapshot() { return JSON.stringify(draftState()); }
function isDirty() { return draftSnapshot() !== savedDraft; }
function applyDraft(state: RecordObject) {
  load(state.original);
  identity = state.identity;
  edited = new Set(state.edited);
  removedLocations = new Set(state.removedLocations);
  tickets = structuredClone(state.tickets);
  ticketsEdited = state.ticketsEdited;
  for (const input of inputs) input.value = state.values[input.name];
  renderTickets();
  history = state.history ? structuredClone(state.history) : (state.values.previous_starts_at || '').split('\n').filter(Boolean).map(historyItem);
  renderHistory();
  for (const prefix of dateFields) {
    const date = state.dates[prefix];
    if (!date) continue;
    dateElement(prefix, 'date').value = date.date;
    dateElement(prefix, 'time').value = date.time;
    if (date.dirty) {
      dateDirty.add(prefix);
      syncDate(prefix);
      dateElement(prefix, 'offset').value = date.offset;
      syncDate(prefix);
    }
  }
  history.forEach((item, i) => { if (item.dirty) { const offset = item.offset; syncDate(`history-${i}`); dateElement(`history-${i}`, 'offset').value = offset; syncDate(`history-${i}`); } });
  refresh();
  savedDraft = draftSnapshot();
}
function restoreDraft(value: RecordObject) {
  const state = decodeDraft(value, inputs.map(input => input.name));
  const backup = structuredClone(draftState());
  const baseline = savedDraft;
  const priorTouched = [...touched];
  try { applyDraft(state); }
  catch (error) {
    applyDraft(backup);
    savedDraft = baseline;
    touched.clear(); priorTouched.forEach(name => touched.add(name));
    refresh();
    throw error;
  }
}
window.addEventListener('beforeunload', (event) => {
  if (isDirty()) { event.preventDefault(); event.returnValue = ''; }
});
document.querySelector('#open-file')!.addEventListener('click', () => {
  document.querySelector<HTMLInputElement>('#import')!.click();
});
document.querySelector('#save-draft')!.addEventListener('click', () => {
  try {
    const text = encodeDraft(draftState(), inputs.map(input => input.name));
    download(new Blob([text], { type: 'application/json' }), 'event.openajang-draft.json');
    savedDraft = draftSnapshot();
    notice.textContent = 'Draft download started. Reopen the file to continue editing.';
  } catch (error) { notice.textContent = `Could not save draft: ${error instanceof Error ? error.message : 'invalid draft'}`; }
});
function exportRecord(): RecordObject | null {
  const event = record();
  if (dateErrors.size || !validateSafe(event).valid) {
    refresh();
    return null;
  }
  if (!same(event, original))
    event.updated_at = new Date(
      Math.max(Date.now(), Date.parse(original.updated_at) + 1 || 0),
    ).toISOString();
  if (!validateSafe(event).valid) {
    document.querySelector<HTMLElement>('#export-notice')!.textContent = 'The updated event did not pass validation.';
    return null;
  }
  // Subsequent downloads of the same revision use the same timestamp and record.
  original = structuredClone(event);
  edited.clear();
  removedLocations.clear();
  ticketsEdited = false;
  generatedJson.value = JSON.stringify(event, null, 2);
  savedDraft = draftSnapshot();
  return event;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function html(event: RecordObject, jsonLd: string): string {
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(event.title)}</title><link rel="alternate" type="application/vnd.openajang+json" href="event.openajang.json"><script type="application/ld+json">${jsonLd}</script><style>body{font:1rem/1.6 system-ui,sans-serif;color:#29283d;background:#faf9f6;margin:0}main{max-width:45rem;margin:3rem auto;padding:0 1.25rem}h1{font-size:2rem}h2{font-size:1.6rem}.event-image{display:block;max-width:100%;max-height:24rem;object-fit:contain}a{color:#873816}p{overflow-wrap:anywhere}</style></head><body><main>${render(event)}</main></body></html>\n`;
}
function historyItem(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2})?))?/.exec(value);
  return { value, date: match?.[1] || '', time: match?.[2] || '', offset: '', dirty: false };
}
function syncHistory() {
  const input = form.elements.namedItem('previous_starts_at') as HTMLTextAreaElement;
  input.value = history.map(item => item.value).join('\n');
  edited.add(input.name);
}
function renderHistory() {
  const list = document.querySelector<HTMLElement>('#history-list')!;
  list.replaceChildren();
  history.forEach((item, index) => {
    const prefix = `history-${index}`;
    const group = document.createElement('fieldset');
    group.className = 'history-editor';
    group.innerHTML = `<legend>Earlier start ${index + 1}</legend><input type="hidden" id="${prefix}-value"><label>Date <input type="date" id="${prefix}-date"></label><label>Time (optional) <input type="time" step="1" id="${prefix}-time"></label><div id="${prefix}-offset-group" hidden><label>Choose offset <select id="${prefix}-offset"></select></label></div><p class="hint" id="${prefix}-zone-context" data-time-zone-context></p><p class="hint" id="${prefix}-time-help"></p><button type="button" class="secondary">Remove earlier start</button>`;
    list.append(group);
    for (const suffix of ['date', 'time', 'offset']) dateElement(prefix, suffix).setAttribute('aria-describedby', `${prefix}-time-help ${prefix}-zone-context`);
    dateElement(prefix, 'value').value = item.value;
    dateElement(prefix, 'date').value = item.date;
    dateElement(prefix, 'time').value = item.time;
    if (!item.dirty && item.value.includes('T')) document.querySelector<HTMLElement>(`#${prefix}-time-help`)!.textContent = `Imported value: ${item.value}. This stays unchanged until you edit it.`;
    for (const suffix of ['date', 'time', 'offset']) dateElement(prefix, suffix).addEventListener('change', () => {
      if (suffix !== 'offset') dateElement(prefix, 'offset').value = '';
      syncDate(prefix); refresh();
    });
    if (item.dirty) { const offset = item.offset; syncDate(prefix); dateElement(prefix, 'offset').value = offset; syncDate(prefix); }
    group.querySelector('button')!.addEventListener('click', () => {
      history.splice(index, 1); for (const key of dateErrors.keys()) if (key.startsWith('previous_starts_at.')) { dateErrors.delete(key); dateErrorControls.delete(key); } renderHistory(); syncHistory();
      history.forEach((entry, i) => { if (entry.dirty) syncDate(`history-${i}`); });
      refresh(); (document.querySelector<HTMLElement>(`#history-${Math.min(index, history.length - 1)}-date`) || document.querySelector<HTMLElement>('#add-history'))?.focus();
    });
  });
}
document.querySelector('#add-history')!.addEventListener('click', () => {
  history.push(historyItem('')); renderHistory(); syncDate(`history-${history.length - 1}`); refresh();
  dateElement(`history-${history.length - 1}`, 'date').focus();
});
function renderTickets() {
  const list = document.querySelector<HTMLElement>('#ticket-list')!;
  list.replaceChildren();
  tickets.forEach((ticket, index) => {
    const group = document.createElement('fieldset');
    group.className = 'ticket-editor';
    const heading = document.createElement('legend');
    heading.textContent = `Ticket ${index + 1}`;
    group.append(heading);
    const fields: [string, string, string][] = [
      ['name', 'Ticket name (required)', 'text'],
      ['description', 'Description', 'textarea'],
      ['url', 'Ticket URL', 'url'],
      ['price.amount', 'Price amount', 'text'],
      ['price.currency', 'Currency code (e.g. USD)', 'text'],
      ['availability', 'Availability', 'select'],
    ];
    for (const [path, title, type] of fields) {
      const label = document.createElement('label');
      label.textContent = title;
      const control =
        type === 'select' ? document.createElement('select') : type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
      if (control instanceof HTMLSelectElement)
        for (const [value, text] of [
          ['', 'Not specified'],
          ['available', 'Available'],
          ['limited', 'Limited'],
          ['sold_out', 'Sold out'],
          ['unavailable', 'Unavailable'],
          ['unknown', 'Unknown'],
        ])
          control.add(new Option(text, value));
      else if (control instanceof HTMLInputElement) {
        control.type = type;
        if (path === 'price.amount') control.inputMode = 'decimal';
        if (path === 'price.currency') control.maxLength = 3;
      }
      if (path === 'name') control.required = true;
      control.value = String(get(ticket, path) ?? '');
      control.id = `ticket-${index}-${path.replaceAll('.', '-')}`;
      control.addEventListener('input', () => {
        set(ticket, path, control.value);
        ticketsEdited = true;
        refresh();
      });
      control.addEventListener('change', () => {
        set(ticket, path, control.value);
        ticketsEdited = true;
        refresh();
      });
      label.append(control);
      group.append(label);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Remove ticket';
    remove.addEventListener('click', () => {
      if (!confirm(`Remove ticket ${ticket.name || index + 1}, including any imported details?`))
        return;
      tickets.splice(index, 1);
      ticketsEdited = true;
      renderTickets();
      refresh();
      (document.querySelector<HTMLElement>(`#ticket-${Math.min(index, tickets.length - 1)}-name`) || document.querySelector<HTMLElement>('#add-ticket'))?.focus();
    });
    group.append(remove);
    list.append(group);
  });
}
document.querySelector('#add-ticket')!.addEventListener('click', () => {
  tickets.push({ id: crypto.randomUUID(), name: '' });
  ticketsEdited = true;
  renderTickets();
  refresh();
  document.querySelector<HTMLElement>(`#ticket-${tickets.length - 1}-name`)?.focus();
});
for (const prefix of dateFields)
  for (const suffix of ['date', 'time', 'offset'])
    dateElement(prefix, suffix).addEventListener('change', () => {
      if (suffix !== 'offset') dateElement(prefix, 'offset').value = '';
      dateDirty.add(prefix);
      syncDate(prefix);
      refresh();
    });
function changeTimeZone() {
  for (const prefix of dateDirty) {
    dateElement(prefix, 'offset').value = '';
    syncDate(prefix);
  }
  history.forEach((item, i) => {
    if (item.dirty) {
      dateElement(`history-${i}`, 'offset').value = '';
      syncDate(`history-${i}`);
    }
  });
  refresh();
}
useZone.addEventListener('click', () => {
  zone.value = detectedZone;
  edited.add('time_zone');
  changeTimeZone();
});
zone.addEventListener('change', changeTimeZone);
form.addEventListener('focusout', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name || input.id) {
    touched.add(input.name || input.id);
    if (e.relatedTarget instanceof Element && errors.contains(e.relatedTarget)) {
      e.relatedTarget.addEventListener('click', () => window.setTimeout(refresh, 0), { once: true });
    } else refresh();
  }
});
form.addEventListener('input', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name) {
    edited.add(input.name);
    refresh();
  }
});
form.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name) {
    edited.add(input.name);
    refresh();
  }
});
document.querySelector('#add-previous')!.addEventListener('click', () => {
  history.push(historyItem(original.starts_at));
  renderHistory();
  syncHistory();
  refresh();
  dateElement(`history-${history.length - 1}`, 'date').focus();
});
for (const key of ['physical', 'virtual'])
  document.querySelector(`#clear-${key}`)!.addEventListener('click', () => {
    if (
      get(record(), `location.${key}`) &&
      !confirm(
        `Remove all ${key === 'physical' ? 'venue' : 'online'} details, including imported fields?`,
      )
    )
      return;
    removedLocations.add(key);
    for (const input of inputs.filter((i) => i.name.startsWith(`location.${key}.`))) {
      input.value = '';
      edited.delete(input.name);
    }
    notice.textContent = `Removed ${key === 'physical' ? 'venue' : 'online'} details from this event.`;
    refresh();
  });
document.querySelector('#new')!.addEventListener('click', () => {
  if (
    isDirty() &&
    !confirm(
      'Discard your changes and start a new event? Download your work first if you want to keep it.',
    )
  )
    return;
  load(fresh());
  notice.textContent = 'Started a new event.';
});
document.querySelector<HTMLInputElement>('#import')!.addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (
    isDirty() &&
    !confirm(
      'Discard your changes and open this file? Download your work first if you want to keep it.',
    )
  ) {
    input.value = '';
    return;
  }
  try {
    if (file.size > DRAFT_LIMIT) throw new Error('File exceeds the 4 MiB draft limit.');
    const value = parseJsonStrict(
      new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Expected an event object.');
    if ((value as RecordObject).format === 'openajang-builder-draft') {
      restoreDraft(value as RecordObject);
      notice.textContent = `Opened draft ${file.name}.`;
      input.value = '';
      return;
    }
    if (file.size > 1024 * 1024) throw new Error('Event file exceeds the 1 MiB limit.');
    const checked = validateSafe(value);
    if (!checked.valid)
      throw new Error(
        'The file is not a valid OpenAjang event: ' +
          checked.errors.map((error) => `${error.path || 'Document'}: ${error.message}`).join('; '),
      );
    load(value as RecordObject);
    notice.textContent = `Opened ${file.name}. Details outside this form have been kept.`;
  } catch (error) {
    notice.textContent = `Could not import file: ${error instanceof Error ? error.message : 'invalid JSON'}`;
  }
  input.value = '';
});
jsonButton.addEventListener('click', () => {
  const event = exportRecord();
  if (event) {
    download(
      new Blob([JSON.stringify(event, null, 2) + '\n'], {
        type: 'application/vnd.openajang+json',
      }),
      'event.openajang.json',
    );
    document.querySelector<HTMLElement>('#export-notice')!.textContent = 'JSON download started.';
  }
});
zipButton.addEventListener('click', () => {
  const event = exportRecord();
  if (!event) return;
  const json = JSON.stringify(event, null, 2) + '\n';
  const structured = schemaOrgForPage(event as OpenAjangEvent);
  const readme =
    'Publish these files together in the same directory on your website.\nOpen index.html to view the event. Its discovery link points to event.openajang.json.\nThe page includes a Schema.org Event in JSON-LD as a demonstration. OpenAjang JSON is the authoritative record; some information cannot be represented in the Schema.org mapping.\nSet the event URL to the public page URL and upload both files over HTTPS.\n\nConversion notes:\n' +
    structured.diagnostics.map((note) => `- ${note}`).join('\n') +
    '\n';
  const zip = zipSync({
    'index.html': strToU8(html(event, structured.json)),
    'event.openajang.json': strToU8(json),
    'README.txt': strToU8(readme),
  });
  download(
    new Blob([zip as BlobPart], { type: 'application/zip' }),
    'openajang-publishing-kit.zip',
  );
  document.querySelector<HTMLElement>('#export-notice')!.textContent = 'ZIP download started. Upload the website files to publish your event.';
});
load(fresh());
