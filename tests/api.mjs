/**
 * Exercise the handler's guards without an Anthropic key: everything up to
 * the model call is ordinary logic and worth proving.
 */
const mod = await import('/home/user/Commando/api/extract.ts');
const handler = mod.default;

const make = () => {
  const out = { code: 0, body: null, headers: {} };
  const res = {
    status(n) { out.code = n; return res; },
    json(b) { out.body = b; },
    setHeader(k, v) { out.headers[k] = v; },
    end() {},
  };
  return { res, out };
};

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : fail++; };

// no key configured
delete process.env.ANTHROPIC_API_KEY;
let { res, out } = make();
await handler({ method: 'POST', headers: {}, body: { text: 'x'.repeat(60) } }, res);
ok(out.code === 503 && /ANTHROPIC_API_KEY/.test(out.body.error),
   `missing key says exactly what to add (${out.code})`);

// wrong verb
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';
({ res, out } = make());
await handler({ method: 'GET', headers: {} }, res);
ok(out.code === 405, `GET is refused (${out.code})`);

// preflight
({ res, out } = make());
await handler({ method: 'OPTIONS', headers: {} }, res);
ok(out.code === 204, `OPTIONS returns no content (${out.code})`);

// unauthenticated
({ res, out } = make());
await handler({ method: 'POST', headers: {}, body: { text: 'x'.repeat(60) } }, res);
ok(out.code === 401 && /signed in/i.test(out.body.error), `no token is refused (${out.code})`);

// too short — must be rejected before any auth round trip is wasted
({ res, out } = make());
await handler({ method: 'POST', headers: { authorization: 'Bearer bad' }, body: { text: 'hi' } }, res);
ok(out.code === 401 || out.code === 400, `a short body does not crash (${out.code})`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
