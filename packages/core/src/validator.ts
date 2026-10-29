import Ajv2020Pkg from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import { caseFold } from 'unicode-case-folding';
import { EVENT_SCHEMA } from './schema.js';
import { ISO_3166_1_ALPHA_2, ISO_4217_ALPHA_3 } from './codes.js';
import {
  OpenAjangValidationError,
  isFullDate,
  parseStamp,
  compareStamps,
  isValidUri,
  isValidUrl,
  isValidEmail,
  isValidTimeZone,
  isValidLanguageTag,
  checkUnicodeSurrogates
} from './parser.js';
import type { OpenAjangEvent, ValidationResult } from './types.js';

const Ajv2020 = (Ajv2020Pkg as any).default || Ajv2020Pkg;
const ajv = new Ajv2020({
  allErrors: true,
  strict: false
});

ajv.addFormat('oa-url', (val: string) => isValidUrl(val));
ajv.addFormat('oa-uri', (val: string) => isValidUri(val));
ajv.addFormat('oa-email', (val: string) => isValidEmail(val));
ajv.addFormat('oa-language', (val: string) => isValidLanguageTag(val));
ajv.addFormat('oa-zone', (val: string) => isValidTimeZone(val));
ajv.addFormat('oa-country', (val: string) => ISO_3166_1_ALPHA_2.has(val));
ajv.addFormat('oa-currency', (val: string) => ISO_4217_ALPHA_3.has(val));
ajv.addFormat('oa-date', (val: string) => isFullDate(val));
ajv.addFormat('oa-date-time', (val: string) => {
  try {
    parseStamp(val);
    return true;
  } catch {
    return false;
  }
});

const schemaValidate = ajv.compile(EVENT_SCHEMA);

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

  const valid = schemaValidate(d);
  if (!valid && schemaValidate.errors) {
    const diagnostics = schemaValidate.errors.map((e: ErrorObject) => ({
      code: e.keyword, path: e.instancePath, message: e.message ?? 'Invalid value'
    }));
    throw new OpenAjangValidationError(diagnostics.map((e: { path: string; message: string }) => `${e.path || '/'}: ${e.message}`).join('; '), diagnostics);
  }

  const doc = d as OpenAjangEvent;

  const startIsDate = isFullDate(doc.starts_at);

  if (doc.ends_at !== undefined) {
    const endIsDate = isFullDate(doc.ends_at);
    if (startIsDate !== endIsDate) {
      throw new OpenAjangValidationError('/ends_at: mixed start/end date-time precision is invalid');
    }
    if (startIsDate) {
      if (doc.ends_at < doc.starts_at) {
        throw new OpenAjangValidationError('Event end does not follow start');
      }
    } else {
      if (compareStamps(doc.ends_at, doc.starts_at) <= 0) {
        throw new OpenAjangValidationError('Event end does not follow start');
      }
    }
  }

  if (doc.registration?.opens_at && doc.registration?.closes_at) {
    if (compareStamps(doc.registration.closes_at, doc.registration.opens_at) <= 0) {
      throw new OpenAjangValidationError('closes_at must follow opens_at');
    }
  }

  if (Array.isArray(doc.tickets)) {
    for (const t of doc.tickets) {
      if (t.sales_start && t.sales_end) {
        if (compareStamps(t.sales_end, t.sales_start) <= 0) {
          throw new OpenAjangValidationError('sales_end must follow sales_start');
        }
      }
    }
  }

  // Rescheduled history comparisons: must not contain current start
  if (Array.isArray(doc.previous_starts_at)) {
    for (const old of doc.previous_starts_at) {
      const oldIsDate = isFullDate(old);
      if (oldIsDate === startIsDate) {
        if (oldIsDate) {
          if (old === doc.starts_at) {
            throw new OpenAjangValidationError('History contains current start');
          }
        } else {
          if (compareStamps(old, doc.starts_at) === 0) {
            throw new OpenAjangValidationError('History contains current start');
          }
        }
      }
    }
  }

  if (Array.isArray(doc.tickets)) {
    const ticketIds = new Set<string>();
    for (const t of doc.tickets) {
      if (ticketIds.has(t.id)) {
        throw new OpenAjangValidationError('Duplicate ticket IDs');
      }
      ticketIds.add(t.id);
    }
  }

  // Tags: unique after Unicode case folding
  if (Array.isArray(doc.tags)) {
    const seenTags = new Set<string>();
    for (const tag of doc.tags) {
      const folded = caseFold(tag);
      if (seenTags.has(folded)) {
        throw new OpenAjangValidationError('Duplicate tags after case folding');
      }
      seenTags.add(folded);
    }
  }

  const p = doc.location?.physical;
  if (p && typeof p.name === 'string') {
    const folded = caseFold(p.name.trim());
    if (folded === 'tba' || folded === 'tbd' || folded === 'to be announced') {
      throw new OpenAjangValidationError('Use physical.status, not a placeholder venue');
    }
  }

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
