import { blocksDirectWrites, drain } from '../src/lib/queueCore.ts';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

const fakeStore = (ops) => {
  let saved = JSON.stringify(ops);
  return {
    read: () => JSON.parse(saved),
    write: (o) => { saved = JSON.stringify(o); },
    emit: () => {},
  };
};
const op = (id) => ({ id, tries: 0 });
const never = () => false;

// The race: while the first write is in flight, two more are queued.
{
  const store = fakeStore([op('a')]);
  const sent = [];
  await drain(store, async (o) => {
    sent.push(o.id);
    if (o.id === 'a') store.write([...store.read(), op('b'), op('c')]);
    await new Promise((r) => setTimeout(r, 5));
    return null;
  }, () => {}, never);
  ok(sent.join() === 'a,b,c', `a write queued mid-flight is sent, not dropped (${sent.join()})`);
  ok(store.read().length === 0, 'and the queue ends empty');
}

// A transient failure stops the drain, keeps the op, and counts the try.
{
  const store = fakeStore([op('a'), op('b')]);
  await drain(store, async () => ({ code: '08000', message: 'offline' }), () => {}, never);
  const left = store.read();
  ok(left.map((o) => o.id).join() === 'a,b', 'a transient failure leaves everything queued, in order');
  ok(left[0].tries === 1, 'and counts the try');
}

// A transient failure while more arrive keeps the newcomers too.
{
  const store = fakeStore([op('a')]);
  await drain(store, async () => { store.write([...store.read(), op('late')]); return { message: 'flaky' }; }, () => {}, never);
  ok(store.read().map((o) => o.id).join() === 'a,late', 'what arrives during a failed write is kept');
}

// A permanent failure is reported and dropped; the rest still go.
{
  const store = fakeStore([op('bad'), op('good')]);
  const failed = [];
  const sent = [];
  await drain(store, async (o) => { sent.push(o.id); return o.id === 'bad' ? { code: '42703', message: 'no column' } : null; },
    (o, m) => failed.push(`${o.id}:${m}`), (code) => code?.startsWith('42'));
  ok(failed.join() === 'bad:no column', 'a permanent failure is reported');
  ok(sent.join() === 'bad,good' && store.read().length === 0, 'and the queue carries on past it');
}

ok(blocksDirectWrites([{ kind: 'update' }, { kind: 'add' }]), 'a queued new sub-focus holds back direct writes');
ok(!blocksDirectWrites([{ kind: 'update' }, { kind: 'insert' }, { kind: 'patch' }]), 'other queued edits do not');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
