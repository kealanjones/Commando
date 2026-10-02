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
