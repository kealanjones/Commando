/** Bringing a meeting in via Claude: copy prompt → paste reply → triage. */
import { launch, out } from './browser.mjs';

const b = await launch();
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

await p.getByRole('button', { name: 'Via Claude' }).click();
await p.waitForTimeout(250);
ok(await p.getByRole('button', { name: 'Via Claude' }).getAttribute('aria-pressed') === 'true',
  'the no-setup route is still available as a second option');
await p.screenshot({ path: `${out}/phone-intake-claude.png` });

// the prompt must carry the real register
await p.getByRole('button', { name: 'Copy the prompt' }).click();
await p.waitForTimeout(400);
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok(clip.length > 500, `a prompt reaches the clipboard (${clip.length} chars)`);
ok(/isodp-g-finance/.test(clip), "it carries real sub-focus ids");
ok(/Send Anthony the short priority sponsor list/.test(clip), 'it carries existing items so nothing is duplicated');
ok(/When unsure whether something is an action, leave it out/.test(clip), 'it says to leave out what is not an action');
ok(!/WATCH/.test(clip), 'and no longer asks for a task-or-watch decision');

// paste back what Claude would return, with chat either side
const reply = `Here's what I found.

\`\`\`json
{
  "summary": "Mostly the sponsor payment route.",
  "items": [
    {"title":"Send Isaac the revised registration cost model","kind":"task","section_id":"isodp-g-finance",
     "context":"He cannot sign off without them.","do_now":true,"due":null,"waiting_on":["Isaac"],
     "evidence":"Isaac needs the revised numbers before he can sign anything off.","confidence":"high",
     "duplicate_of_title":null},
    {"title":"Getinge are reorganising their European marketing team","kind":"watch","section_id":"isodp-g-sponsorship",
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
await p.waitForTimeout(700);
await p.locator('.srow', { hasText: 'ISODP' }).click();
await p.waitForTimeout(900);
ok((await p.locator('.task__title', { hasText: 'Send Isaac the revised registration' }).count()) >= 1,
  'accepted tasks appear in the register');
ok((await p.locator('.task__title', { hasText: 'Getinge are reorganising' }).count()) >= 1,
  'a reply that still says "watch" lands as an ordinary item');

// Intake is reached from Add, not the nav.
await p.getByRole('button', { name: 'Add an item' }).click();
await p.getByRole('button', { name: 'Paste meeting notes instead' }).click();
await p.waitForTimeout(700);
ok(p.url().endsWith('/intake'), 'Add leads to meeting intake');

// a bad paste must explain itself, not just fail
await p.getByRole('button', { name: 'Via Claude' }).click();
await p.waitForTimeout(250);
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
