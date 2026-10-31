import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { sectionIds } from './lib/docs-nav';

// The documents live at the repo root; the site renders them in place.
const docs = defineCollection({
  loader: glob({ base: '../..', pattern: ['SPEC.md', 'FEEDS.md', 'CONVERSIONS.md', 'EXTENSIONS.md'] })
});

// Role-based guides; each file is one page at /docs/<file name>/.
const guides = defineCollection({
  loader: glob({ base: './src/content/guides', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.enum(sectionIds),
    order: z.number()
  })
});

export const collections = { docs, guides };
