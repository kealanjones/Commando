/**
 * Dates you already wrote down.
 *
 * One item in two hundred carries a due date, which is why everything in the
 * register feels equally urgent. But the dates are not missing — they are in
 * the wrong field. "9 October, 1-2pm" is sitting in a note; "outbound 14
 * September, return 25 September" is sitting in another.
 *
 * This reads them back out. Nothing here writes: every find is a proposal,
 * shown with the words it came from, and accepted one at a time.
 *
 * Local and offline by design. A date parser that needs a network call to
 * read "9 October" would be a worse parser.
 */
import type { Task } from './types';

export type Certainty = 'exact' | 'likely' | 'vague';

export interface DateFind {
  task: Task;
  /** ISO yyyy-mm-dd. */
  due: string;
  /** The words it came from, for showing your own writing back to you. */
  evidence: string;
  /** Which field carried it. */
  where: 'title' | 'context' | 'note';
  certainty: Certainty;
  /** Why this date and not another — shown next to it, in plain words. */
  reason: string;
}

/** An item that states a deadline in words, with no day to pin it to. */
export interface DeadlineHint {
  task: Task;
  /** "ahead of the Australia trip", "before Sydney". */
  evidence: string;
  where: 'title' | 'context' | 'note';
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_RE = MONTHS.map((m) => `${m.slice(0, 3)}(?:${m.slice(3)})?`).join('|');

/** "14 September", "9 Oct", "1st May 2027" */
const DAY_MONTH = new RegExp(
  `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b(?:\\s+(\\d{4}))?`, 'i',
);
/** "September 14", "Oct 9 2027" */
const MONTH_DAY = new RegExp(
  `\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'i',
);
/** 2026-09-14 and 14/09/2026 */
const ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const SLASHED = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_RE = new RegExp(`\\b(?:by|before|on|this|next)\\s+(${WEEKDAYS.join('|')})\\b`, 'i');

const END_OF = /\b(?:by |before )?(?:the )?end of (?:the )?(week|month)\b/i;

/**
 * Words that promise a deadline without naming a day. These are yours —
 * "ahead of the Australia trip", "before Sydney" — and no parser should
 * guess at them.
 */
const SOFT_DEADLINE =
  /\b(?:ahead of|before|by|in time for|prior to|deadline|no later than|when(?: |$))\b/i;

/** Words that look like a deadline but are describing something else. */
const NOT_A_DEADLINE = /\b(?:before too long|before progressing|before it|before they|before she|before he)\b/i;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const monthIndex = (word: string) =>
  MONTHS.findIndex((m) => m.startsWith(word.toLowerCase().slice(0, 3)));

/**
 * A day and month with no year means the next time it comes round. It is
 * shown for confirmation either way, so the friendly reading is the right
 * default — nobody writes "9 October" meaning one that has gone.
 */
function withYear(day: number, month: number, year: number | null, today: Date): string | null {
  if (day < 1 || day > 31 || month < 0) return null;
  const y = year ?? today.getFullYear();
  const made = new Date(y, month, day);
  if (made.getMonth() !== month || made.getDate() !== day) return null;   // 31 February
  if (year === null && made < today) return iso(new Date(y + 1, month, day));
  return iso(made);
}

interface Hit { due: string; evidence: string; certainty: Certainty; reason: string }

/** The most specific date in one piece of text, if there is one. */
export function findDate(text: string, today = startOfDay()): Hit | null {
  if (!text) return null;

  const isoM = ISO.exec(text);
  if (isoM) {
    const due = withYear(Number(isoM[3]), Number(isoM[2]) - 1, Number(isoM[1]), today);
    if (due) return { due, evidence: isoM[0], certainty: 'exact', reason: 'a date, spelled out' };
  }

  const slash = SLASHED.exec(text);
  if (slash) {
    // Day first: this register is written in British English throughout.
    const due = withYear(Number(slash[1]), Number(slash[2]) - 1, Number(slash[3]), today);
    if (due) return { due, evidence: slash[0], certainty: 'exact', reason: 'a date, spelled out' };
  }

  const dm = DAY_MONTH.exec(text);
  if (dm) {
    const due = withYear(Number(dm[1]), monthIndex(dm[2]), dm[3] ? Number(dm[3]) : null, today);
    if (due) {
      return dm[3]
        ? { due, evidence: dm[0], certainty: 'exact', reason: 'a date, spelled out' }
        : { due, evidence: dm[0], certainty: 'likely', reason: 'no year given — this is the next one' };
    }
  }

  const md = MONTH_DAY.exec(text);
  if (md) {
    const due = withYear(Number(md[2]), monthIndex(md[1]), md[3] ? Number(md[3]) : null, today);
    if (due) {
      return md[3]
        ? { due, evidence: md[0], certainty: 'exact', reason: 'a date, spelled out' }
        : { due, evidence: md[0], certainty: 'likely', reason: 'no year given — this is the next one' };
    }
  }

  const wd = WEEKDAY_RE.exec(text);
  if (wd) {
    const want = WEEKDAYS.indexOf(wd[1].toLowerCase());
    const ahead = (want - today.getDay() + 7) % 7 || 7;
    const d = new Date(today);
    d.setDate(d.getDate() + ahead);
    const name = wd[1][0].toUpperCase() + wd[1].slice(1).toLowerCase();
    return {
      due: iso(d), evidence: wd[0], certainty: 'vague',
      // Deliberately hedged: a weekday says which day, never which week, and
      // "on Wednesday" inside a note about a trip means that trip's Wednesday.
      reason: `reading this as the coming ${name} — check it is the right one`,
    };
  }

  const eo = END_OF.exec(text);
  if (eo) {
    const d = new Date(today);
    if (eo[1].toLowerCase() === 'week') {
      d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7));   // the coming Friday
    } else {
      d.setMonth(d.getMonth() + 1, 0);                            // the last of this month
    }
    return {
      due: iso(d), evidence: eo[0], certainty: 'vague',
      reason: `read from "${eo[0]}"`,
    };
  }

  return null;
}

const FIELDS: DateFind['where'][] = ['title', 'context', 'note'];
const RANK: Record<Certainty, number> = { exact: 0, likely: 1, vague: 2 };

/**
 * Every open item with a date in its own words and none in its due field.
 *
 * Sorted so the ones you can accept without thinking come first.
 */
export function findDates(tasks: Task[], today = startOfDay()): DateFind[] {
  const out: DateFind[] = [];

  for (const task of tasks) {
    if (task.due || task.done || task.deleted_at || task.kind !== 'task') continue;
    for (const where of FIELDS) {
      const text = task[where];
      if (!text) continue;
      const hit = findDate(text, today);
      if (!hit) continue;
      out.push({
        task, due: hit.due, evidence: hit.evidence, where,
        certainty: hit.certainty, reason: hit.reason,
      });
      break;                       // the title's date beats the note's
    }
  }

  return out.sort((a, b) => RANK[a.certainty] - RANK[b.certainty] || a.due.localeCompare(b.due));
}

/**
 * Items that promise a deadline without naming one: "ahead of the Australia
 * trip", "before Sydney". No parser should guess at these, so they are only
 * gathered up and put in front of you.
 */
export function findDeadlineHints(tasks: Task[], today = startOfDay()): DeadlineHint[] {
  const dated = new Set(findDates(tasks, today).map((f) => f.task.id));
  const out: DeadlineHint[] = [];

  for (const task of tasks) {
    if (task.due || task.done || task.deleted_at || task.kind !== 'task') continue;
    if (dated.has(task.id)) continue;
    for (const where of FIELDS) {
      const text = task[where];
      if (!text || NOT_A_DEADLINE.test(text)) continue;
      const m = SOFT_DEADLINE.exec(text);
      if (!m) continue;
      out.push({ task, evidence: phraseAround(text, m.index), where });
      break;
    }
  }
  return out;
}

/** The clause the promise sits in, so the row shows your sentence, not a word. */
function phraseAround(text: string, at: number): string {
  const from = text.lastIndexOf(' ', Math.max(0, at - 1)) + 1;
  const stop = text.slice(at).search(/[,.;]|$/);
  const end = at + (stop === -1 ? text.length - at : stop);
  return text.slice(from, Math.min(end, from + 90)).trim();
}

export const fmtDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  });
