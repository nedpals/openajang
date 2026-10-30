import { defineConfig } from 'astro/config';
import { rewriteRepoLinks } from './scripts/rewrite-repo-links.mjs';

export default defineConfig({
  site: 'https://openajang.nedpals.xyz',
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [rewriteRepoLinks]
  }
});
