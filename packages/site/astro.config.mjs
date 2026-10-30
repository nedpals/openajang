import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { rewriteRepoLinks } from './scripts/rewrite-repo-links.mjs';

export default defineConfig({
  site: 'https://openajang.nedpals.xyz',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [rewriteRepoLinks]
  }
});
