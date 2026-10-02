import { guessKind, KIND_GUIDANCE } from '../src/lib/recordKind.ts';
import { buildPrompt } from '../src/lib/proposalFormat.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const notes = `SMT 14 Aug
- Sponsor payment route → me, before Sydney
- Derek: priority list by Fri
- AB to confirm QEII date
- Budget line: wait for Isaac`;
// "Derek: priority list" looks like a speaker line; one such line in notes is not a transcript.
ok(guessKind(notes) === 'notes', 'bulleted notes read as notes, even with one "Name:" line');

const transcript = `Anthony: Right, sponsorship. Where are we?
Kealan: Pipeline's moving. OrganOx have the letter.
Anthony: Can you get the payment route sorted before Sydney?
Kealan: Yes, I'll have it by Friday.
Emma: I can chase Derek for the list.`;
ok(guessKind(transcript) === 'transcript', 'speaker-labelled lines read as a transcript');

const stamped = `[00:01:12] Okay so let's start with the budget.
[00:01:40] Isaac said the cost model needs another pass.
[00:02:05] I'll send it to him this afternoon.
[00:02:31] Great, next item.`;
ok(guessKind(stamped) === 'transcript', 'timestamped lines read as a transcript');

const zoom = `00:01:12 Speaker 1: Morning all.
00:01:20 Speaker 2: Morning.
00:01:31 Speaker 1: First, the board papers.`;
ok(guessKind(zoom) === 'transcript', 'a Teams or Zoom export with timestamps and speakers reads as a transcript');

const actions = `Actions
Derek: send the priority sponsor list
Emma: chase OrganOx for the letter
AB: confirm the QEII date
Isaac: revised cost model`;
ok(guessKind(actions) === 'notes', 'an action list written "Name: thing", one name a line, is still notes');

ok(guessKind('') === 'notes', 'nothing pasted is notes, the default');

const prompt = (kind) => buildPrompt([], [], [], kind);
ok(prompt('transcript').includes(KIND_GUIDANCE.transcript), 'the Via Claude prompt carries the transcript guidance when set to transcript');
ok(prompt('notes').includes(KIND_GUIDANCE.notes) && !prompt('notes').includes(KIND_GUIDANCE.transcript),
  'and the notes guidance, only, when set to notes');

// The server keeps its own copy of the guidance; the two must not drift.
const api = await import('../api/extract.ts');
ok(JSON.stringify(api.KIND_GUIDANCE) === JSON.stringify(KIND_GUIDANCE), 'the server reads each kind exactly as the app describes it');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
