/**
 * The switches that are yours, on this device, and survive a reload. None
 * is written to the register: how you look at it is not a fact about it.
 *
 * Realm: work, personal, or both. It is applied inside the queries, so a
 * route never has to remember to filter — in Work, the personal streams
 * are not dimmed or folded, they are simply not there.
 *
 * Paper and light: which look the register wears. Ledger or Notebook, and
 * light, dark, or whatever the device is set to.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { STREAMS } from '@data/register.seed';
import type { Realm, RealmScope, Stream } from './types';

type Listener = () => void;

function setting<T extends string>(key: string, initial: T, valid: readonly T[]) {
  const read = (): T => {
    try {
      const v = localStorage.getItem(key);
      return valid.includes(v as T) ? (v as T) : initial;
    } catch {
      return initial;
    }
  };
  let value = read();
  const subs = new Set<Listener>();
  return {
    get: () => value,
    set: (v: T) => {
      if (v === value) return;
      value = v;
      try { localStorage.setItem(key, v); } catch { /* private mode: it lasts the session */ }
      subs.forEach((l) => l());
    },
    subscribe: (l: Listener) => { subs.add(l); return () => { subs.delete(l); }; },
  };
}

const realm = setting<RealmScope>('commando.realm', 'all', ['work', 'personal', 'all']);

export type Paper = 'ledger' | 'notebook';
export type Light = 'system' | 'light' | 'dark';
const paper = setting<Paper>('commando.paper', 'ledger', ['ledger', 'notebook']);
const light = setting<Light>('commando.light', 'system', ['system', 'light', 'dark']);

export const useRealm = (): RealmScope =>
  useSyncExternalStore(realm.subscribe, realm.get, () => 'all');
export const setRealm = (r: RealmScope) => realm.set(r);

export const usePaper = (): Paper => useSyncExternalStore(paper.subscribe, paper.get, () => 'ledger');
export const setPaper = (p: Paper) => paper.set(p);
export const useLight = (): Light => useSyncExternalStore(light.subscribe, light.get, () => 'system');
export const setLight = (l: Light) => light.set(l);

/**
 * Put the paper and the resolved light on <html>, where tokens.css reads
 * them. "System" follows the device live, so the page turns dark at the
 * same moment the laptop does.
 */
export function useApplyLook() {
  const p = usePaper();
  const l = useLight();
  const first = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = l === 'dark' || (l === 'system' && Boolean(media?.matches));
      root.dataset.paper = p;
      root.dataset.light = dark ? 'dark' : 'light';
      const paperColour = getComputedStyle(root).getPropertyValue('--paper').trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', paperColour || '#FFFFFF');
    };
    // A change of paper or light cross-fades the whole page where the
    // browser can; the first paint simply is what it is.
    type VT = Document & { startViewTransition?: (cb: () => void) => unknown };
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!first.current && !still && (document as VT).startViewTransition) {
      (document as VT).startViewTransition!(apply);
    } else {
      apply();
    }
    first.current = false;
    if (l !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [p, l]);
}

export const REALM_LABEL: Record<RealmScope, string> = {
  work: 'Work', personal: 'Personal', all: 'Both',
};

/**
 * A stream's realm, with the seed's answer as the fallback for a database
 * the migration has not reached yet — the app deploys before the column
 * exists, and Work must not become everything in the meantime.
 */
export function realmOf(s: Pick<Stream, 'id'> & { realm?: Realm | null }): Realm {
  if (s.realm === 'work' || s.realm === 'personal') return s.realm;
  return (STREAMS as Record<string, { realm: Realm }>)[s.id]?.realm ?? 'work';
}

export const inScope = (scope: RealmScope, s: Pick<Stream, 'id'> & { realm?: Realm | null }) =>
  scope === 'all' || realmOf(s) === scope;
