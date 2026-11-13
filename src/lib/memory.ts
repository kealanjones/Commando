/**
 * The memory as the app reads it: grouping, the export for Claude.ai, and
 * the short digest that goes into the Via Claude prompt. All pure.
 */
import type { MemoryEntry, MemoryMeeting, MemoryNote } from './types';

export const KIND_TITLE: Record<MemoryNote['kind'], string> = {
  project: 'Projects', person: 'People', topic: 'Topics',
};

/** Notes by kind, each kind alphabetical, newest-touched first on ties. */
export function byKind(notes: MemoryNote[]): Record<MemoryNote['kind'], MemoryNote[]> {
  const out: Record<MemoryNote['kind'], MemoryNote[]> = { project: [], person: [], topic: [] };
  for (const n of notes) if (!n.deleted_at) out[n.kind].push(n);
  for (const k of Object.keys(out) as MemoryNote['kind'][]) {
    out[k].sort((a, b) => a.title.localeCompare(b.title));
  }
  return out;
}

/** A note's timeline, oldest first. */
export function timeline(entries: MemoryEntry[], noteId: string): MemoryEntry[] {
  return entries
    .filter((e) => e.note_id === noteId && !e.deleted_at)
    .sort((a, b) => (a.happened_on ?? '').localeCompare(b.happened_on ?? ''));
}

const meetingName = (m: MemoryMeeting | undefined) =>
  m ? `${m.label ?? 'Meeting'}, ${m.created_at.slice(0, 10)}` : 'added by hand';

/**
 * The whole memory as one Markdown document, to drop into a Claude Project
 * so everyday chats know the work too. Every line says which meeting it
 * came from.
 */
export function exportMarkdown(
  notes: MemoryNote[], entries: MemoryEntry[], meetings: MemoryMeeting[], today = new Date(),
): string {
  const meeting = new Map(meetings.map((m) => [m.id, m]));
  const groups = byKind(notes);
  const live = notes.filter((n) => !n.deleted_at).length;
  const remembered = meetings.filter((m) => m.in_memory && m.remembered_at);
  const lines: string[] = [
    '# My work memory',
    '',
    `Built from ${remembered.length} meeting${remembered.length === 1 ? '' : 's'} in my work register. ${live} notes, exported ${today.toISOString().slice(0, 10)}.`,
    'Each note has where things stand now, then a dated timeline. The meeting each line came from is in brackets.',
    'Treat this as background about my work: who is who, what has been decided, and what is in motion.',
  ];
  for (const kind of ['project', 'person', 'topic'] as const) {
    if (!groups[kind].length) continue;
    lines.push('', `## ${KIND_TITLE[kind]}`);
    for (const n of groups[kind]) {
      lines.push('', `### ${n.title}`);
      if (n.now.trim()) lines.push('', `**Now:** ${n.now.trim()}`);
      const tl = timeline(entries, n.id);
      if (tl.length) {
        lines.push('');
        for (const e of tl) {
          const when = e.happened_on ? `${e.happened_on} ` : '';
          lines.push(`- ${when}${e.text} _(${meetingName(e.intake_id ? meeting.get(e.intake_id) : undefined)})_`);
        }
      }
    }
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * What the memory already knows, short enough to send with every meeting:
 * each note's title and "now". The full timeline stays out; the reader
 * only needs the background to file and word things well.
 */
export function memoryDigest(notes: MemoryNote[], maxChars = 30_000): string {
  const groups = byKind(notes);
  const parts: string[] = [];
  for (const kind of ['project', 'person', 'topic'] as const) {
    for (const n of groups[kind]) {
      parts.push(`- [${kind}] ${n.title}${n.now.trim() ? `: ${n.now.trim()}` : ''}`);
    }
  }
  let out = parts.join('\n');
  if (out.length > maxChars) out = `${out.slice(0, maxChars)}\n…`;
  return out;
}

/** The key a hand-made note is stored under: a person's name, or a topic slug. */
export function noteKey(kind: MemoryNote['kind'], title: string): string {
  const t = title.trim().toLowerCase();
  if (kind === 'person') return t.replace(/\s+/g, ' ').slice(0, 80);
  return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

const wordy = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Words too common to say a note is about something. */
const COMMON = new Set(['with', 'from', 'that', 'this', 'have', 'will', 'into', 'about', 'meeting', 'project', 'work', 'team', 'plan', 'update', 'notes']);

/**
 * The notes worth showing beside something: its project's, the people on
 * it, and any person or topic its words name. A person matches on their
 * full name or first name; a topic on its whole title, or on every
 * distinctive word of it. Project first, then people, then topics.
 */
export function relevantNotes(
  notes: MemoryNote[],
  about: { streamId?: string | null; people?: string[]; text?: string },
  max = 4,
): MemoryNote[] {
  const text = wordy([about.text ?? '', ...(about.people ?? [])].join(' '));
  const named = new Set((about.people ?? []).map((p) => p.trim().toLowerCase()));
  const has = (phrase: string) => phrase.trim().length > 2 && text.includes(wordy(phrase));

  const out: MemoryNote[] = [];
  for (const n of notes) {
    if (n.deleted_at) continue;
    if (n.kind === 'project') {
      if (about.streamId && n.key === about.streamId) out.push(n);
    } else if (n.kind === 'person') {
      const first = n.title.trim().split(/\s+/)[0] ?? '';
      if (named.has(n.key) || named.has(n.title.trim().toLowerCase()) || has(n.title) || (first.length > 3 && has(first))) out.push(n);
    } else {
      const words = wordy(n.title).trim().split(' ').filter((w) => w.length > 3 && !COMMON.has(w));
      if (has(n.title) || (words.length > 1 && words.every((w) => text.includes(` ${w}`)))) out.push(n);
    }
  }
  const rank = { project: 0, person: 1, topic: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title)).slice(0, max);
}

/** A question typed into search: it starts with "?". Returns the question, or null. */
export function asQuestion(q: string): string | null {
  const m = q.match(/^\s*\?\s*(.*)$/s);
  return m ? m[1].trim() : null;
}
