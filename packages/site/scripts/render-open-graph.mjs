// Render the Freshcoat template from the canonical brand assets, without network I/O.
import { readFile, writeFile } from 'node:fs/promises';
import { createRenderer } from '@freshcoat-js/engine';
import { loadCanvasKit } from '@freshcoat-js/engine/node';
import { renderTemplate, describeWarning } from '@freshcoat-js/coatfile/render';

const site = new URL('../', import.meta.url);
const template = JSON.parse(await readFile(new URL('templates/open-graph.coat.json', site), 'utf8'));
const logo = await readFile(new URL('src/assets/openajang-logo.svg', site));
const font = await readFile(new URL('src/assets/fonts/MerriweatherSans.ttf', site));
const renderer = await createRenderer({
  ck: await loadCanvasKit(),
  fonts: { 'Merriweather Sans': [font] },
});
try {
  const [frame] = await renderTemplate(renderer, template, {
    description: template.fields.properties.description.default,
    logo: `data:image/svg+xml;base64,${logo.toString('base64')}`,
  }, {
    exports: [{ supersample: 2 }],
  });
  if (frame.warnings.length) {
    throw new Error(frame.warnings.map(describeWarning).join('\n'));
  }
  if (frame.width !== 1200 || frame.height !== 630) {
    throw new Error(`Unexpected Open Graph dimensions: ${frame.width}×${frame.height}`);
  }
  await writeFile(new URL('public/openajang-og.png', site), frame.bytes);
  console.log('Rendered Freshcoat Open Graph image (1200×630, 2× supersampling).');

  const favicon = await readFile(new URL('static/favicon.svg', site));
  const [icon] = await renderTemplate(renderer, {
    format_version: '1.0', id: 'favicon', name: 'OpenAjang emblem',
    product: 'custom', width: 32, height: 32,
    fields: { type: 'object', properties: {}, required: [] },
    template_data: [{ name: 'favicon', background: {
      id: 'background', type: 'rect', pos: { x: 0, y: 0 },
      size: { width: 32, height: 32 }, properties: { fill: '#fff' },
    }, elements: [{
      id: 'emblem', type: 'image', pos: { x: 0, y: 0 },
      size: { width: 32, height: 32 },
      properties: { src: `data:image/svg+xml;base64,${favicon.toString('base64')}`, fit: 'contain' },
    }] }],
  }, {});
  if (icon.warnings.length) throw new Error(icon.warnings.map(describeWarning).join('\n'));
  await writeFile(new URL('public/favicon.png', site), icon.bytes);
} finally {
  renderer.dispose();
}
