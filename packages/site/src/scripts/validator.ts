import { normalizeDiagnostics } from './diagnostics';
import { Buffer } from 'buffer';
import {
  eventId,
  OpenAjangValidationError,
  parseJsonStrict,
  validateSafe,
  type OpenAjangEvent,
} from '@openajang/core';

globalThis.Buffer = Buffer;

const MAX_BYTES = 1024 * 1024;
const MAX_DIAGNOSTICS = 100;
const form = document.getElementById('form') as HTMLFormElement;
const input = document.getElementById('input') as HTMLTextAreaElement;
const sample = document.getElementById('sample') as HTMLSelectElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const validateButton = document.getElementById('validate') as HTMLButtonElement;
const formatButton = document.getElementById('format') as HTMLButtonElement;
const result = document.getElementById('result') as HTMLElement;
const status = document.getElementById('result-status') as HTMLElement;
const parseStatus = document.getElementById('parse-status') as HTMLElement;
const documentStatus = document.getElementById('document-status') as HTMLElement;
const diagnostics = document.getElementById('diagnostics') as HTMLElement;
const summary = document.getElementById('document-summary') as HTMLElement;
const source = document.getElementById('source-note') as HTMLElement;
const meta = document.getElementById('input-meta') as HTMLElement;

type Diagnostic = { code: string; path: string; message: string };
type StageState = 'idle' | 'passed' | 'failed';
let loadRevision = 0;
let controller: AbortController | undefined;

function setLoading(loading: boolean) {
  validateButton.disabled = loading;
  formatButton.disabled = loading;
  form.setAttribute('aria-busy', String(loading));
}

function cancelLoad() {
  ++loadRevision;
  controller?.abort();
  controller = undefined;
  setLoading(false);
}

function setStage(element: HTMLElement, state: StageState) {
  element.dataset.state = state;
  element.textContent = { idle: 'Not checked', passed: 'Passed', failed: 'Failed' }[state];
}

function show(state: string, message: string, json: StageState = 'idle', document: StageState = 'idle') {
  result.dataset.state = state;
  status.textContent = message;
  setStage(parseStatus, json);
  setStage(documentStatus, document);
  diagnostics.replaceChildren();
  summary.replaceChildren();
  summary.hidden = true;
}

function updateMeta() {
  const lines = input.value ? input.value.split('\n').length : 0;
  const bytes = new TextEncoder().encode(input.value).length;
  meta.textContent = `${lines} ${lines === 1 ? 'line' : 'lines'} · ${bytes.toLocaleString()} bytes`;
}

function referenceFor(error: Diagnostic, jsonError: boolean) {
  const text = `${error.path} ${error.message}`;
  if (jsonError) return ['3-document-and-authoring-rules', 'Document rules'];
  if (/registration|tickets?|closes_at|opens_at|sales_|currency/i.test(text)) return ['7-registration-and-ticket-discovery', 'Registration and tickets'];
  if (/previous_starts_at|history|updated_at|\/status\b|\/id\b/i.test(text)) return ['5-identity-and-lifecycle', 'Identity and lifecycle'];
  if (/starts_at|ends_at|time_zone|date|time|precision|event end/i.test(text)) return ['4-dates-and-time-precision', 'Dates and time'];
  if (/location|venue|organizer|publisher|tags|image|language/i.test(text)) return ['6-parties-locations-and-ancillary-fields', 'Event fields'];
  return ['3-document-and-authoring-rules', 'Document rules'];
}

function showDiagnostics(errors: Diagnostic[], jsonError = false) {
  if (!errors.length) return;
  const hint = document.createElement('p');
  hint.className = 'diagnostic-overflow-hint';
  hint.textContent = 'Scroll the table horizontally to see the specification links.';
  const wrapper = document.createElement('div');
  wrapper.className = 'diagnostic-scroll';
  wrapper.tabIndex = 0;
  wrapper.setAttribute('role', 'region');
  wrapper.setAttribute('aria-label', 'Validation diagnostics; scroll horizontally on small screens');
  const table = document.createElement('table');
  table.className = 'diagnostic-table';
  const caption = table.createCaption();
  caption.textContent = errors.length > MAX_DIAGNOSTICS
    ? `Showing the first ${MAX_DIAGNOSTICS} of ${errors.length} reported problems. Fix these and validate again.`
    : 'Reported problems';
  const header = table.createTHead().insertRow();
  for (const label of ['Location', 'Problem', 'Specification']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    header.append(cell);
  }
  const body = table.createTBody();
  for (const error of errors.slice(0, MAX_DIAGNOSTICS)) {
    const row = body.insertRow();
    const location = document.createElement('th');
    location.scope = 'row';
    const path = document.createElement('code');
    path.textContent = error.path || '(document)';
    location.append(path);
    row.append(location);
    const problem = row.insertCell();
    const message = document.createElement('p');
    message.textContent = error.message;
    const code = document.createElement('small');
    code.textContent = `Rule: ${error.code}`;
    problem.append(message, code);
    const reference = row.insertCell();
    const [anchor, label] = referenceFor(error, jsonError);
    const link = document.createElement('a');
    link.href = `/spec/#${anchor}`;
    link.textContent = label;
    reference.append(link);
  }
  wrapper.append(table);
  diagnostics.append(hint, wrapper);
}

