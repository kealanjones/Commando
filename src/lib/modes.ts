/**
 * The two switches that change what every screen is.
 *
 * Realm: work, personal, or both. It is applied inside the queries, so a
 * route never has to remember to filter — in Work, the personal streams
 * are not dimmed or folded, they are simply not there.
 *
 * Focus: the same screens with the chrome taken off. What is left is the
 * work and the ticks.
 *
 * Both are yours, on this device, and survive a reload. Neither is written
 * to the register: which life you are looking at is not a fact about it.
 */
import { useSyncExternalStore } from 'react';
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
const focus = setting<'on' | 'off'>('commando.focus', 'off', ['on', 'off']);

export const useRealm = (): RealmScope =>
  useSyncExternalStore(realm.subscribe, realm.get, () => 'all');
export const setRealm = (r: RealmScope) => realm.set(r);

export const useFocus = (): boolean =>
  useSyncExternalStore(focus.subscribe, focus.get, () => 'off') === 'on';
export const setFocus = (on: boolean) => focus.set(on ? 'on' : 'off');

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
