/**
 * Finding things in the register.
 *
 * Entirely client-side over the already-cached task list, so it works on the
 * Underground and returns as fast as you can type. Ranked rather than
 * filtered: with 255 items a plain substring match buries the thing you
 * meant under everything that merely mentions the word.
 */
import type { Person, Section, Stream, Task } from './types';

export interface Hit {
  task: Task;
  score: number;
  /** Which field carried the strongest match, for the result line. */
  via: 'title' | 'context' | 'note' | 'section' | 'person';
  section?: Section;
  stream?: Stream;
  people: string[];
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '');

/** Split on whitespace; every term must match something. */
export const terms = (q: string) => norm(q).split(/\s+/).filter(Boolean);

function scoreField(hay: string, term: string): number {
  const h = norm(hay);
  if (!h) return 0;
  if (h === term) return 1000;
  if (h.startsWith(term)) return 500;
  // A match at a word boundary beats one buried mid-word: "org" should find
  // "Organ Recovery" before "reorganisation".
  if (new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(h)) return 300;
  return h.includes(term) ? 150 : 0;
}

export function search(
  query: string,
  tasks: Task[],
  sections: Section[],
  streams: Stream[],
  people: Person[],
  links: { task_id: string; person_id: string }[],
  limit = 40,
): Hit[] {
  const t = terms(query);
  if (t.length === 0) return [];

  const sectionById = new Map(sections.map((s) => [s.id, s]));
  const streamById = new Map(streams.map((s) => [s.id, s]));
  const personById = new Map(people.map((p) => [p.id, p.name]));

  const namesFor = new Map<string, string[]>();
  for (const l of links) {
    const n = personById.get(l.person_id);
    if (n) namesFor.set(l.task_id, [...(namesFor.get(l.task_id) ?? []), n]);
  }

  const hits: Hit[] = [];

  for (const task of tasks) {
    if (task.deleted_at) continue;

    const section = sectionById.get(task.section_id);
    const names = namesFor.get(task.id) ?? [];

    let total = 0;
    let best = 0;
    let via: Hit['via'] = 'title';
    let matchedEvery = true;

    for (const term of t) {
      const scores: [number, Hit['via']][] = [
        [scoreField(task.title, term), 'title'],
        [scoreField(task.context ?? '', term) * 0.5, 'context'],
        [scoreField(task.note ?? '', term) * 0.5, 'note'],
        [scoreField(section?.title ?? '', term) * 0.3, 'section'],
        [Math.max(0, ...names.map((n) => scoreField(n, term))) * 0.4, 'person'],
      ];
      const [top, field] = scores.reduce((a, b) => (b[0] > a[0] ? b : a));
      if (top === 0) { matchedEvery = false; break; }
      total += top;

      // Report the title whenever it matched at all, even if another field
      // scored higher. The result line shows the highlighted title, so
      // labelling it "found in a name" when the name is right there reads as
      // a mistake.
      const titleScore = scores[0][0];
      const effective = titleScore > 0 ? 'title' : field;
      if (top > best) { best = top; via = effective; }
    }

    if (!matchedEvery) continue;

    // Something you can still act on beats something you finished.
    if (task.done) total *= 0.35;
    if (task.kind === 'watch') total *= 0.8;
    if (task.do_now && !task.done) total *= 1.15;
    if (task.due && !task.done) total *= 1.1;

    hits.push({ task, score: total, via, section, stream: streamById.get(task.stream_id), people: names });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Split text into matched and unmatched runs, for highlighting. */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const t = terms(query);
  if (!t.length || !text) return [{ text, hit: false }];

  const marks: boolean[] = new Array(text.length).fill(false);
  const hay = norm(text);

  for (const term of t) {
    let from = 0;
    for (;;) {
      const at = hay.indexOf(term, from);
      if (at === -1) break;
      for (let i = at; i < at + term.length && i < marks.length; i++) marks[i] = true;
      from = at + term.length;
    }
  }

  const out: { text: string; hit: boolean }[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || marks[i] !== marks[start]) {
      out.push({ text: text.slice(start, i), hit: marks[start] });
      start = i;
    }
  }
  return out;
}
