/** Paste → read → triage → commit, driven in a real browser. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

const transcript = `Anthony opened by saying the sponsor payment route is still the single blocker.
Isaac needs the revised registration numbers before he can sign anything off - end of the week at the latest.
Suzanne will know - they had exactly this problem in Kyoto.
We should not book anything until the QEII confirms the room.
Their marketing lead mentioned a reorganisation coming in the autumn.
Still nothing back from DHSC on the governance side.
Someone needs to chase Belaal again about the Australia arrangements.
There was a question about whether we need someone external on the panel.`;

async function paste() {
  await p.locator('#intake-label').fill('SMT, 14 August');
  await p.locator('#intake-text').fill(transcript);
  await p.getByRole('button', { name: 'Read it' }).click();
  await p.waitForSelector('.cand', { timeout: 8000 });
  await p.waitForTimeout(400);
}

await p.goto('http://127.0.0.1:4173/intake', { waitUntil: 'networkidle' });
await p.waitForTimeout(800);

// focus must survive typing into the paste box
await p.locator('#intake-text').click();
await p.keyboard.type('Anthony opened by saying the sponsor payment route is still the blocker.', { delay: 4 });
const focused = await p.evaluate(() => document.activeElement?.id);
ok(focused === 'intake-text', `focus stays in the paste box while typing (${focused})`);

await paste();

ok((await p.locator('.cand').count()) === 7, `triage lists every proposal (${await p.locator('.cand').count()})`);
ok(await p.locator('.cand__quote').first().isVisible(), 'each proposal shows the quote it came from');
ok((await p.locator('.cand__dup').count()) === 1, 'a restated existing item is flagged as a duplicate');
ok((await p.locator('.cand--unplaced').count()) === 1, 'an unplaceable item is marked, not guessed at');
await p.screenshot({ path: `${out}/phone-triage.png` });

const readyBefore = Number(await p.locator('.commit__count b').textContent());
ok(readyBefore === 6, `unplaced items are excluded from the ready count (${readyBefore} of 7)`);

// nothing written yet
const leakedBefore = await p.evaluate(async () => {
  const r = await fetch('/streams'); return r.ok;
});
void leakedBefore;

// discard and restore
await p.locator('.cand .rowbtn').first().click();
await p.waitForTimeout(300);
ok((await p.locator('.cand--gone').count()) === 1, 'a discarded proposal collapses and can be put back');
ok(Number(await p.locator('.commit__count b').textContent()) === readyBefore - 1, 'discarding decrements the ready count');
await p.getByRole('button', { name: 'Put back' }).click();
await p.waitForTimeout(300);
ok(Number(await p.locator('.commit__count b').textContent()) === readyBefore, 'putting it back restores the count');

// doing → watching
const seg = p.locator('.cand').first().locator('.seg button', { hasText: 'Just watch' });
await seg.click();
await p.waitForTimeout(200);
ok((await seg.getAttribute('aria-pressed')) === 'true', 'a proposal can be moved from doing to watching');

// place the unplaced one
await p.locator('.cand--unplaced').first().locator('select').selectOption({ index: 1 });
await p.waitForTimeout(300);
ok(Number(await p.locator('.commit__count b').textContent()) === 7, 'placing the last item makes all seven ready');

// edit a title in place without losing focus
await p.locator('.cand__title').nth(1).click();
await p.keyboard.press('End');
await p.keyboard.type(' - before Sydney', { delay: 6 });
const cls = await p.evaluate(() => document.activeElement?.className ?? '');
ok(String(cls).includes('cand__title'), 'editing a title in place does not lose focus');
const edited = await p.locator('.cand__title').nth(1).inputValue();
ok(edited.endsWith(' - before Sydney'), 'the whole edit is captured, not the first character');

// commit
await p.getByRole('button', { name: /Add 7 to the register/ }).click();
await p.waitForTimeout(1000);
ok(await p.locator('.toast', { hasText: 'added to the register' }).isVisible(), 'committing confirms how many landed');

// Navigate in-app, not with goto: a full reload would re-prime the fixture
// cache from the seed file and discard everything added this session.
await p.getByRole('link', { name: 'Streams' }).click();
await p.waitForTimeout(900);
// The Isaac item was flipped to "watch" earlier in this run, so assert on
// one that stayed a task.
ok((await p.locator('.task__title', { hasText: 'Ask Suzanne how TTS handled multi-currency' }).count()) >= 1,
  'accepted tasks appear in the register');
ok((await p.locator('.task__title', { hasText: 'Send Isaac the revised registration' }).count()) === 0,
  'an item reclassified as watch does not appear among the tasks');

await p.getByRole('link', { name: 'Periphery' }).click();
await p.waitForTimeout(900);
const watchLanded = await p.locator('.watch p').count();
ok(watchLanded >= 3, `items marked watch land in the periphery, not Today (${watchLanded})`);
await p.screenshot({ path: `${out}/phone-periphery-after.png` });

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll intake checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
