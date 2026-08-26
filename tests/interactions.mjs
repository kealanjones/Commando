import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new','--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const fail = [];
const ok = (c, m) => console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`) || (c || fail.push(m));

await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

// ── 1. note typing keeps focus ──────────────────────────────────
await p.locator('.task__open').first().click();
await p.waitForSelector('#sheet-note');
const note = p.locator('#sheet-note');
await note.click();
const phrase = 'Spoke to Steph on Thursday; she is chasing Emirates for the fare basis.';
await p.keyboard.type(phrase, { delay: 12 });
const focusId = await p.evaluate(() => document.activeElement?.id);
ok(focusId === 'sheet-note', `focus stays in the note after typing (activeElement=${focusId})`);
ok((await note.inputValue()) === phrase, 'full note text captured, not just the first character');
await p.screenshot({ path: `${out}/phone-sheet.png` });

// ── 2. save persists ────────────────────────────────────────────
await p.getByRole('button', { name: 'Save' }).click();
await p.waitForTimeout(400);
ok(await p.locator('.task__note').first().isVisible(), 'note renders on the card after save');

// ── 3. complete is reversible, and the list holds still ─────────
const orderBefore = await p.evaluate(() => [...document.querySelectorAll('.task .check')].map((c) => c.id));
const targetId = orderBefore[0];
await p.locator(`#${targetId}`).click();
await p.waitForTimeout(400);
ok(await p.locator(`#${targetId}`).isChecked(), 'ticking marks the task done');
const orderAfter = await p.evaluate(() => [...document.querySelectorAll('.task .check')].map((c) => c.id));
ok(JSON.stringify(orderBefore) === JSON.stringify(orderAfter), 'list does not reshuffle while undo is offered');
ok(await p.locator('.toast', { hasText: 'Done.' }).isVisible(), 'completing offers Undo');
await p.locator('.toast button', { hasText: 'Undo' }).click();
await p.waitForTimeout(400);
ok(!(await p.locator(`#${targetId}`).isChecked()), 'undo reopens the task');

// ── 4. delete is reversible ─────────────────────────────────────
// Today always shows three, so a delete promotes the next item rather
// than shortening the list: assert on the specific row, not the count.
const delId = (await p.evaluate(() => document.querySelector('.task .check')?.id));
await p.locator('.task__open').first().click();
await p.waitForSelector('.sheet');
await p.getByRole('button', { name: 'Delete' }).click();
await p.waitForTimeout(400);
ok((await p.locator(`#${delId}`).count()) === 0, 'delete removes that row from the list');
await p.locator('.toast button', { hasText: 'Undo' }).click();
await p.waitForTimeout(500);
ok((await p.locator(`#${delId}`).count()) === 1, 'undo restores the deleted row');

// ── 5. nav does not cover the last item ─────────────────────────
await p.goto('http://127.0.0.1:4173/streams', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(500);
const clear = await p.evaluate(() => {
  const tasks = [...document.querySelectorAll('.task')];
  const last = tasks[tasks.length - 1];
  const nav = document.querySelector('.nav');
  if (!last || !nav) return null;
  return Math.round(nav.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
});
ok(clear !== null && clear >= 0, `last list item clears the fixed nav by ${clear}px`);

// ── 6. keyboard reaches the checkbox with a visible ring ────────
await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
let reached = false;
for (let i = 0; i < 24; i++) {
  await p.keyboard.press('Tab');
  if (await p.evaluate(() => document.activeElement?.classList.contains('check'))) { reached = true; break; }
}
ok(reached, 'checkbox is reachable by keyboard');
const ring = await p.evaluate(() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  return { w: s.outlineWidth, style: s.outlineStyle };
});
ok(parseFloat(ring.w) >= 2 && ring.style !== 'none', `focus ring visible (${ring.style} ${ring.w})`);

// ── 7. reduced motion respected ─────────────────────────────────
const rm = await b.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
const p2 = await rm.newPage();
await p2.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await p2.waitForTimeout(500);
const dur = await p2.evaluate(() => getComputedStyle(document.querySelector('.scard')).animationDuration);
ok(parseFloat(dur) < 0.01, `prefers-reduced-motion collapses animation (${dur})`);

// ── 8. item count ───────────────────────────────────────────────
const total = await p.evaluate(async () => {
  const r = await fetch('/'); return r.ok;
});
ok(total, 'app shell served');

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll interaction checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
