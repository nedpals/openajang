import { ISO_3166_1_ALPHA_2, ISO_4217_ALPHA_3 } from './codes.js';
import {
  isFullDate,
  isValidEmail,
  isValidLanguageTag,
  isValidTimeZone,
  isValidUri,
  isValidUrl,
  parseStamp
} from './parser.js';

/**
 * Format definitions bundled into the generated validator. Nothing here may
 * compile code at runtime.
 */
export interface FormatDefinition {
  type: 'string';
  validate: (value: string) => boolean;
  async: false;
}

function isValidStamp(value: string): boolean {
  try {
    parseStamp(value);
    return true;
  } catch {
    return false;
  }
}

export const FORMATS: Record<string, FormatDefinition> = {
  'oa-url': { type: 'string', validate: isValidUrl, async: false },
  'oa-uri': { type: 'string', validate: isValidUri, async: false },
  'oa-email': { type: 'string', validate: isValidEmail, async: false },
  'oa-language': { type: 'string', validate: isValidLanguageTag, async: false },
  'oa-zone': { type: 'string', validate: isValidTimeZone, async: false },
  'oa-country': { type: 'string', validate: (value) => ISO_3166_1_ALPHA_2.has(value), async: false },
  'oa-currency': { type: 'string', validate: (value) => ISO_4217_ALPHA_3.has(value), async: false },
  'oa-date': { type: 'string', validate: isFullDate, async: false },
  'oa-date-time': { type: 'string', validate: isValidStamp, async: false }
};
