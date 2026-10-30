export const sections = [
  { id: 'start', label: 'Start' },
  { id: 'organizers', label: 'Organizers' },
  { id: 'platforms', label: 'Platform developers' },
  { id: 'apps', label: 'App and directory builders' },
  { id: 'developers', label: 'Developers' },
  { id: 'evaluate', label: 'Evaluate and reference' }
] as const;

export const sectionIds = ['start', 'organizers', 'platforms', 'apps', 'developers', 'evaluate'] as const;

export type SectionId = (typeof sectionIds)[number];

interface GuideEntry {
  id: string;
  data: { title: string; section: SectionId; order: number };
}

/** The Start guide is the docs index; every other guide lives at /docs/<id>/. */
export const guideHref = (id: string) => (id === 'start' ? '/docs/' : `/docs/${id}/`);

/** Guides grouped by section, in section order, then by each guide's `order`. */
export function getNav<T extends GuideEntry>(entries: T[]) {
  return sections
    .map((section) => ({
      ...section,
      entries: entries.filter((entry) => entry.data.section === section.id).sort((a, b) => a.data.order - b.data.order)
    }))
    .filter((group) => group.entries.length > 0);
}
