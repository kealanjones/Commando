import { suggestGroups } from '/home/user/Commando/src/lib/grouping.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const T = (id, title, section_id, stream_id = 'isodp', extra = {}) => ({
  id, title, section_id, stream_id, kind: 'task', done: false, deleted_at: null,
  context: null, note: null, owner_id: '', natural_key: null, done_at: null,
  do_now: false, due: null, position: 0, user_edited: false, touched_at: null,
  reviewed_at: null, unclear: false, created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});
const sections = [{ title: 'Sponsorship' }, { title: 'Hotels and accommodation' }, { title: 'Governance' }];
const labels = (tasks, opts) => suggestGroups(tasks, sections, opts).map((g) => g.label);

// A generic word must never anchor a thread, however widely it spreads.
const generic = [
  T('1', 'Push the tickets through', 'a'), T('2', 'Book it through the portal', 'b'),
  T('3', 'Get it through by Friday', 'c'), T('4', 'See it through to the end', 'a'),
];
ok(!labels(generic).includes('Through'), 'a function word never anchors a thread');

// A proper noun does, when it crosses sections.
const dale = [
  T('1', 'Forward the document to Dale', 'a'), T('2', 'Mail leaflets to Dale', 'b'),
  T('3', 'Brief Dale on the conversations', 'c'), T('4', 'Something unrelated', 'a'),
];
ok(labels(dale).includes('Dale'), 'a proper noun crossing sections is suggested');

// but not when it is all in one place — the filing system already says that.
const oneSection = [
  T('1', 'Forward the document to Dale', 'a'), T('2', 'Mail leaflets to Dale', 'a'),
  T('3', 'Brief Dale on the conversations', 'a'),
];
ok(labels(oneSection).length === 0, 'a strand inside one section adds nothing and is not offered');

// the user's own vocabulary counts too
const domain = [
  T('1', 'Update the sponsorship brochure', 'a'), T('2', 'Send the sponsorship pack to Derek', 'b'),
  T('3', 'Ask about sponsorship VAT', 'c'),
];
ok(labels(domain).includes('Sponsorship'), 'a word from the section titles can anchor');

// ambient terms are background, not a thread
ok(!labels(domain, { ambientTerms: ['sponsorship'] }).includes('Sponsorship'),
  'an ambient term is excluded even though it qualifies');

// dismissals stick
const sig = suggestGroups(dale, sections)[0].signature;
ok(!labels(dale, { dismissed: new Set([sig]) }).includes('Dale'), 'a dismissed signature does not come back');

// already-grouped items drop out
ok(labels(dale, { alreadyGrouped: new Set(['1', '2']) }).length === 0,
  'items already in a thread are not offered again');

// done and deleted are ignored
const closed = dale.map((t, i) => (i < 2 ? { ...t, done: true } : t));
ok(labels(closed).length === 0, 'finished items do not make a thread');

// acronyms survive; sentence-initial capitals do not
const acro = [
  T('1', 'Ask Finance about VAT treatment', 'a'), T('2', 'Clarify VAT on sponsorship', 'b'),
  T('3', 'Confirm the VAT position with Isaac', 'c'),
];
ok(labels(acro).includes('VAT'), 'an acronym anchors a thread');
const initial = [
  T('1', 'Review the slides', 'a'), T('2', 'Review the script', 'b'), T('3', 'Review the notes', 'c'),
];
ok(!labels(initial).includes('Review'), 'a sentence-initial capital is grammar, not a name');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
