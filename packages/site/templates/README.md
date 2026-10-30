# Open Graph image

`open-graph.coat.json` is a reusable [Freshcoat](https://github.com/dotside-studios/freshcoat)
template. It renders a 1200 × 630 PNG using the site's navy/orange palette, the
canonical `src/assets/openajang-logo.svg`, and the locally hosted Merriweather
Sans font. The `description` field controls the main copy; `logo` accepts an image
source. The template is editable JSON using Freshcoat's coatfile format.

`pnpm run site:build` and `pnpm run site:dev` render it automatically after
syncing public assets. To regenerate just the image after an initial sync, run
`pnpm --filter @openajang/site run og:generate`. Output is
`public/openajang-og.png`, copied by Astro to `dist/openajang-og.png` at build
time. Freshcoat uses 2× supersampling: it renders at 2400 × 1260, then
downsamples to 1200 × 630 for smoother text and vector edges. Do not edit the
generated PNG. The renderer also generates a 32px PNG
favicon from `static/favicon.svg`, whose paths are the emblem from the logo.

The script uses Freshcoat's `renderTemplate` API with its CanvasKit renderer,
loads brand assets locally, and fails on rendering warnings. No remote font or
image service is needed. Both images are generated assets; their source is the
committed template and existing brand artwork rather than an AI image.
