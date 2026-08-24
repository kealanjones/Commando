import { parseProposals } from '/home/user/Commando/src/lib/proposalFormat.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const good = `{"summary":"Sponsor payments.","items":[
 {"title":"Send Isaac the numbers","kind":"task","section_id":"isodp-pay","context":null,
  "do_now":true,"due":null,"waiting_on":["Isaac"],"evidence":"Isaac needs them.",
  "confidence":"high","duplicate_of_title":null}]}`;

// the shapes people actually paste
ok(parseProposals(good).items.length === 1, 'bare JSON object');
ok(parseProposals('```json\n' + good + '\n```').items.length === 1, 'fenced with json tag');
ok(parseProposals('```\n' + good + '\n```').items.length === 1, 'fenced without tag');
ok(parseProposals("Here you go!\n\n```json\n" + good + "\n```\n\nLet me know if you want changes.").items.length === 1,
   'fenced with chat either side');
ok(parseProposals(good.replace(/\n/g, ' ')).items.length === 1, 'all on one line');

// a bare array
const arr = `[{"title":"Chase Derek","kind":"task","section_id":"isodp-leads","evidence":"Derek owes the list."}]`;
ok(parseProposals(arr).items.length === 1, 'bare array with no wrapper');

// braces inside strings must not confuse the scanner
const braces = `{"summary":"He said {this} and [that].","items":[{"title":"Fix the {thing}","kind":"watch","evidence":"a {quote}"}]}`;
ok(parseProposals(braces).items[0].title === 'Fix the {thing}', 'braces inside strings');

// defaults and coercion
const sparse = `{"items":[{"title":"Only a title"}]}`;
const p = parseProposals(sparse).items[0];
ok(p.kind === 'task' && p.confidence === 'medium' && p.do_now === false && p.waiting_on.length === 0,
   'missing fields fall back to sensible defaults');
ok(parseProposals(`{"items":[{"title":"x","due":"next Friday"}]}`).items[0].due === null,
   'a non-ISO date is dropped rather than stored');
ok(parseProposals(`{"items":[{"title":"x","kind":"nonsense"}]}`).items[0].kind === 'task',
   'an unknown kind falls back to task');

// failures must explain themselves
const throws = (input, label) => {
  try { parseProposals(input); ok(false, label + ' (did not throw)'); }
  catch (e) { ok(/copy|json|items|title|nothing/i.test(e.message), `${label} — "${e.message.slice(0, 58)}…"`); }
};
throws('', 'empty paste');
throws('Sure! I can help with that.', 'prose with no JSON');
throws('{"items":[]}', 'valid JSON but no items');
throws('{"items":[{"context":"no title here"}]}', 'items with no titles');
throws('{"items":[{"title":"x"', 'truncated JSON');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
