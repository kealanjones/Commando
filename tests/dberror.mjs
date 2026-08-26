import { describeWriteError } from '/home/user/Commando/src/lib/dbError.ts';
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const m = (e) => describeWriteError(e, 'keep that thread');

// the one that matters: deployed ahead of the migration
const missing = m({ code: '42P01', message: 'relation "public.threads" does not exist' });
ok(/not set up yet/.test(missing) && /threads/.test(missing) && /DEPLOY\.md/.test(missing),
  `a missing table names it and says what to do — "${missing.slice(0, 72)}…"`);
ok(/DEPLOY\.md/.test(m({ message: 'relation "task_threads" does not exist' })),
  'recognised from the message alone, with no code');

const col = m({ code: '42703', message: 'column "unclear" does not exist' });
ok(/missing a column/.test(col) && /migration/.test(col), 'a missing column points at the migration too');

ok(/already exists/.test(m({ code: '23505' })), 'a duplicate says so plainly');
ok(/no longer there/.test(m({ code: '23503' })), 'a broken reference says so plainly');
ok(/not allowed/.test(m({ code: '42501' })), 'a permission failure suggests signing in again');
ok(/no connection/.test(m({ message: 'Failed to fetch' })), 'a network failure is named as one');

// never a dead end
ok(m({ message: 'something odd' }).includes('something odd'), 'an unknown error still carries its text');
ok(m(null).length > 0 && /keep that thread/.test(m(null)), 'even a null error produces a sentence');
ok(!m({ code: '42P01', message: 'relation "public.threads" does not exist' }).includes('relation "'),
  'the raw Postgres wording is not shown to the user');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
