import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { render } from '../src/scripts/event-html.ts';
test('ticket qualifications survive rendering and markup is escaped', () => {
  const event = JSON.parse(readFileSync('examples/pycon-davao-2026.openajang.json', 'utf8'));
  const ticket = event.tickets.find((t: any) => t.description);
  assert.ok(ticket);
  const description = ticket.description;
  ticket.description += '\n<script>alert(1)</script>';
  const html = render(event);
  assert.ok(html.includes(description));
  assert.ok(html.includes('\n&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('<h1>') && html.includes('<h2>Tickets</h2>'));
});
