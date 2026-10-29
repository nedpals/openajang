import type { OpenAjangEvent } from './types.js';

export function eventId(event: OpenAjangEvent): string {
  return event.id ?? event.url;
}
