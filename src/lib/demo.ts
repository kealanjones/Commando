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
import { GROUPS, SECTIONS, STREAMS } from '@data/register.seed';
import { KNOWN_PEOPLE } from '@data/people';
import { naturalKey } from './slug';
import { fold } from './structure';
import type { IntakeItem, MemoryEntry, MemoryMeeting, MemoryNote, Person, Section, Stream, StreamId, Task } from './types';

export const DEMO = import.meta.env.VITE_DEMO === '1';

const OWNER = '00000000-0000-0000-0000-000000000000';

export function demoStreams(): Stream[] {
  return Object.entries(STREAMS).map(([id, s], i) => ({
    id: id as StreamId, owner_id: OWNER, title: s.title, short: s.short, code: s.code,
    realm: s.realm, position: i,
  }));
}

/** Fixture sections as the old seed laid them out: three levels. */
function seedSections(): Section[] {
  // Groups come first so a parent always exists before the sections that
  // name it — the same order the seeder writes them in.
  const groups: Section[] = GROUPS.map((g, i) => ({
    id: g.id, owner_id: OWNER, stream_id: g.stream as StreamId, title: g.title,
    parent_id: null, monitor: false, position: i, deleted_at: null,
  }));
  const leaves: Section[] = SECTIONS.map((s, i) => ({
    id: s.id, owner_id: OWNER, stream_id: s.stream as StreamId, title: s.title,
    parent_id: s.group ?? null, monitor: s.monitor ?? false, position: i, deleted_at: null,
  }));
  return [...groups, ...leaves];
}

export function demoPeople(): Person[] {
  return KNOWN_PEOPLE.map((p, i) => ({
    id: `demo-person-${i}`,
    name: p.name,
    role: p.role ?? null,
  }));
}

/**
 * Who is named on which task — the same extraction the real seeder does,
 * so the People view and the review's waiting-on line work in fixture mode.
 */
export function demoTaskPeople(tasks: Task[]): { task_id: string; person_id: string }[] {
  const out: { task_id: string; person_id: string }[] = [];
  KNOWN_PEOPLE.forEach((p, i) => {
    const re = new RegExp(
      `(^|[^\\p{L}])${p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`,
      'u',
    );
    for (const t of tasks) {
      if (re.test(`${t.title} ${t.context ?? ''}`)) {
        out.push({ task_id: t.id, person_id: `demo-person-${i}` });
      }
    }
  });
  return out;
}

/** Fixture sections, folded into sub-focuses the way 0011 folds a real register. */
export function demoSections(): Section[] {
  return fold(seedSections(), []).sections;
}

export function demoTasks(): Task[] {
  return fold(seedSections(), seedTasks()).tasks;
}

