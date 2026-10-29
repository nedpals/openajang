/**
 * Standard media type for OpenAjang documents.
 */
export const MEDIA_TYPE = 'application/vnd.openajang+json';

export class OpenAjangValidationError extends Error {
  constructor(message: string, public readonly diagnostics: { code: string; path: string; message: string }[] = [{ code: 'invalid', path: '', message }]) {
    super(message);
    this.name = 'OpenAjangValidationError';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STAMP_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Checks if a string is a strict full calendar date (YYYY-MM-DD).
 */
export function isFullDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (y === 0 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(0);
  dt.setUTCFullYear(y, m - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Parsed representation of an RFC 3339 date-time instant.
 * Stores timestamp in milliseconds, fractional seconds string, and total epoch seconds as BigInt for microsecond precision.
 */
export interface ParsedStamp {
  epochSeconds: number;
  fractional: string;
  totalMicroseconds: bigint;
}

/**
 * Parses an RFC 3339 date-time with strict known-offset requirements.
 * Rejects leap seconds (:60), unknown offset (-00:00), and invalid offsets.
 */
export function parseStamp(value: string): ParsedStamp {
  const m = value.match(STAMP_RE);
  if (!m) {
    throw new OpenAjangValidationError('Expected known-offset date-time');
  }
  const base = m[1];
  const frac = m[2] || '';
  const offset = m[3];

  if (offset === '-00:00') {
    throw new OpenAjangValidationError('Expected known-offset date-time (-00:00 is forbidden)');
  }

  if (offset !== 'Z') {
    const offH = parseInt(offset.slice(1, 3), 10);
    const offM = parseInt(offset.slice(4), 10);
    if (offH > 23 || offM > 59) {
      throw new OpenAjangValidationError('Invalid offset');
    }
  }

  // Check valid calendar date and time (00-23, 00-59, 00-59)
  const [datePart, timePart] = base.split('T');
  if (!isFullDate(datePart)) {
    throw new OpenAjangValidationError('Invalid date in timestamp');
  }
  const [th, tm, ts] = timePart.split(':').map(Number);
  if (th > 23 || tm > 59 || ts > 59) {
    throw new OpenAjangValidationError('Invalid time in timestamp (seconds must be 00-59)');
  }

  const isoStr = base + (offset === 'Z' ? '+00:00' : offset);
  const dateObj = new Date(isoStr);
  if (isNaN(dateObj.getTime())) {
    throw new OpenAjangValidationError('Invalid date-time instant');
  }

  const epochSeconds = Math.floor(dateObj.getTime() / 1000);
  // Compute microseconds from fractional part
  let fracPadded = '';
  if (frac && frac.startsWith('.')) {
    const digits = frac.slice(1);
    fracPadded = (digits + '000000000').slice(0, 9); // nanoseconds
  } else {
    fracPadded = '000000000';
  }
  const totalMicroseconds = BigInt(epochSeconds) * 1000000n + BigInt(fracPadded.slice(0, 6));

  return {
    epochSeconds,
    fractional: frac,
    totalMicroseconds
  };
}

/**
 * Compare two parsed timestamps. Returns < 0 if a < b, 0 if a == b, > 0 if a > b.
 */
export function compareStamps(a: string, b: string): number {
  const sa = parseStamp(a);
  const sb = parseStamp(b);

  if (sa.epochSeconds !== sb.epochSeconds) {
    return sa.epochSeconds - sb.epochSeconds;
  }
  // Compare fractional strings numerically
  const fa = sa.fractional ? sa.fractional.slice(1) : '0';
  const fb = sb.fractional ? sb.fractional.slice(1) : '0';
  const maxLen = Math.max(fa.length, fb.length);
  const faPad = fa.padEnd(maxLen, '0');
  const fbPad = fb.padEnd(maxLen, '0');
  if (faPad < fbPad) return -1;
  if (faPad > fbPad) return 1;
  return 0;
}

/**
 * Validates RFC 3986 URI syntax.
 */
export function isValidUri(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (/[\s<>"{}|\\^`\x00-\x1f\x7f]/.test(value)) return false;
  // Non-ASCII characters must be percent-encoded
  if (/[^\x00-\x7F]/.test(value)) return false;
  // Must match scheme:scheme-specific-part
  const schemeMatch = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!schemeMatch) return false;
  // Check for broken percent-encoding
  const percentMatches = value.match(/%[0-9a-fA-F]{2}|%/g);
  if (percentMatches) {
    for (const p of percentMatches) {
      if (p.length !== 3) return false;
    }
  }
  // No multiple fragments
  const parts = value.split('#');
  if (parts.length > 2) return false;
  return true;
}

/**
 * Validates HTTP or HTTPS URL per OpenAjang rules:
 * - RFC 3986 absolute URI
 * - http or https scheme
 * - Valid hostname present
 * - No userinfo (username / password forbidden)
 * - Port if present must be 1-65535
 * - No backslashes
 */
export function isValidUrl(value: string): boolean {
  if (typeof value !== 'string' || !isValidUri(value)) return false;
  if (value.includes('\\')) return false;
  try {
    const parsed = new URL(value);
    const scheme = parsed.protocol.toLowerCase();
    if (scheme !== 'http:' && scheme !== 'https:') return false;
    if (!parsed.hostname) return false;
    if (parsed.username || parsed.password) return false;
    if (parsed.port) {
      const port = Number(parsed.port);
      if (isNaN(port) || port <= 0 || port > 65535) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates public email address syntax.
 */
export function isValidEmail(value: string): boolean {
  if (typeof value !== 'string' || /[\r\n\s]/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || !domain.includes('.')) return false;
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(value);
}

/**
 * Validates IANA Time Zone Database identifier using runtime Intl support.
 */
export function isValidTimeZone(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0 || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates BCP 47 language tag syntax.
 */
export function isValidLanguageTag(value: string): boolean {
  if (typeof value !== 'string' || value.trim().length === 0) return false;
  try {
    // Canonical Intl.Locale check
    const loc = new Intl.Locale(value);
    return Boolean(loc.language);
  } catch {
    return false;
  }
}

/**
 * Recursively checks that strings do not contain unpaired Unicode surrogates.
 */
export function checkUnicodeSurrogates(value: unknown, path = ''): void {
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        // High surrogate; must be followed by low surrogate
        if (i + 1 >= value.length) {
          throw new OpenAjangValidationError(`Unpaired Unicode surrogate at ${path || 'root'}`);
        }
        const next = value.charCodeAt(i + 1);
        if (next < 0xdc00 || next > 0xdfff) {
          throw new OpenAjangValidationError(`Unpaired Unicode surrogate at ${path || 'root'}`);
        }
        i++; // skip valid pair
      } else if (code >= 0xdc00 && code <= 0xdfff) {
        // Unmatched low surrogate
        throw new OpenAjangValidationError(`Unpaired Unicode surrogate at ${path || 'root'}`);
      }
    }
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      checkUnicodeSurrogates(value[i], `${path}[${i}]`);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      checkUnicodeSurrogates(k, `${path}.${k}`);
      checkUnicodeSurrogates(v, `${path}.${k}`);
    }
  }
}

/**
 * Parse strict JSON rejecting duplicate keys and non-standard literals (NaN, Infinity).
 */
export function parseJsonStrict(text: string): unknown {
  if (typeof text !== 'string') {
    throw new OpenAjangValidationError('JSON input must be a string');
  }

  // Lexical scan for duplicate keys in object literals and disallowed constants
  let index = 0;
  const len = text.length;

  function skipWhitespace(): void {
    while (index < len) {
      const ch = text.charCodeAt(index);
      if (ch === 0x20 || ch === 0x09 || ch === 0x0a || ch === 0x0d) {
        index++;
      } else {
        break;
      }
    }
  }

  function readString(): string {
    if (text[index] !== '"') {
      throw new OpenAjangValidationError(`Expected '"' at index ${index}`);
    }
    const start = index;
    index++; // skip "
    let out = '';
    while (index < len) {
      const ch = text[index];
      if (ch === '"') {
        index++;
        return out;
      }
      if (ch === '\\') {
        index++;
        if (index >= len) {
          throw new OpenAjangValidationError('Unterminated string escape');
        }
        const esc = text[index];
        index++;
        if (esc === '"' || esc === '\\' || esc === '/') {
          out += esc;
        } else if (esc === 'b') {
          out += '\b';
        } else if (esc === 'f') {
          out += '\f';
        } else if (esc === 'n') {
          out += '\n';
        } else if (esc === 'r') {
          out += '\r';
        } else if (esc === 't') {
          out += '\t';
        } else if (esc === 'u') {
          const hex = text.slice(index, index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new OpenAjangValidationError(`Invalid unicode escape \\u${hex}`);
          }
          out += String.fromCharCode(parseInt(hex, 16));
          index += 4;
        } else {
          throw new OpenAjangValidationError(`Invalid escape character \\${esc}`);
        }
      } else {
        // Control characters inside string are forbidden by RFC 8259
        if (text.charCodeAt(index) < 0x20) {
          throw new OpenAjangValidationError(`Unescaped control character in string at index ${index}`);
        }
        out += ch;
        index++;
      }
    }
    throw new OpenAjangValidationError(`Unterminated string starting at index ${start}`);
  }

  function parseValue(): unknown {
    skipWhitespace();
    if (index >= len) {
      throw new OpenAjangValidationError('Unexpected end of JSON input');
    }
    const ch = text[index];

    if (ch === '{') {
      return parseObject();
    }
    if (ch === '[') {
      return parseArray();
    }
    if (ch === '"') {
      return readString();
    }
    if (ch === 't' && text.startsWith('true', index)) {
      index += 4;
      return true;
    }
    if (ch === 'f' && text.startsWith('false', index)) {
      index += 5;
      return false;
    }
    if (ch === 'n' && text.startsWith('null', index)) {
      index += 4;
      return null;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      return parseNumber();
    }

    throw new OpenAjangValidationError(`Invalid JSON token '${text.slice(index, index + 10)}' at index ${index}`);
  }

  function parseNumber(): number {
    const numStart = index;
    if (text[index] === '-') index++;
    if (text[index] === '0') {
      index++;
    } else if (text[index] >= '1' && text[index] <= '9') {
      while (index < len && text[index] >= '0' && text[index] <= '9') {
        index++;
      }
    } else {
      throw new OpenAjangValidationError(`Invalid number format at index ${numStart}`);
    }

    if (index < len && text[index] === '.') {
      index++;
      if (index >= len || !(text[index] >= '0' && text[index] <= '9')) {
        throw new OpenAjangValidationError(`Invalid fractional number at index ${numStart}`);
      }
      while (index < len && text[index] >= '0' && text[index] <= '9') {
        index++;
      }
    }

    if (index < len && (text[index] === 'e' || text[index] === 'E')) {
      index++;
      if (index < len && (text[index] === '+' || text[index] === '-')) {
        index++;
      }
      if (index >= len || !(text[index] >= '0' && text[index] <= '9')) {
        throw new OpenAjangValidationError(`Invalid exponent in number at index ${numStart}`);
      }
      while (index < len && text[index] >= '0' && text[index] <= '9') {
        index++;
      }
    }

    const numStr = text.slice(numStart, index);
    const val = Number(numStr);
    if (!Number.isFinite(val)) {
      throw new OpenAjangValidationError(`Number out of finite range at index ${numStart}`);
    }
    return val;
  }

  function parseArray(): unknown[] {
    index++; // skip '['
    const arr: unknown[] = [];
    skipWhitespace();
    if (index < len && text[index] === ']') {
      index++;
      return arr;
    }
    while (index < len) {
      arr.push(parseValue());
      skipWhitespace();
      if (index < len && text[index] === ',') {
        index++;
        skipWhitespace();
      } else if (index < len && text[index] === ']') {
        index++;
        return arr;
      } else {
        throw new OpenAjangValidationError(`Expected ',' or ']' at index ${index}`);
      }
    }
    throw new OpenAjangValidationError('Unterminated array');
  }

  function parseObject(): Record<string, unknown> {
    index++; // skip '{'
    const obj: Record<string, unknown> = {};
    const seenKeys = new Set<string>();
    skipWhitespace();
    if (index < len && text[index] === '}') {
      index++;
      return obj;
    }
    while (index < len) {
      skipWhitespace();
      if (text[index] !== '"') {
        throw new OpenAjangValidationError(`Expected property name string at index ${index}`);
      }
      const key = readString();
      if (seenKeys.has(key)) {
        throw new OpenAjangValidationError(`Duplicate JSON property: ${key}`);
      }
      seenKeys.add(key);

      skipWhitespace();
      if (index >= len || text[index] !== ':') {
        throw new OpenAjangValidationError(`Expected ':' after property name at index ${index}`);
      }
      index++; // skip ':'
      const val = parseValue();
      Object.defineProperty(obj, key, { value: val, enumerable: true, writable: true, configurable: true });

      skipWhitespace();
      if (index < len && text[index] === ',') {
        index++;
        skipWhitespace();
      } else if (index < len && text[index] === '}') {
        index++;
        return obj;
      } else {
        throw new OpenAjangValidationError(`Expected ',' or '}' at index ${index}`);
      }
    }
    throw new OpenAjangValidationError('Unterminated object');
  }

  const result = parseValue();
  skipWhitespace();
  if (index < len) {
    throw new OpenAjangValidationError(`Trailing characters after JSON value at index ${index}`);
  }
  checkUnicodeSurrogates(result);
  return result;
}
