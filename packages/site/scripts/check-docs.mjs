// Mechanical checks for the built site and the guide sources. Run after `pnpm build`.
//   1. Every internal link and #anchor in dist/ resolves.
//   2. Guide Markdown contains no em or en dashes outside code.
//   3. Every ```json fence in a guide is a complete document that passes the
//      Python reference validator (fragments belong in ```jsonc fences).
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..', '..');
const dist = join(site, 'dist');
const guides = join(site, 'src', 'content', 'guides');
const errors = [];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

// 1. Links and anchors in built HTML.
if (!existsSync(dist)) {
  console.error('dist/ is missing. Run `pnpm build` first.');
  process.exit(1);
}
const pages = [...walk(dist)].filter((file) => file.endsWith('.html'));
// Example publisher pages model a separate site, so their root-relative links are not ours.
const isExampleSite = (file) => relative(dist, file).startsWith('examples' + sep);
const idsByPage = new Map();
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  idsByPage.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
}
const targetFile = (pathname) => {
  const clean = decodeURIComponent(pathname);
  const direct = join(dist, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return direct;
  const index = join(dist, clean, 'index.html');
  return existsSync(index) ? index : undefined;
};
for (const file of pages) {
  if (isExampleSite(file)) continue;
  // Markup quoted inside code is documentation, not a link.
  const html = readFileSync(file, 'utf8').replace(/<(pre|code)\b[\s\S]*?<\/\1>/g, '');
  const from = '/' + relative(dist, file).replace(/index\.html$/, '');
  for (const match of html.matchAll(/\shref="([^"]*)"/g)) {
    const href = match[1].replaceAll('&amp;', '&');
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) continue;
    const url = new URL(href, `https://site.invalid${from}`);
    const target = targetFile(url.pathname);
    if (!target) {
      errors.push(`${from}: broken link ${href}`);
      continue;
    }
    if (url.hash.length > 1 && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!idsByPage.get(target)?.has(id)) errors.push(`${from}: missing anchor ${href}`);
    }
  }
}

// 2 and 3. Guide sources.
const python = existsSync(join(repo, '.venv', 'bin', 'python')) ? join(repo, '.venv', 'bin', 'python') : 'python3';
const samples = [];
const sources = existsSync(guides) ? readdirSync(guides).filter((name) => name.endsWith('.md')) : [];
for (const name of sources) {
  const text = readFileSync(join(guides, name), 'utf8');
  const prose = text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '');
  prose.split('\n').forEach((line, index) => {
    if (/[–—]/.test(line)) errors.push(`${name}: em or en dash in prose: ${line.trim().slice(0, 60)}`);
  });
  let count = 0;
  for (const match of text.matchAll(/^```json[ \t]*\n([\s\S]*?)^```/gm)) {
    count += 1;
    try {
      JSON.parse(match[1]);
      samples.push({ name: `${name.replace(/\.md$/, '')}-${count}`, body: match[1] });
    } catch (error) {
      errors.push(`${name}: json block ${count} is not valid JSON (use a jsonc fence for fragments): ${error.message}`);
    }
  }
}
if (samples.length > 0) {
  const dir = mkdtempSync(join(tmpdir(), 'openajang-samples-'));
  const files = samples.map((sample) => {
    const file = join(dir, `${sample.name}.openajang.json`);
    writeFileSync(file, sample.body);
    return file;
  });
  const result = spawnSync(python, [join(repo, 'tools', 'openajang.py'), 'validate', ...files], { encoding: 'utf8', cwd: repo });
  if (result.status !== 0) errors.push(`json samples failed validation:\n${result.stdout}${result.stderr}`.replaceAll(dir, '<tmp>'));
  rmSync(dir, { recursive: true, force: true });
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`ok: ${pages.length} pages, ${sources.length} guides, ${samples.length} json samples.`);
