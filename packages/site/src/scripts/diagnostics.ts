export type Diagnostic = { code: string; path: string; message: string; params?: Record<string, unknown> };
type JsonObject = Record<string, any>;
const object = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);
const authoring = (path: string, message: string): Diagnostic => ({ code: 'authoring', path, message });

/** Page copy for the SDK's procedural rule codes; unknown codes fall back to the SDK message. */
const PROCEDURAL_COPY: Record<string, string> = {
  'end-before-start': 'Choose an end after the start time, or the same or a later date for dates without times.',
  'end-precision-mismatch': 'Start and end must both include times, or both be dates only.',
  'registration-close-before-open': 'Registration must close after it opens.',
  'history-contains-current-start': 'Earlier starts must differ from the current start.',
  'ticket-sales-end-before-start': 'A ticket’s sales end must follow its sales start.',
  'ticket-id-duplicate': 'Give each ticket a different ID.',
  'tag-duplicate': 'Remove the repeated tag; tags that differ only by case count as the same.',
  'placeholder-venue': 'Choose “To be announced” for the venue status instead of entering a placeholder name.',
};

/** Keep validator semantics, but present one concrete recovery action per issue. */
export function normalizeDiagnostics(errors: Diagnostic[], value: unknown): Diagnostic[] {
  const event = object(value) ? value : {};
  const location = object(event.location) ? event.location : {};
  const normalized: Diagnostic[] = [];
  for (const error of errors) {
    if (error.code === 'if') continue;
    const missingProperty = error.code === 'required' ? error.params?.missingProperty : undefined;
    const missing = typeof missingProperty === 'string' ? missingProperty : undefined;
    const path = missing ? `${error.path}/${missing}` : error.path;
    if (path === '/previous_starts_at' && missing && event.status !== 'rescheduled') continue;
    if (error.path === '/location' && error.code === 'not') {
      const unused = location.type === 'virtual' ? 'physical' : location.type === 'physical' ? 'virtual' : undefined;
      if (unused) normalized.push({ code: 'remove-location', path: `/location/${unused}`, message: `Remove retained ${unused === 'physical' ? 'venue' : 'online'} details to use ${location.type === 'virtual' ? 'online' : 'in-person'} attendance.` });
      else normalized.push(error);
      continue;
    }
    // Errors inside retained, incompatible location data are resolved by removing it.
    if ((location.type === 'virtual' && path.startsWith('/location/physical/')) ||
        (location.type === 'physical' && path.startsWith('/location/virtual/'))) continue;
    if (missing) {
      if (path === '/location/physical') normalized.push(authoring('/location/physical/name', 'Enter a venue name, or choose “To be announced” for the venue status.'));
      else if (path === '/location/virtual') normalized.push(authoring('/location/virtual/url', 'Enter the online event URL.'));
      else if (path === '/registration/required') normalized.push(authoring(path, 'Choose whether registration is required when adding registration details.'));
      else if (/\/price\/(amount|currency)$/.test(path)) normalized.push(authoring(path, 'Price needs both an amount and a currency code.'));
      else normalized.push(authoring(path, path === '/previous_starts_at' ? 'Add at least one earlier start for a rescheduled event.' : 'This field is required.'));
      continue;
    }
    if (PROCEDURAL_COPY[error.code]) { normalized.push(authoring(path, PROCEDURAL_COPY[error.code])); continue; }
    const dateUnion = /^\/(starts_at|ends_at|previous_starts_at\/\d+)$/.test(path);
    if (dateUnion && error.code === 'format' && errors.some(other => other.path === error.path && other.code === 'oneOf')) continue;
    if (dateUnion && error.code === 'oneOf') { normalized.push(authoring(path, 'Choose a valid date, with a time if known.')); continue; }
    if (error.code === 'pattern' || error.code === 'format') {
      let message: string;
      if (/\/price\/amount$/.test(path)) message = 'Enter a nonnegative decimal amount, such as 0 or 12.50.';
      else if (/\/price\/currency$/.test(path)) message = 'Enter a valid uppercase currency code, such as PHP or USD.';
      else if (/\/country$/.test(path)) message = 'Enter a valid uppercase two-letter country code, such as PH.';
      else if (path === '/time_zone') message = 'Choose a valid IANA time zone, such as Asia/Manila.';
      else if (/\/(url)$/.test(path)) message = 'Enter a complete public HTTP or HTTPS URL.';
      else if (/\/(opens_at|closes_at|sales_start|sales_end)$/.test(path)) message = 'Choose a complete date and time with a valid UTC offset.';
      else if (/\/email$/.test(path)) message = 'Enter a valid email address.';
      else if (error.code === 'pattern') message = 'Enter a value that is not blank.';
      else { normalized.push(error); continue; }
      normalized.push(authoring(path, message));
      continue;
    }
    normalized.push(error);
  }
  const seen = new Set<string>();
  return normalized.filter(error => {
    const key = `${error.path}|${error.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
