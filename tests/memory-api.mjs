/**
 * The memory endpoint's guards, without an Anthropic key: everything up to
 * the model call is ordinary logic and worth proving.
 */
const { default: handler } = await import('../api/memory.ts');

const make = () => {
  const out = { code: 0, body: null };
  const res = {
    status(n) { out.code = n; return res; },
    json(b) { out.body = b; },
    setHeader() {},
    end() {},
  };
  return { res, out };
};
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };
const run = async (req) => { const { res, out } = make(); await handler({ headers: {}, ...req }, res); return out; };

delete process.env.ANTHROPIC_API_KEY;
let out = await run({ method: 'POST', body: { action: 'ask', question: 'What did we agree?' } });
ok(out.code === 503 && /ANTHROPIC_API_KEY/.test(out.body.error), `no key says exactly what to add (${out.code})`);

process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';

out = await run({ method: 'GET' });
ok(out.code === 405, `GET is refused (${out.code})`);
out = await run({ method: 'OPTIONS' });
ok(out.code === 204, `OPTIONS answers the preflight (${out.code})`);
out = await run({ method: 'POST', body: { action: 'rewrite-everything' } });
ok(out.code === 400, `an unknown action is refused before anything else (${out.code})`);
out = await run({ method: 'POST', body: { action: 'absorb', intake_id: 'x' } });
ok(out.code === 401, `no session, no memory (${out.code})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
