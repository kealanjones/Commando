/**
 * Stable natural keys.
 *
 * A seeded row's identity is `<section_id>:<slug(title)>`, so editing the
 * seed file and re-running the seed reconciles against existing rows
 * instead of duplicating them. Changing a title in the seed file changes
 * its key, which the seeder treats as "old row gone, new row arrived" —
 * documented in the README under Re-seeding.
 */
export function slug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function naturalKey(sectionId: string, title: string): string {
  return `${sectionId}:${slug(title)}`;
}