function seedTasks(): Task[] {
  const now = new Date().toISOString();
  const out: Task[] = [];

  // Illustrative activity so "touched" and "quiet" have something to show. A real
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
    const add = (raw: string | { t: string; p?: 1; due?: string; note?: string }, tag: 'task' | 'watch', idx: number) => {
      const it = typeof raw === 'string' ? { t: raw } : raw;
      const quiet = touchedDaysAgo[s.stream as StreamId];
      out.push({
        id: `${s.id}-${tag}-${idx}`,
        owner_id: OWNER,
        stream_id: s.stream as StreamId,
        section_id: s.id,
        natural_key: naturalKey(s.id, it.t),
        title: it.t,
        kind: 'task',
        context: it.note ?? null,
        note: null,
        done: false, done_at: null, cleared_at: null, tag: null,
        do_now: it.p === 1,
        due: it.due ?? null,
        // Former watch items follow the section's tasks (0009).
        position: tag === 'watch' ? (s.items?.length ?? 0) + idx : idx,
        user_edited: false,
        reviewed_at: null,
        unclear: false,
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

  // A week of finished things, so the Done filter has something to show
  // without a database. Extra rows rather than ticked seed rows: the counts
  // every other screen is checked against stay what they are. Nothing today,
  // so "done today" starts at zero.
  const finished: [StreamId, string, number][] = [
    ['isodp', 'Sent Isaac the revised registration numbers', 1],
    ['isodp', 'Booked the room for the sponsorship huddle', 1],
    ['dir', 'Returned the SMT actions to Anthony', 1],
    ['cttl', 'Confirmed the Sydney hotel block', 2],
    ['isodp', 'Chased OrganOx for the signed letter', 2],
    ['dir', 'Signed off the performance pack', 2],
    ['dir', 'Booked Steph\u2019s one-to-one', 2],
    ['per', 'Paid the allotment fee', 3],
    ['isodp', 'Sent the venue the revised floor plan', 4],
    ['career', 'Drafted the application paragraph', 5],
    ['cttl', 'Sent Emirates the fare basis query', 5],
    ['isodp', 'Read the ILTS sponsorship terms', 6],
    ['per', 'Renewed the car insurance', 6],
  ];
  const stamp = (daysAgo: number) => {
    const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(14, 0, 0, 0);
    return d.toISOString();
  };
  finished.forEach(([stream, title, daysAgo], i) => {
    const section = SECTIONS.find((s) => s.stream === stream)!;
    out.push({
      id: `done-${i}`, owner_id: OWNER, stream_id: stream, section_id: section.id,
      natural_key: null, title, kind: 'task', context: null, note: null,
      done: true, done_at: stamp(daysAgo), cleared_at: stamp(daysAgo), tag: null, do_now: false, due: null, position: 900 + i,
      user_edited: true, reviewed_at: null, unclear: false, touched_at: stamp(daysAgo),
      created_at: now, updated_at: now, deleted_at: null,
    });
  });
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
    kind: 'task',
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
    mk(0, 'Send Isaac the revised registration cost model before Friday', 'task', 'isodp-g-finance', 'isodp', {
      do_now: true,
      waiting_on: ['Isaac'],
      confidence: 'high',
      evidence: 'Isaac needs the revised numbers before he can sign anything off — end of the week at the latest.',
      context: 'He cannot approve the budget line without them.',
    }),
    mk(1, 'Ask Suzanne how TTS handled multi-currency registration at Kyoto', 'task', 'isodp-g-finance', 'isodp', {
      waiting_on: ['Suzanne'],
      confidence: 'high',
      evidence: 'Suzanne will know — they had exactly this problem in Kyoto.',
    }),
    mk(2, 'Confirm the QEII holds the October LOC date before booking travel', 'task', 'isodp-g-logistics', 'isodp', {
      confidence: 'medium',
      evidence: 'We should not book anything until the QEII confirms the room.',
    }),
    mk(3, 'Chase Belaal for an update on Satya\'s Australia trip', 'task', 'cttl-aus', 'cttl', {
      confidence: 'high',
      waiting_on: ['Belaal'],
      evidence: 'Someone needs to chase Belaal again about the Australia arrangements.',
      duplicate_of: 'cttl-aus-task-2',
    }),
    mk(4, 'Decide whether the Fellowship interview panel needs an external member', 'task', null, null, {
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
      `(Fixture mode: these proposals are fixed, ` +
      `not read from your ${text.trim().split(/\s+/).length} words.)`,
    count: items.length,
    duplicates: items.filter((i) => i.duplicate_of).length,
  };
}

// ── memory, in fixture mode ─────────────────────────────────────────
// A small memory as two meetings would have built it, so the Memory page
// can be seen and tested without the database or an API key.

export function demoMemory(): { notes: MemoryNote[]; entries: MemoryEntry[]; meetings: MemoryMeeting[] } {
  const day = (n: number) => {
    const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString();
  };
  const meetings: MemoryMeeting[] = [
    { id: 'demo-meeting-1', label: 'SMT, sponsorship', created_at: day(9), in_memory: true, remembered_at: day(9) },
    { id: 'demo-meeting-2', label: 'ISODP weekly', created_at: day(2), in_memory: true, remembered_at: day(2) },
    { id: 'demo-meeting-3', label: 'Catch-up with Steph', created_at: day(1), in_memory: true, remembered_at: null },
  ];
  const notes: MemoryNote[] = [
    { id: 'demo-note-isodp', kind: 'project', key: 'isodp', title: 'ISODP 2027',
      now: 'Sponsorship is the critical path: OrganOx has agreed in principle and the payment route is still the blocker. Registration numbers go to Isaac before he can sign off the budget.',
      updated_at: day(2) },
    { id: 'demo-note-anthony', kind: 'person', key: 'anthony', title: 'Anthony',
      now: 'Director. Wants the priority sponsor list before Sydney and prefers a short chasing text over long emails.',
      updated_at: day(2) },
    { id: 'demo-note-payments', kind: 'topic', key: 'sponsor-payments', title: 'Sponsor payments',
      now: 'No agreed route for taking sponsor money yet. Suzanne solved the same problem at Kyoto with TTS.',
      updated_at: day(9) },
  ];
  const entries: MemoryEntry[] = [
    { id: 'demo-entry-1', note_id: 'demo-note-isodp', intake_id: 'demo-meeting-1', happened_on: day(9).slice(0, 10), text: 'OrganOx agreed in principle to a headline sponsorship, pending a signed letter.' },
    { id: 'demo-entry-2', note_id: 'demo-note-isodp', intake_id: 'demo-meeting-2', happened_on: day(2).slice(0, 10), text: 'Isaac will not sign off the budget line until he has the revised registration numbers.' },
    { id: 'demo-entry-3', note_id: 'demo-note-anthony', intake_id: 'demo-meeting-2', happened_on: day(2).slice(0, 10), text: 'Anthony asked for the short priority sponsor list before Sydney.' },
    { id: 'demo-entry-4', note_id: 'demo-note-payments', intake_id: 'demo-meeting-1', happened_on: day(9).slice(0, 10), text: 'Suzanne handled multi-currency registration at Kyoto through TTS; worth asking how.' },
  ];
  return { notes, entries, meetings };
}

/** A fixed answer in fixture mode, citing the first meeting. */
export function demoAnswer(question: string): { answer: string; sources: { intake_id: string; label: string; date: string }[] } {
  const m = demoMemory().meetings[0];
  return {
    answer: `From the memory: OrganOx agreed in principle to a headline sponsorship, pending a signed letter. (Fixture answer to "${question}".)`,
    sources: [{ intake_id: m.id, label: m.label ?? 'Meeting', date: m.created_at.slice(0, 10) }],
  };
}
