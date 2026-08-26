/**
 * Where a card came from.
 *
 * Opening an item is not a dialog appearing over a list — it is the row you
 * touched lifting off the page and becoming the whole record. To animate
 * that, the card has to know the rectangle it grew out of, and the row has
 * to hand it over on the way.
 *
 * A module-level handoff rather than a prop, because the open call goes
 * Today → App → sheet and threading a DOM node through that would put
 * layout detail in three components that have no other use for it.
 */
let source: HTMLElement | null = null;

/** Called by a row as it opens: this is what the card grows from. */
export function openedFrom(el: HTMLElement | null) {
  source = el;
}

/**
 * Read and clear. Opening from anywhere that is not a row — search, the
 * map, a thread — leaves this null, and the card falls back to rising from
 * the middle of the screen.
 */
export function takeSource(): HTMLElement | null {
  const el = source;
  source = null;
  return el;
}

/**
 * Where the card should animate back to on close.
 *
 * The list may have moved under it — something ticked, a filter changed, a
 * scroll — so the row is measured again at closing time rather than trusting
 * the rectangle taken on the way in. A row that has gone, or scrolled well
 * out of view, gives null and the card simply settles instead.
 */
export function rectOf(el: HTMLElement | null): DOMRect | null {
  if (!el || !el.isConnected) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const margin = 120;
  if (r.bottom < -margin || r.top > window.innerHeight + margin) return null;
  return r;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
