import { toSchemaOrg } from '@openajang/core/adapters';
import type { OpenAjangEvent } from '@openajang/core';

/** Encode JSON-LD for an HTML script element without allowing markup to end it. */
export function schemaOrgForPage(event: OpenAjangEvent) {
  const { result, diagnostics } = toSchemaOrg(event);
  const json = JSON.stringify(result, null, 2).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return { json, diagnostics };
}
