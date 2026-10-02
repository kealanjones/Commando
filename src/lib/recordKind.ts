/**
 * What kind of meeting record was pasted. Notes and transcripts need
 * reading differently: in notes every terse line may be an action; in a
 * transcript most of what is said is not, and what matters is who agreed
 * to do what.
 *
 * The guidance below is sent with the record on both routes. api/extract.ts
 * keeps its own copy (it is bundled on its own); tests/recordKind.mjs fails
 * if the two ever differ.
 */
export type RecordKind = 'notes' | 'transcript';

export const KIND_LABEL: Record<RecordKind, string> = { notes: 'Notes', transcript: 'Transcript' };

export const KIND_GUIDANCE: Record<RecordKind, string> = {
  notes:
    'This record is my own notes: terse, abbreviated, often bullet points. A single short line can be a whole action. Initials and first names stand for people; expand them only when the record makes it certain. "Me", "I" and "KJ" mean me. Arrows (→, ->) and "@name" usually show who owes what. A short line is fine as the evidence quote.',
  transcript:
    'This record is a transcript: several speakers, filler, false starts and things said then taken back. Most of it is not an action. Look for commitments ("I\'ll…", "can you…", "let\'s…") and the actions agreed near the end. Work out who owns each action from who spoke and who agreed; a suggestion nobody took up is not an action. Speaker labels may be names, initials or "Speaker 1". Quote the words of the person committing.',
};

/**
 * A best guess from the text itself. Timestamps on several lines mean a
 * transcript. So do speaker labels, but only when the conversation goes
 * back and forth (someone speaks more than once): notes are often written
 * "Derek: send the list", one name a line, and that is still notes.
 */
export function guessKind(text: string): RecordKind {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const stamp = /^\s*\[?\(?\d{1,2}:\d{2}(:\d{2})?\)?\]?\s/;
  const speaker = /^\s*(?:\[?\(?\d{1,2}:\d{2}(?::\d{2})?\)?\]?\s*[-–]?\s*)?([A-Z][\w .'’-]{0,30}):\s+\S/;

  const stamped = lines.filter((l) => stamp.test(l)).length;
  if (stamped >= 3 && stamped >= lines.length * 0.3) return 'transcript';

  const said = new Map<string, number>();
  for (const l of lines) {
    const who = speaker.exec(l)?.[1]?.trim();
    if (who) said.set(who, (said.get(who) ?? 0) + 1);
  }
  const turns = [...said.values()].reduce((n, c) => n + c, 0);
  const backAndForth = said.size >= 2 && [...said.values()].some((c) => c >= 2);
  return turns >= 3 && backAndForth && turns >= lines.length * 0.3 ? 'transcript' : 'notes';
}
