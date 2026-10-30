import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// The documents live at the repo root; the site renders them in place.
const docs = defineCollection({
  loader: glob({ base: '../..', pattern: ['SPEC.md', 'FEEDS.md', 'CONVERSIONS.md'] })
});

export const collections = { docs };
