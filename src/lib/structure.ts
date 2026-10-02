/**
 * The register's shape: projects, and the sub-focuses inside them.
 *
 * Two levels since 0011. `fold` does in memory what that migration does
 * in the database, so fixture mode shows the same shape a migrated
 * register has.
 */
import type { Section, Task } from './types';

/**
 * Fold three levels into two: a section inside a group gives its items to
 * the group, and each item keeps the section's name as its tag.
 */
export function fold(sections: Section[], tasks: Task[]): { sections: Section[]; tasks: Task[] } {
  const byId = new Map(sections.map((s) => [s.id, s]));
  const parentOf = (id: string) => byId.get(id)?.parent_id ?? null;

  // The order the old tree read in, so a sub-focus lists its items the
  // way the sections and items inside it used to.
  const order = new Map(sections.map((s) => [s.id, s.position]));
  const moved = tasks.map((t) => {
    const parent = parentOf(t.section_id);
    return parent
      ? { ...t, section_id: parent, tag: t.tag ?? byId.get(t.section_id)!.title, _from: order.get(t.section_id) ?? 0 }
      : { ...t, _from: -1 };
  });
  const sorted = [...moved].sort((a, b) =>
    a.section_id.localeCompare(b.section_id) || a._from - b._from || a.position - b.position);
  const next = new Map<string, number>();
  const position = new Map<string, number>();
  for (const t of sorted) {
    const n = next.get(t.section_id) ?? 0;
    position.set(t.id, n);
    next.set(t.section_id, n + 1);
  }

  // Sub-focuses in the order the old tree showed them.
  const kept = sections.filter((s) => !s.parent_id);
  const firstChild = (g: Section) =>
    Math.min(...sections.filter((s) => s.parent_id === g.id).map((s) => s.position), g.position);
  const ranked = [...kept].sort((a, b) => firstChild(a) - firstChild(b));

  return {
    sections: ranked.map((s, i) => ({ ...s, position: i })),
    tasks: moved.map(({ _from, ...t }) => ({ ...t, position: position.get(t.id)! })),
  };
}

/** A short, readable id for something new, unique among `taken`. */
export function slugId(title: string, taken: Iterable<string>, prefix = ''): string {
  const base = prefix + (title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'new');
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Positions after moving one entry up or down a list; only what changed. */
export function shift<T extends { id: string; position: number }>(
  list: T[], id: string, by: -1 | 1,
): { id: string; position: number }[] {
  const ordered = [...list].sort((a, b) => a.position - b.position);
  const at = ordered.findIndex((x) => x.id === id);
  const to = at + by;
  if (at < 0 || to < 0 || to >= ordered.length) return [];
  [ordered[at], ordered[to]] = [ordered[to], ordered[at]];
  return ordered
    .map((x, i) => ({ id: x.id, position: i, was: x.position }))
    .filter((x) => x.position !== x.was)
    .map(({ id: i, position }) => ({ id: i, position }));
}
