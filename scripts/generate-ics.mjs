import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJsonStrict } from '../packages/core/dist/index.js';
import { toICalendar } from '../packages/core/dist/adapters.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = path.join(root, 'examples');
const out = path.join(root, 'generated');
fs.mkdirSync(out, { recursive: true });

const diagnostics = {};
for (const file of fs.readdirSync(examples).filter(f => f.endsWith('.openajang.json')).sort()) {
  const stem = file.replace('.openajang.json', '');
  const event = parseJsonStrict(fs.readFileSync(path.join(examples, file), 'utf8'));
  const { result, diagnostics: notes } = toICalendar(event);
  const target = path.join(out, stem + '.ics');
  if (result) {
    fs.writeFileSync(target, result);
  } else {
    fs.rmSync(target, { force: true });
  }
  diagnostics[stem] = { generated: result !== null, diagnostics: notes };
}
fs.writeFileSync(path.join(out, 'icalendar-diagnostics.json'), JSON.stringify(diagnostics, null, 2) + '\n');
console.log(JSON.stringify({ icalendar_outputs: Object.values(diagnostics).filter(x => x.generated).length, examples: Object.keys(diagnostics).length }));
