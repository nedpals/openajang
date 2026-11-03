const encoder = new TextEncoder();

/** UTF-8 byte length without Node's Buffer. */
export function utf8ByteLength(value: string): number {
  return encoder.encode(value).byteLength;
}

/** Decodes UTF-8 bytes, throwing on malformed input when fatal is true. */
export function decodeUtf8(bytes: Uint8Array, fatal = true): string {
  return new TextDecoder('utf-8', { fatal }).decode(bytes);
}

/** Concatenates chunks into one buffer without Node's Buffer.concat. */
export function concatBytes(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Normalizes a Headers-like object into a lowercase string record. */
export function headersToRecord(headers: {
  forEach(callback: (value: string, key: string) => void): void;
}): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}
