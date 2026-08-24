/** Bringing a meeting in via Claude: copy prompt → paste reply → triage. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({
  viewport: { width: 375, height: 812 }, deviceScaleFactor: 2,
  permissions: ['clipboard-read', 'clipboard-write'],
});
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto('http://127.0.0.1:4173/intake', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

ok(await p.getByRole('button', { name: 'Via Claude' }).getAttribute('aria-pressed') === 'true',
  'the route needing no setup is the default');
await p.screenshot({ path: `${out}/phone-intake-claude.png` });

// the prompt must carry the real register
await p.getByRole('button', { name: 'Copy the prompt' }).click();
await p.waitForTimeout(400);
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok(clip.length > 500, `a prompt reaches the clipboard (${clip.length} chars)`);
ok(/isodp-pay/.test(clip), 'it carries real section ids');
ok(/Send Anthony the short priority sponsor list/.test(clip), 'it carries existing items so nothing is duplicated');
ok(/WATCH item/.test(clip), 'it carries the doing-versus-watching rule');

// paste back what Claude would return, with chat either side
const reply = `Here's what I found.

\`\`\`json
{
  "summary": "Mostly the sponsor payment route.",
  "items": [
    {"title":"Send Isaac the revised registration cost model","kind":"task","section_id":"isodp-pay",
     "context":"He cannot sign off without them.","do_now":true,"due":null,"waiting_on":["Isaac"],
     "evidence":"Isaac needs the revised numbers before he can sign anything off.","confidence":"high",
     "duplicate_of_title":null},
    {"title":"Getinge are reorganising their European marketing team","kind":"watch","section_id":"isodp-leads",
     "context":null,"do_now":false,"due":null,"waiting_on":[],
     "evidence":"Their marketing lead mentioned a reorganisation.","confidence":"medium","duplicate_of_title":null},
    {"title":"Decide whether the Fellowship panel needs an external member","kind":"task","section_id":"not-a-real-section",
     "context":null,"do_now":false,"due":null,"waiting_on":[],
     "evidence":"There was a question about the panel.","confidence":"low","duplicate_of_title":null}
  ]
}
\`\`\`

Let me know if you'd like any changed.`;

await p.locator('#intake-label').fill('SMT, 14 August');
await p.locator('#intake-paste').click();
await p.keyboard.type('Here');
ok(await p.evaluate(() => document.activeElement?.id) === 'intake-paste', 'focus stays in the paste box');
await p.locator('#intake-paste').fill(reply);

await p.getByRole('button', { name: 'Bring them in' }).click();
await p.waitForSelector('.cand', { timeout: 8000 });
await p.waitForTimeout(500);

ok((await p.locator('.cand').count()) === 3, `all proposals reach triage (${await p.locator('.cand').count()})`);
ok(await p.locator('.cand__quote').first().isVisible(), 'each carries the quote it came from');
ok((await p.locator('.cand--unplaced').count()) === 1, 'an invented section id is treated as unplaced, not written');
ok(Number(await p.locator('.commit__count b').textContent()) === 2, 'the unplaced one is held back from the ready count');
await p.screenshot({ path: `${out}/phone-intake-triage.png` });

// commit and confirm it lands
await p.locator('.cand--unplaced select').selectOption({ index: 1 });
await p.waitForTimeout(300);
await p.getByRole('button', { name: /Add 3 to the register/ }).click();
await p.waitForTimeout(900);
ok(await p.locator('.toast', { hasText: 'added to the register' }).isVisible(), 'committing confirms');

await p.getByRole('link', { name: 'Streams' }).click();
await p.waitForTimeout(900);
ok((await p.locator('.task__title', { hasText: 'Send Isaac the revised registration' }).count()) >= 1,
  'accepted tasks appear in the register');

// a bad paste must explain itself, not just fail
await p.getByRole('link', { name: 'Intake' }).click();
await p.waitForTimeout(700);
await p.locator('#intake-paste').fill('Sure, I can help with that!');
await p.getByRole('button', { name: 'Bring them in' }).click();
await p.waitForTimeout(600);
const err = await p.locator('.toast--warn').textContent();
ok(/does not look like/.test(err ?? ''), `a bad paste says what to do (${(err ?? '').slice(0, 50).trim()}…)`);

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow at 375px (${over}px)`);

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll paste-route checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
