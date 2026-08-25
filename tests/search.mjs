import { search, highlight, terms } from '/home/user/Commando/src/lib/search.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const T = (id, title, extra = {}) => ({
  id, title, kind: 'task', done: false, deleted_at: null, do_now: false, due: null,
  context: null, note: null, section_id: 'sec-a', stream_id: 'isodp',
  owner_id: '', natural_key: null, done_at: null, position: 0, user_edited: false,
  touched_at: null, reviewed_at: null, unclear: false,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...extra,
});

const S = (id, title) => ({ id, title, stream_id: 'isodp', owner_id: '', monitor: false, position: 0, deleted_at: null });

const tasks = [
  T('1', 'Chase Belaal for an update on Satya’s Australia trip', { section_id: 'aus' }),
  T('2', 'Push South Australia tickets through', { section_id: 'aus' }),
  T('3', 'Follow up the OrganOx UK marketing manager', { section_id: 'spons' }),
  T('4', 'Track Organ Recovery Systems follow-up', { section_id: 'spons' }),
  T('5', 'Reorganisation of the marketing team', { kind: 'watch', section_id: 'spons' }),
  T('6', 'Send Emma an introductory email explaining ISODP', { done: true, section_id: 'spons' }),
  T('7', 'Book the flights', { section_id: 'aus', context: 'Emirates, Birmingham to Sydney, 14 September' }),
  T('8', 'Speak to Steph about travel', { section_id: 'travel', note: 'She is chasing Emirates for the fare basis' }),
  T('9', 'Clarify VAT treatment', { do_now: true, section_id: 'pay' }),
];
const sections = [S('aus', 'Australia and Sydney'), S('spons', 'Sponsorship'), S('travel', 'Travel'), S('pay', 'Finance')];
const streams = [{ id: 'isodp', title: 'ISODP 2027', short: 'ISODP', code: 'ISODP', owner_id: '', position: 0 }];
const people = [{ id: 'p1', name: 'Belaal', role: null }, { id: 'p2', name: 'Steph', role: null }];
const links = [{ task_id: '1', person_id: 'p1' }, { task_id: '8', person_id: 'p2' }];

const run = (q) => search(q, tasks, sections, streams, people, links);
const ids = (q) => run(q).map((h) => h.task.id);

ok(ids('belaal')[0] === '1', 'a name in the title ranks first');
// A section-title match pulls in that whole section, which is what you want
// when you search "Australia" — but it must rank below real title matches.
const aus = ids('australia');
ok(aus.slice(0, 2).sort().join(',') === '1,2', `title matches lead (${aus.join(',')})`);
ok(aus.includes('7'), 'a section-title match brings the rest of that section too');
ok(!aus.includes('9'), 'but not tasks from other sections');
ok(ids('organ')[0] === '3' || ids('organ')[0] === '4', `a word-boundary match beats one buried mid-word (${ids('organ').join(',')})`);
ok(ids('organ').indexOf('5') > 1, '"reorganisation" ranks below real Organ matches');
ok(ids('emirates').includes('7') && ids('emirates').includes('8'), 'searches context and notes, not just titles');
ok(ids('steph travel')[0] === '8', 'every term must match, and both may be in different fields');
ok(ids('steph australia').length === 0, 'terms that cannot all match return nothing');
ok(ids('steph travel')[0] === '8', 'a person and their section both match the same task');
ok(run('emma')[0].task.done === true && run('emma').length === 1, 'done items are found but demoted');
ok(ids('vat')[0] === '9', 'a do-now item wins a tie');
ok(run('belaal')[0].via === 'title', 'the strongest field is reported');
ok(run('emirates')[0].via === 'context' || run('emirates')[0].via === 'note', 'a context match is labelled as such');
ok(run('nothingatallhere').length === 0, 'no matches returns empty, not everything');
ok(run('').length === 0 && run('   ').length === 0, 'an empty query returns nothing');

// case and punctuation
ok(ids('SATYA')[0] === '1', 'case-insensitive');
ok(ids("satya's")[0] === '1', 'curly and straight apostrophes both match');

// highlighting
const h = highlight('Chase Belaal for an update', 'belaal');
ok(h.filter((p) => p.hit).map((p) => p.text).join('') === 'Belaal', 'highlight marks the matched run, preserving original case');
ok(h.map((p) => p.text).join('') === 'Chase Belaal for an update', 'highlight loses no characters');
const h2 = highlight('Speak to Steph about travel', 'steph travel');
ok(h2.filter((p) => p.hit).length === 2, 'every term is highlighted');
ok(highlight('anything', '').length === 1, 'an empty query highlights nothing');
ok(terms('  two   words ').length === 2, 'terms collapse whitespace');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
