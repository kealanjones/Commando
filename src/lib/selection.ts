/**
 * Which item is open, and where it opens.
 *
 * At a desk the register is three panes and an item opens in the right
 * one, beside the list it came from, so you can move down a list editing
 * as you go. Narrower than that there is no room for a third pane, and an
 * item lifts off the page as a card instead (TaskSheet).
 */
import { createContext, useContext, useSyncExternalStore } from 'react';

/** Wide enough for index, list and folio side by side. */
export const WIDE_QUERY = '(min-width: 1100px)';

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(WIDE_QUERY);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

export const useWide = (): boolean =>
  useSyncExternalStore(subscribe, () => Boolean(window.matchMedia?.(WIDE_QUERY).matches), () => false);

/** The selected item's id, for rows to mark themselves. */
export const SelectedContext = createContext<string | null>(null);
export const useSelectedId = () => useContext(SelectedContext);
