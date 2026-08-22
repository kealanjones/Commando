/**
 * Fixture mode: `VITE_DEMO=1 npm run dev`.
 *
 * Renders the whole app straight from data/register.seed.ts with no
 * Supabase connection and no sign-in — useful for looking at the thing
 * before the backend exists, and for testing layout against the real
 * volume of items. Writes stay in memory and are discarded on reload.
 *
 * Excluded from the normal build path by the flag; nothing here runs
 * unless VITE_DEMO is set.
 */
import { SECTIONS, STREAMS } from '@data/register.seed';
import { naturalKey } from './slug';
import type { Section, Stream, StreamId, Task } from './types';

export const DEMO = import.meta.env.VITE_DEMO === '1';

const OWNER = '00000000-0000-0000-0000-000000000000';

export function demoStreams(): Stream[] {
  return Object.entries(STREAMS).map(([id, s], i) => ({
    id: id as StreamId, owner_id: OWNER, title: s.title, short: s.short, code: s.code, position: i,
  }));
}

export function demoSections(): Section[] {
  return SECTIONS.map((s, i) => ({
    id: s.id, owner_id: OWNER, stream_id: s.stream as StreamId, title: s.title,
    monitor: s.monitor ?? false, position: i, deleted_at: null,
  }));
}

export function demoTasks(): Task[] {
  const now = new Date().toISOString();
  const out: Task[] = [];

  // Plausible recent activity so the dials have something to show. Real
  // installs start with touched_at null and fill in as they are used.
  const touchedDaysAgo: Partial<Record<StreamId, number>> = { isodp: 0, cttl: 11 };

  for (const s of SECTIONS) {
    const add = (raw: string | { t: string; p?: 1; due?: string; note?: string }, kind: Task['kind'], idx: number) => {
      const it = typeof raw === 'string' ? { t: raw } : raw;
      const quiet = touchedDaysAgo[s.stream as StreamId];
      out.push({
        id: `${s.id}-${kind}-${idx}`,
        owner_id: OWNER,
        stream_id: s.stream as StreamId,
        section_id: s.id,
        natural_key: naturalKey(s.id, it.t),
        title: it.t,
        kind,
        context: it.note ?? null,
        note: null,
        done: false, done_at: null,
        do_now: it.p === 1,
        due: it.due ?? null,
        position: idx,
        user_edited: false,
        touched_at:
          quiet === undefined || idx !== 0
            ? null
            : new Date(Date.now() - quiet * 86_400_000).toISOString(),
        created_at: now, updated_at: now, deleted_at: null,
      });
    };
    (s.items ?? []).forEach((i, idx) => add(i, 'task', idx));
    (s.watch ?? []).forEach((i, idx) => add(i, 'watch', idx));
  }
  return out;
}
