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
import type { IntakeItem, Section, Stream, StreamId, Task } from './types';

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

  // Illustrative activity so all five dials have something to show. A real
  // install starts with touched_at null on every row and fills in as it is
  // used — nothing here is inferred from the seed data.
  const touchedDaysAgo: Partial<Record<StreamId, number>> = {
    isodp: 0,   // worked today
    dir: 3,
    cttl: 11,   // drifting, with a flight in three weeks
    career: 19, // the one you avoid
    per: 26,    // past the 21-day scale: ring fully empty
  };

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

/**
 * Fixture-mode extraction.
 *
 * Returns a fixed set of proposals so the triage screen can be seen and
 * tested with no Edge Function and no API key. The real extraction lives in
 * supabase/functions/extract.
 */
export function demoExtraction(text: string, label?: string) {
  const now = new Date().toISOString();
  const mk = (
    n: number,
    title: string,
    kind: 'task' | 'watch',
    sectionId: string | null,
    streamId: StreamId | null,
    extra: Partial<IntakeItem> = {},
  ): IntakeItem => ({
    id: `demo-item-${n}`,
    intake_id: 'demo-intake',
    owner_id: OWNER,
    title,
    kind,
    context: null,
    stream_id: streamId,
    section_id: sectionId,
    do_now: false,
    due: null,
    waiting_on: [],
    evidence: null,
    confidence: 'medium',
    duplicate_of: null,
    status: 'pending',
    task_id: null,
    position: n,
    created_at: now,
    ...extra,
  });

  const items: IntakeItem[] = [
    mk(0, 'Send Isaac the revised registration cost model before Friday', 'task', 'isodp-pay', 'isodp', {
      do_now: true,
      waiting_on: ['Isaac'],
      confidence: 'high',
      evidence: 'Isaac needs the revised numbers before he can sign anything off — end of the week at the latest.',
      context: 'He cannot approve the budget line without them.',
    }),
    mk(1, 'Ask Suzanne how TTS handled multi-currency registration at Kyoto', 'task', 'isodp-pay', 'isodp', {
      waiting_on: ['Suzanne'],
      confidence: 'high',
      evidence: 'Suzanne will know — they had exactly this problem in Kyoto.',
    }),
    mk(2, 'Confirm the QEII holds the October LOC date before booking travel', 'task', 'isodp-hotels', 'isodp', {
      confidence: 'medium',
      evidence: 'We should not book anything until the QEII confirms the room.',
    }),
    mk(3, 'Getinge are reorganising their European marketing team this autumn', 'watch', 'isodp-leads', 'isodp', {
      confidence: 'high',
      evidence: 'Their marketing lead mentioned a reorganisation coming in the autumn.',
      context: 'Could stall the platinum sponsorship conversation; no action while it plays out.',
    }),
    mk(4, 'DHSC have not yet responded on the TransNovo governance question', 'watch', 'isodp-china', 'isodp', {
      confidence: 'medium',
      evidence: 'Still nothing back from DHSC on the governance side.',
    }),
    mk(5, 'Chase Belaal for an update on Satya\'s Australia trip', 'task', 'cttl-aus', 'cttl', {
      confidence: 'high',
      waiting_on: ['Belaal'],
      evidence: 'Someone needs to chase Belaal again about the Australia arrangements.',
      duplicate_of: 'cttl-aus-task-2',
    }),
    mk(6, 'Decide whether the Fellowship interview panel needs an external member', 'task', null, null, {
      confidence: 'low',
      evidence: 'There was a question about whether we need someone external on the panel.',
    }),
  ];

  (window as unknown as { __demoItems?: IntakeItem[] }).__demoItems = items;

  return {
    intake_id: 'demo-intake',
    summary:
      `${label ? label + '. ' : ''}Mostly the sponsor payment route, which is still the blocker — ` +
      `Isaac needs revised numbers this week and Suzanne has prior experience worth borrowing. ` +
      `Two things worth watching rather than acting on. (Fixture mode: these proposals are fixed, ` +
      `not read from your ${text.trim().split(/\s+/).length} words.)`,
    count: items.length,
    tasks: items.filter((i) => i.kind === 'task').length,
    watch: items.filter((i) => i.kind === 'watch').length,
    duplicates: items.filter((i) => i.duplicate_of).length,
  };
}
