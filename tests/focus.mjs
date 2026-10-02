import { pile, scopeFrom, scopeParams, dueLine, clock, minutes, sectionsUnder } from '../src/lib/focus.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const today = '2026-10-02';
const sections = [
  { id: 'spon', stream_id: 'isodp', parent_id: null, title: 'Sponsorship', position: 0 },
  { id: 'spon-pay', stream_id: 'isodp', parent_id: 'spon', title: 'Payments', position: 1 },
  { id: 'venue', stream_id: 'isodp', parent_id: null, title: 'Venue', position: 2 },
  { id: 'smt', stream_id: 'dir', parent_id: null, title: 'SMT', position: 0 },
];
let seq = 0;
const t = (id, extra) => ({
  id, stream_id: 'isodp', section_id: 'spon', position: seq++, title: id, kind: 'task',
  done: false, deleted_at: null, do_now: false, due: null, created_at: `2026-09-${String(10 + seq).padStart(2, '0')}T09:00:00Z`, ...extra,
});
const tasks = [
  t('late', { due: '2026-09-28' }),
  t('urgent', { do_now: true }),
  t('soon', { due: '2026-10-06', section_id: 'spon-pay' }),
  t('later', { due: '2026-11-20', section_id: 'venue' }),
  t('smt', { stream_id: 'dir', section_id: 'smt', do_now: true, due: '2026-10-03' }),
  t('finished', { done: true, do_now: true }),
  t('binned', { deleted_at: '2026-10-01T00:00:00Z' }),
];
const ids = (list) => list.map((x) => x.id).join(',');
const all = { which: 'all', stream: null, section: null, order: 'now' };

ok(ids(pile(tasks, sections, all, today)) === 'smt,urgent,late,soon,later',
  `everything open: do now first, then by date, never done or deleted (${ids(pile(tasks, sections, all, today))})`);
ok(ids(pile(tasks, sections, { ...all, order: 'due' }, today)) === 'late,smt,soon,later,urgent', 'by due date: undated last');
ok(ids(pile(tasks, sections, { ...all, order: 'oldest' }, today)) === 'late,urgent,soon,later,smt', 'oldest first');
ok(ids(pile(tasks, sections, { ...all, which: 'now' }, today)) === 'smt,urgent', 'do now only');
ok(ids(pile(tasks, sections, { ...all, which: 'overdue' }, today)) === 'late', 'overdue only');
ok(ids(pile(tasks, sections, { ...all, which: 'week' }, today)) === 'smt,late,soon', 'due this week, overdue included');
ok(ids(pile(tasks, sections, { ...all, which: 'undated' }, today)) === 'urgent', 'no date');
ok(ids(pile(tasks, sections, { ...all, stream: 'isodp' }, today)) === 'urgent,late,soon,later', 'one project');
ok(ids(pile(tasks, sections, { ...all, stream: 'isodp', section: 'spon' }, today)) === 'urgent,late,soon',
  'a group takes in the sub-focuses under it');
ok(ids(pile(tasks, sections, { ...all, stream: 'isodp', section: 'spon-pay' }, today)) === 'soon', 'one sub-focus');
ok(ids(pile(tasks, sections, { ...all, stream: 'isodp', section: 'venue', which: 'overdue' }, today)) === '', 'narrow enough and the pile is empty');
ok([...sectionsUnder('spon', sections)].join() === 'spon,spon-pay', 'a group stands for itself and its children');

const round = scopeFrom(new URLSearchParams(scopeParams({ which: 'week', stream: 'isodp', section: 'spon', order: 'due' }).slice(1)));
ok(round.which === 'week' && round.stream === 'isodp' && round.section === 'spon' && round.order === 'due', 'a scope survives the address bar');
ok(scopeParams(all) === '', 'the default scope leaves the address clean');
const junk = scopeFrom(new URLSearchParams('which=nonsense&order=sideways'));
ok(junk.which === 'all' && junk.order === 'now', 'nonsense in the address falls back to the defaults');

ok(dueLine('2026-09-30', today).text === '2 days overdue' && dueLine('2026-09-30', today).late, 'overdue reads as late');
ok(dueLine('2026-10-01', today).text === '1 day overdue', 'one day, singular');
ok(dueLine(today, today).text === 'Today' && !dueLine(today, today).late, 'due today is not late');
ok(dueLine('2026-10-03', today).text === 'Tomorrow', 'tomorrow');
ok(dueLine(null, today).text === 'No date', 'undated');

ok(clock(0) === '0:00' && clock(65_000) === '1:05' && clock(3_725_000) === '1:02:05', 'the clock');
ok(minutes(20_000) === 'under a minute' && minutes(60_000) === '1 minute' && minutes(25 * 60_000) === '25 minutes', 'minutes, said plainly');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
