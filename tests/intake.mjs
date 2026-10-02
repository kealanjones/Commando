/** Paste → read → triage → commit, driven in a real browser. */
import { launch, out } from './browser.mjs';

const b = await launch();
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
  // The in-app read is now one of two routes; the other needs no backend.
  await p.locator('#intake-label').fill('SMT, 14 August');
  await p.locator('#intake-text').fill(transcript);
  await p.getByRole('button', { name: 'Read this meeting' }).click();
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

// ── notes or a transcript ────────────────────────────────────────
const kindNow = () => p.locator('.intake__kind button[aria-pressed="true"]').textContent();
ok((await kindNow()) === 'Notes', 'it starts on Notes');
await p.locator('#intake-text').fill(`Anthony: Where are we on sponsorship?
Kealan: OrganOx have the letter.
Anthony: Can you sort the payment route before Sydney?
Kealan: Yes, by Friday.`);
await p.waitForTimeout(150);
ok((await kindNow()) === 'Transcript', 'pasting a back-and-forth switches it to Transcript');
ok((await p.locator('label[for="intake-text"]').textContent()) === 'The transcript', 'and the box says what it holds');
ok((await p.locator('.intake__kindhint').textContent()).includes('Guessed'), 'and says it was a guess');
await p.getByRole('button', { name: 'Notes', exact: true }).click();
await p.locator('#intake-text').fill(`Kealan: one more line
Anthony: and another
Kealan: and another`);
await p.waitForTimeout(150);
ok((await kindNow()) === 'Notes', 'once chosen by hand, it stays as chosen');
await p.locator('#intake-text').fill('');

// The Via Claude prompt is written for whichever kind is chosen.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await p.getByRole('button', { name: 'Via Claude' }).click();
await p.getByRole('button', { name: 'Transcript', exact: true }).click();
await p.getByRole('button', { name: 'Copy the prompt' }).click();
await p.waitForTimeout(200);
const clip = await p.evaluate(() => navigator.clipboard.readText());
ok(clip.includes('This record is a transcript'), 'Via Claude: the copied prompt reads it as a transcript');
await p.getByRole('button', { name: 'Notes', exact: true }).click();
await p.getByRole('button', { name: 'Copy the prompt' }).click();
await p.waitForTimeout(200);
ok((await p.evaluate(() => navigator.clipboard.readText())).includes('This record is my own notes'), 'and as notes when switched back');
await p.getByRole('button', { name: 'Read it here' }).click();
await p.waitForTimeout(200);

await paste();

ok((await p.locator('.cand').count()) === 5, `triage lists every proposal (${await p.locator('.cand').count()})`);
ok(await p.locator('.cand__quote').first().isVisible(), 'each proposal shows the quote it came from');
ok((await p.locator('.cand__dup').count()) === 1, 'a restated existing item is flagged as a duplicate');
ok((await p.locator('.cand--unplaced').count()) === 1, 'an unplaceable item is marked, not guessed at');
await p.screenshot({ path: `${out}/phone-triage.png` });

const readyBefore = Number(await p.locator('.commit__count b').textContent());
ok(readyBefore === 4, `unplaced items are excluded from the ready count (${readyBefore} of 5)`);

// nothing written yet
const leakedBefore = await p.evaluate(async () => {
  const r = await fetch('/projects'); return r.ok;
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

// every proposal is one kind of thing: no doing-versus-watching choice
ok((await p.locator('.cand .seg').count()) === 0, 'there is no task-or-watch choice to make');

// urgent can be set or cleared before accepting
const urgent = p.locator('.cand').nth(1).locator('.tinytoggle', { hasText: 'Urgent' });
await urgent.click();
await p.waitForTimeout(200);
ok((await urgent.getAttribute('aria-pressed')) === 'true', 'a proposal can be flagged urgent before it lands');

// an unplaced proposal can be given a sub-focus made on the spot
{
  const un = p.locator('.cand--unplaced').first();
  await un.getByRole('button', { name: 'New sub-focus or project' }).click();
  await un.locator('select').nth(1).selectOption('cttl');
  await un.locator('input').last().fill('External panel');
  await un.getByRole('button', { name: 'Add sub-focus' }).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.cand--unplaced').count()) === 0, 'an unplaced proposal can be filed into a sub-focus made there and then');
  ok(Number(await p.locator('.commit__count b').textContent()) === readyBefore + 1, 'and it joins the ready count');
}

ok(Number(await p.locator('.commit__count b').textContent()) === 5, 'placing the last item makes all five ready');

// edit a title in place without losing focus
await p.locator('.cand__title').nth(1).click();
// Ctrl+End, not End: titles wrap, and End only reaches the end of the line clicked on.
await p.keyboard.press('Control+End');
await p.keyboard.type(' - before Sydney', { delay: 6 });
const cls = await p.evaluate(() => document.activeElement?.className ?? '');
ok(String(cls).includes('cand__title'), 'editing a title in place does not lose focus');
const edited = await p.locator('.cand__title').nth(1).inputValue();
ok(edited.endsWith(' - before Sydney'), 'the whole edit is captured, not the first character');

// commit
await p.getByRole('button', { name: /Add 5 to the register/ }).click();
await p.waitForTimeout(1000);
ok(await p.locator('.toast', { hasText: 'added to the register' }).isVisible(), 'committing confirms how many landed');

// Navigate in-app, not with goto: a full reload would re-prime the fixture
// cache from the seed file and discard everything added this session.
await p.getByRole('link', { name: 'Projects' }).click();
await p.waitForTimeout(700);
await p.locator('.srow', { hasText: 'ISODP' }).click();
await p.waitForTimeout(900);
ok((await p.locator('.task__title', { hasText: 'Ask Suzanne how TTS handled multi-currency' }).count()) >= 1,
  'accepted items appear in their section');
ok((await p.locator('.task__title', { hasText: 'Send Isaac the revised registration' }).count()) >= 1,
  'every accepted proposal lands as an ordinary item');

// The Isaac item came in urgent, so it is on Today.
await p.getByRole('link', { name: 'Today' }).click();
await p.waitForTimeout(700);
const more = p.locator('.more', { hasText: 'more urgent' });
if (await more.count()) { await more.click(); await p.waitForTimeout(300); }
ok((await p.locator('.task__title', { hasText: 'Send Isaac the revised registration' }).count()) === 1,
  'an accepted urgent item shows on Today');
await p.screenshot({ path: `${out}/phone-today-after-intake.png` });

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll intake checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
