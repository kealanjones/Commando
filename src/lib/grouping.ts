/**
 * Finding threads the section structure misses.
 *
 * Sections are a filing system: one item, one place. But work does not
 * arrive that way — Satya's trip is in Commonwealth and in Directorate, and
 * sponsorship runs across five ISODP sections. A thread is an overlay: a
 * named strand that can pull items from anywhere without moving them.
 *
 * Suggestions are computed locally from the words already in the register.
 * No API, no key, works with no signal, and instant on 255 items — which
 * also means a suggestion can be explained: it is always "these share this
 * word", never a black box.
 */
import type { StreamId, Task } from './types';

export interface Suggestion {
  /** Stable across runs, so a dismissal sticks. */
  signature: string;
  /** The anchor term, title-cased for display. */
  label: string;
  taskIds: string[];
  score: number;
  /** How many distinct sections it reaches across. */
  sections: number;
  streams: StreamId[];
}

/**
 * A thread needs a *name*, and only two kinds of word make one.
 *
 * Scoring by how many sections a word reaches sounds right and is exactly
 * backwards: a generic word like "through" or "whether" appears everywhere,
 * so it spans the most sections and wins. The fix is not a longer stopword
 * list — it is to only ever consider words that could name something.
 *
 * Two sources, both drawn from the register itself:
 *
 *   1. Proper nouns — capitalised mid-sentence, or an acronym. Dale, Getinge,
 *      Satya, QEII, HotelMap, VAT. These are what work is actually *about*.
 *   2. The user's own vocabulary — the significant words in their section
 *      titles. Sponsorship, accreditation, abstracts, hotels, budget.
 *
 * Nothing else is eligible, which makes a bad suggestion structurally
 * impossible rather than merely unlikely.
 */

/** Function words, and the imperative verbs this register is written in. */
const STOP = new Set(`
a an and are as at be been being but by for from has have if in into is it its
of on or so than that the their them then there these they this to was were
what when where which who whom will with your you would could should
send chase follow get ask check confirm ensure track keep set make made
do does done take taken put push pull find found need needs needed use using
speak talk call email write draft prepare produce provide share update review
start begin continue develop consider think identify determine establish clarify
arrange organise organize schedule contact reach respond reply answer decide
add remove change move bring give look see know work run
new next last first second third more most other another same each all any some
before after during while until since again also just only very much many
plus etc via per through whether can may might must about against between
relevant appropriate necessary possible current latest final actual exact
thing things item items bit bits area areas
team group list meeting email information details detail note notes

`.trim().split(/\s+/));

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2019]/g, '');

/**
 * Proper nouns and acronyms in a piece of text.
 *
 * Capitalised but not sentence-initial, plus runs of them so "Mark Taylor"
 * and "Custodian Board" survive as one name. Acronyms of two or more capitals
 * count wherever they appear.
 */
function properNouns(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/[.;:!?\n]/)) {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    let run: string[] = [];

    const flush = () => {
      if (run.length) out.push(run.join(' '));
      run = [];
    };

    words.forEach((raw, i) => {
      const w = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
      if (!w) { flush(); return; }

      const acronym = /^[A-Z]{2,}[0-9]*$/.test(w);
      const capitalised = /^\p{Lu}/u.test(w) && w.length > 2;
      // The first word of a sentence is capitalised by grammar, not meaning —
      // unless it is an acronym, which is capitalised either way.
      const meaningful = acronym || (capitalised && i > 0);

      if (meaningful && !STOP.has(norm(w))) run.push(w);
      else flush();
    });
    flush();
  }
  return out;
}

/** The user's own words for what things are about, from their section titles. */
function domainTerms(sections: { title: string }[]): Set<string> {
  const out = new Set<string>();
  for (const s of sections) {
    for (const w of norm(s.title).split(/[^a-z0-9]+/)) {
      if (w.length >= 4 && !STOP.has(w)) out.add(w);
    }
  }
  return out;
}

