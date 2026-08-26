/**
 * Stream → group → section.
 *
 * The middle level is optional: a stream with four sections does not need
 * one, and forcing every section into a group would be filing for its own
 * sake. So a stream's top level is a mix of groups and bare sections, and
 * this module is the single place that knows how to read that shape.
 */
import type { Section } from './types';

export interface Branch {
  /** The group, or the section itself when it stands on its own. */
  node: Section;
  /** Empty when `node` is a section sitting straight under the stream. */
  children: Section[];
  /** The rows that actually hold items: the children, or the node itself. */
  leaves: Section[];
}

/**
 * A stream's top level, in reading order.
 *
 * A group takes the position of its first child rather than one of its own,
 * so the order of the seed file survives grouping unchanged — sections that
 * already read well together stay together.
 */
export function branchesFor(sections: Section[], streamId: string): Branch[] {
  const mine = sections.filter((s) => s.stream_id === streamId);
  const childrenOf = new Map<string, Section[]>();
  for (const s of mine) {
    if (!s.parent_id) continue;
    const list = childrenOf.get(s.parent_id);
    if (list) list.push(s); else childrenOf.set(s.parent_id, [s]);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.position - b.position);

  return mine
    .filter((s) => !s.parent_id)
    .map((node) => {
      const children = childrenOf.get(node.id) ?? [];
      return {
        node,
        children,
        leaves: children.length ? children : [node],
        sortAt: children.length ? children[0].position : node.position,
      };
    })
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ node, children, leaves }) => ({ node, children, leaves }));
}

/** Every row that can hold items in this stream, in reading order. */
export function leavesFor(sections: Section[], streamId: string): Section[] {
  return branchesFor(sections, streamId).flatMap((b) => b.leaves);
}

/** True when this row is a heading over other sections, not a place for work. */
export function isGroup(sectionId: string, all: Section[]): boolean {
  return all.some((s) => s.parent_id === sectionId);
}

/** "Sponsorship › OrganOx", or just "Website" when there is no middle level. */
export function pathOf(sections: Section[], sectionId: string): string {
  const s = sections.find((x) => x.id === sectionId);
  if (!s) return '';
  const parent = s.parent_id ? sections.find((x) => x.id === s.parent_id) : null;
  return parent ? `${parent.title} › ${s.title}` : s.title;
}

/** The group a section sits in, or null when it sits on its own. */
export function groupOf(sections: Section[], sectionId: string): Section | null {
  const s = sections.find((x) => x.id === sectionId);
  if (!s?.parent_id) return null;
  return sections.find((x) => x.id === s.parent_id) ?? null;
}
