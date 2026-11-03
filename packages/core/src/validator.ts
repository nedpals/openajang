import { caseFold } from 'unicode-case-folding';
import {
  OpenAjangValidationError,
  isFullDate,
  parseStamp,
  compareStamps,
  checkUnicodeSurrogates
} from './parser.js';
import type { Diagnostic, OpenAjangEvent, ValidationResult } from './types.js';
import { schemaValidate as schemaValidateRaw } from './validator.generated.js';

interface SchemaError {
  instancePath: string;
  keyword: string;
  message?: string;
  params: Record<string, unknown>;
}

type SchemaValidator = ((data: unknown) => boolean) & {
  errors?: SchemaError[] | null;
};

// The schema validator is generated at build time by scripts/generate-validator.mjs.
const schemaValidate = schemaValidateRaw as SchemaValidator;

/**
 * Validates an OpenAjang document object against the bundled authoritative schema
 * and procedural rules per SPEC.md.
 * Throws OpenAjangValidationError on invalid data.
 */
export function validate(d: unknown): OpenAjangEvent {
  if (typeof d !== 'object' || d === null || Array.isArray(d)) {
    throw new OpenAjangValidationError('Document must be a single JSON object');
  }

  checkUnicodeSurrogates(d);

  const diagnostics: Diagnostic[] = [];
  const messages: string[] = [];
  const schemaPaths = new Set<string>();
  if (!schemaValidate(d) && schemaValidate.errors) {
    for (const e of schemaValidate.errors as SchemaError[]) {
      const message = e.message ?? 'Invalid value';
      diagnostics.push({ code: e.keyword, path: e.instancePath, message, params: { ...e.params } });
      messages.push(`${e.instancePath || '/'}: ${message}`);
      schemaPaths.add(e.instancePath);
    }
  }

  const doc = d as OpenAjangEvent;
  const procedural = (code: string, path: string, message: string) => {
    diagnostics.push({ code, path, message });
    messages.push(message);
  };
  // Procedural rules run only on values the schema accepted, so one bad field
  // does not hide, or crash, checks on the others.
  const usable = (path: string, value: unknown): value is string => typeof value === 'string' && !schemaPaths.has(path);
  const isRecord = (value: unknown): value is Record<string, any> => typeof value === 'object' && value !== null;

  const startUsable = usable('/starts_at', doc.starts_at);
  const startIsDate = startUsable && isFullDate(doc.starts_at);

  if (startUsable && usable('/ends_at', doc.ends_at)) {
    const endIsDate = isFullDate(doc.ends_at);
    if (startIsDate !== endIsDate) {
      procedural('end-precision-mismatch', '/ends_at', '/ends_at: mixed start/end date-time precision is invalid');
    } else if (startIsDate ? doc.ends_at < doc.starts_at : compareStamps(doc.ends_at, doc.starts_at) <= 0) {
      procedural('end-before-start', '/ends_at', 'Event end does not follow start');
    }
  }

  const reg = doc.registration;
  if (isRecord(reg) && usable('/registration/opens_at', reg.opens_at) && usable('/registration/closes_at', reg.closes_at)
      && compareStamps(reg.closes_at, reg.opens_at) <= 0) {
    procedural('registration-close-before-open', '/registration/closes_at', 'closes_at must follow opens_at');
  }

  if (startUsable && Array.isArray(doc.previous_starts_at)) {
    doc.previous_starts_at.forEach((old, i) => {
      const path = `/previous_starts_at/${i}`;
      if (!usable(path, old) || isFullDate(old) !== startIsDate) return;
      if (startIsDate ? old === doc.starts_at : compareStamps(old, doc.starts_at) === 0) {
        procedural('history-contains-current-start', path, 'History contains current start');
      }
    });
  }

  if (Array.isArray(doc.tickets)) {
    const ticketIds = new Set<string>();
    doc.tickets.forEach((t, i) => {
      if (!isRecord(t)) return;
      if (usable(`/tickets/${i}/sales_start`, t.sales_start) && usable(`/tickets/${i}/sales_end`, t.sales_end)
          && compareStamps(t.sales_end, t.sales_start) <= 0) {
        procedural('ticket-sales-end-before-start', `/tickets/${i}/sales_end`, 'sales_end must follow sales_start');
      }
      if (usable(`/tickets/${i}/id`, t.id)) {
        if (ticketIds.has(t.id)) procedural('ticket-id-duplicate', `/tickets/${i}/id`, 'Duplicate ticket IDs');
        ticketIds.add(t.id);
      }
    });
  }

  // Tags: unique after Unicode case folding
  if (Array.isArray(doc.tags)) {
    const seenTags = new Set<string>();
    doc.tags.forEach((tag, i) => {
      if (!usable(`/tags/${i}`, tag)) return;
      const folded = caseFold(tag);
      if (seenTags.has(folded)) procedural('tag-duplicate', `/tags/${i}`, 'Duplicate tags after case folding');
      seenTags.add(folded);
    });
  }

  const venue = doc.location?.physical?.name;
  if (usable('/location/physical/name', venue)) {
    const folded = caseFold(venue.trim());
    if (folded === 'tba' || folded === 'tbd' || folded === 'to be announced') {
      procedural('placeholder-venue', '/location/physical/name', 'Use physical.status, not a placeholder venue');
    }
  }

  if (diagnostics.length) throw new OpenAjangValidationError(messages.join('; '), diagnostics);

  return doc;
}

/**
 * Non-throwing safe validation function.
 */
export function validateSafe(d: unknown): ValidationResult {
  try {
    const event = validate(d);
    return { valid: true, event, errors: [] };
  } catch (e: unknown) {
    if (e instanceof OpenAjangValidationError) return { valid: false, errors: e.diagnostics };
    throw e;
  }
}