const titleCase = (s: string) =>
  s.split(' ').map((w) => (/^[A-Z]{2,}/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');

export interface GroupingOptions {
  minSize?: number;
  maxSize?: number;
  limit?: number;
  /** Words that are background rather than a thread — stream names, the employer. */
  ambientTerms?: string[];
  /** Signatures the user has already said no to. */
  dismissed?: Set<string>;
  /** Tasks already in a thread are not offered again. */
  alreadyGrouped?: Set<string>;
}

export function suggestGroups(
  tasks: Task[],
  sections: { title: string }[],
  opts: GroupingOptions = {},
): Suggestion[] {
  const { minSize = 3, maxSize = 18, limit = 8, dismissed = new Set(), alreadyGrouped = new Set() } = opts;

  const live = tasks.filter((t) => !t.deleted_at && !t.done && !alreadyGrouped.has(t.id));
  if (live.length < minSize) return [];

  const domain = domainTerms(sections);

  /**
   * Ambient context is not a thread.
   *
   * A stream's own name groups nothing inside it, and a term that turns up
   * across most of the register — an employer, a venue everything happens at
   * — is the background, not a strand through it.
   */
  const ambient = new Set(
    (opts.ambientTerms ?? []).map((t) => norm(t)).filter(Boolean),
  );

  // Build the eligible vocabulary first: nothing outside it can ever be
  // suggested, whatever its statistics look like.
  const anchors = new Map<string, string>();   // normalised -> display form
  for (const t of live) {
    for (const noun of properNouns(`${t.title} ${t.context ?? ''}`)) {
      const key = norm(noun);
      if (key.length >= 3 && !anchors.has(key)) anchors.set(key, noun);
    }
    for (const w of norm(`${t.title} ${t.context ?? ''}`).split(/[^a-z0-9]+/)) {
      if (domain.has(w)) anchors.set(w, titleCase(w));
    }
  }

  // Which tasks each anchor actually appears in.
  const index = new Map<string, string[]>();
  for (const [key] of anchors) {
    if (ambient.has(key)) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'u');
    const ids = live.filter((t) => re.test(norm(`${t.title} ${t.context ?? ''}`))).map((t) => t.id);
    if (ids.length >= minSize && ids.length <= maxSize) index.set(key, ids);
  }

  const byId = new Map(live.map((t) => [t.id, t]));
  const candidates: Suggestion[] = [];

  for (const [key, ids] of index) {
    const items = ids.map((id) => byId.get(id)!);
    const sectionIds = new Set(items.map((t) => t.section_id));
    const streamIds = [...new Set(items.map((t) => t.stream_id))];

    // A strand living inside one section is something the filing system
    // already tells you. Only a thread that crosses sections adds anything.
    if (sectionIds.size < 2) continue;

    const rarity = Math.log(live.length / ids.length);
    const sizeFit = ids.length <= 10 ? ids.length : Math.max(2, 14 - ids.length);
    const spread = Math.min(sectionIds.size, 4);

    let score = rarity * 14 + sizeFit * 3 + spread * 4;
    if (key.includes(' ')) score *= 1.3;            // a phrase names a thread better than a word
    if (streamIds.length > 1) score *= 1.15;

    candidates.push({
      signature: `t:${key}`,
      label: anchors.get(key)!,
      taskIds: ids,
      score,
      sections: sectionIds.size,
      streams: streamIds,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  // Drop near-duplicates: "Sponsorship" and "Sponsorship Brochure" describe
  // the same strand, and offering both is noise.
  const chosen: Suggestion[] = [];
  for (const c of candidates) {
    if (dismissed.has(c.signature)) continue;
    const set = new Set(c.taskIds);
    const overlaps = chosen.some((k) => {
      const shared = k.taskIds.filter((id) => set.has(id)).length;
      return shared / Math.min(k.taskIds.length, c.taskIds.length) > 0.6;
    });
    if (!overlaps) chosen.push(c);
    if (chosen.length >= limit) break;
  }

  return chosen;
}

/** Why a given task is in a suggestion — shown so a proposal is checkable. */
export function anchorIn(label: string, task: Task): boolean {
  const term = norm(label);
  return norm(`${task.title} ${task.context ?? ''}`).includes(term);
}