function parseInput(): { value: unknown } | null {
  if (!input.value.trim()) {
    show('ready', 'Add a document first: paste JSON, open a file, or load an example.');
    input.focus();
    return null;
  }
  if (new TextEncoder().encode(input.value).length > MAX_BYTES) {
    show('error', 'Input not checked: this browser tool has a 1 MiB limit. Use the local SDK for a larger document.');
    return null;
  }
  try {
    return { value: parseJsonStrict(input.value) };
  } catch (error) {
    if (error instanceof OpenAjangValidationError) {
      show('invalid', 'JSON parsing failed. Fix the syntax, duplicate properties, or Unicode problem below.', 'failed');
      showDiagnostics(error.diagnostics, true);
    } else {
      show('error', 'The JSON parser could not complete this check. Try a smaller document or use the local SDK.');
    }
    return null;
  }
}

function showSummary(event: OpenAjangEvent) {
  for (const [label, value] of [
    ['Event', event.title],
    ['Status in document', event.status],
    ['Starts, as supplied', event.starts_at],
    ['Event identity', eventId(event)],
  ]) {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    term.textContent = label;
    const description = document.createElement('dd');
    description.textContent = value;
    group.append(term, description);
    summary.append(group);
  }
  summary.hidden = false;
}

function revealResult() {
  result.focus({ preventScroll: true });
  result.scrollIntoView({ block: 'start' });
}

function run(moveFocus = false) {
  cancelLoad();
  const parsed = parseInput();
  if (!parsed) {
    if (moveFocus && input.value.trim()) revealResult();
    return;
  }
  try {
    const validation = validateSafe(parsed.value);
    if (validation.valid && validation.event) {
      show('valid', 'Valid against the bundled OpenAjang 0.1 checks.', 'passed', 'passed');
      showSummary(validation.event);
    } else {
      const visibleErrors = normalizeDiagnostics(validation.errors, parsed.value);
      const count = visibleErrors.length;
      show('invalid', `${count} ${count === 1 ? 'problem' : 'problems'} reported. Fix the document and validate again.`, 'passed', 'failed');
      showDiagnostics(visibleErrors);
    }
  } catch {
    show('error', 'Document validation could not complete. Try again, or report the problem with the SDK.', 'passed');
  }
  if (moveFocus) {
    revealResult();
  }
}

function loadDocument(text: string, description: string, revision: number) {
  if (revision !== loadRevision) return;
  input.value = text;
  source.textContent = description;
  updateMeta();
  run();
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  run(true);
});
input.addEventListener('input', () => {
  cancelLoad();
  sample.value = '';
  source.textContent = 'Edited document. Validation applies only to the text checked.';
  updateMeta();
  show('ready', 'Document changed. Validate again to check the current text.');
});
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    run();
  }
});
formatButton.addEventListener('click', () => {
  cancelLoad();
  const parsed = parseInput();
  if (!parsed) return;
  input.value = JSON.stringify(parsed.value, null, 2);
  updateMeta();
  run();
});
form.addEventListener('reset', () => {
  cancelLoad();
  input.value = '';
  source.textContent = 'Examples are illustrative fixtures; event details have not been rechecked.';
  updateMeta();
  show('ready', 'No document checked yet. Add JSON above, then validate.');
});

document.getElementById('open-file')!.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  cancelLoad();
  const revision = loadRevision;
  sample.value = '';
  if (file.size > MAX_BYTES) {
    show('error', 'File not opened: this browser tool has a 1 MiB limit. Your current editor text has been kept.');
    fileInput.value = '';
    return;
  }
  setLoading(true);
  show('ready', 'Reading the local file…');
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    loadDocument(text, `Local file: ${file.name}. Nothing was uploaded.`, revision);
  } catch {
    if (revision === loadRevision) show('error', 'Could not open this file as UTF-8 JSON. Your current editor text has been kept.');
  } finally {
    if (revision === loadRevision) setLoading(false);
    fileInput.value = '';
  }
});

sample.addEventListener('change', async () => {
  cancelLoad();
  const file = sample.value;
  if (!file) {
    show('ready', 'Choose an example, or validate the document in the editor.');
    return;
  }
  const revision = loadRevision;
  const request = new AbortController();
  controller = request;
  const timer = setTimeout(() => request.abort(), 10000);
  setLoading(true);
  show('ready', 'Loading the example…');
  try {
    const response = await fetch(`/examples/${encodeURIComponent(file)}`, { signal: request.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    loadDocument(text, 'Illustrative example: event details were not rechecked and may be outdated.', revision);
  } catch (error) {
    if (revision !== loadRevision) return;
    sample.value = '';
    show('error', error instanceof Error && error.name === 'AbortError'
      ? 'Loading the example timed out. Try again, or paste JSON. Your editor text has been kept.'
      : 'Could not load the example. Try again, open a file, or paste JSON. Your editor text has been kept.');
  } finally {
    clearTimeout(timer);
    if (revision === loadRevision) setLoading(false);
  }
});
