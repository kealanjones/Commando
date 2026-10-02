import { launch, out } from './browser.mjs';
const b = await launch();
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
await p.waitForTimeout(600);
// Today keeps its rows to a title and a date, so the note is checked by
// opening the item again rather than by reading it off the row.
await p.locator('.task__open').first().click();
await p.waitForSelector('#sheet-note');
ok((await p.locator('#sheet-note').inputValue()) === phrase, 'note is still there when the item is opened again');
await p.keyboard.press('Escape');
await p.waitForTimeout(600);

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

// ── 3b. a ticked row stays, struck, until Clear done ───────────
{
  ok((await p.locator('.cleardone').count()) === 0, 'with nothing struck, there is nothing to clear');

  const id = await p.evaluate(() => document.querySelector('.task .check')?.id);
  await p.locator(`#${id}`).click();
  await p.waitForTimeout(5800);
  ok((await p.locator(`#${id}`).count()) === 1 && (await p.locator(`#${id}`).isChecked()),
    'long after the undo has gone, the ticked row is still there');
  ok(await p.locator(`#${id}`).evaluate((c) => c.closest('.task').classList.contains('task--done')),
    'struck through');
  ok((await p.locator('.cleardone').textContent()).includes('1'), 'Clear done shows how many it will take');

  await p.locator('.cleardone').click();
  await p.waitForTimeout(150);
  ok(await p.locator(`#${id}`).evaluate((c) => c.closest('.task').classList.contains('task--leaving')),
    'clearing folds the struck row shut');
  await p.waitForTimeout(700);
  ok((await p.locator(`#${id}`).count()) === 0, 'and then it is gone');
  ok((await p.locator('.cleardone').count()) === 0, 'and so is the button');
  ok(await p.locator('.toast', { hasText: 'Cleared 1.' }).isVisible(), 'clearing offers Undo');
  await p.locator('.toast button', { hasText: 'Undo' }).click();
  await p.waitForTimeout(500);
  ok((await p.locator(`#${id}`).count()) === 1 && (await p.locator(`#${id}`).isChecked()),
    'undo puts it back, still struck');

  // Reopening it takes it off the struck list again.
  await p.locator(`#${id}`).click();
  await p.waitForTimeout(400);
  ok((await p.locator('.cleardone').count()) === 0, 'reopening it leaves nothing to clear');
}

// ── 4. delete is reversible ─────────────────────────────────────
// Assert on the specific row, not the count.
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
await p.goto('http://127.0.0.1:4173/streams/isodp', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await p.waitForTimeout(500);
const clear = await p.evaluate(() => {
  const tasks = [...document.querySelectorAll('.task')];
  const last = tasks[tasks.length - 1];
  const nav = document.querySelector('.phonebottom');
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
const dur = await p2.evaluate(() => getComputedStyle(document.querySelector('.task')).animationDuration);
ok(parseFloat(dur) < 0.01, `prefers-reduced-motion collapses animation (${dur})`);

// ── 8. item count ───────────────────────────────────────────────
const total = await p.evaluate(async () => {
  const r = await fetch('/'); return r.ok;
});
ok(total, 'app shell served');

// ── 8b. the day's tally, its stamp, and its receipt ────────────
{
  const ctx3 = await b.newContext({ viewport: { width: 1400, height: 900 } });
  const d = await ctx3.newPage();
  await d.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await d.waitForTimeout(800);
  const strokes = () => d.locator('.daytally--index .daytally__gate path').count();
  ok((await strokes()) === 0, 'no ticks yet, no tally marks');
  ok(await d.locator('.daytally--index').isVisible() && !(await d.locator('.daytally--phone').isVisible()),
    'at a desk the tally is under the date, not above the list');
  ok((await d.locator('.daytally--index').textContent()).includes('Nothing ticked yet'), 'and the tally says so');

  for (let i = 0; i < 4; i++) {
    const id = await d.evaluate(() => [...document.querySelectorAll('.task .check')].find((c) => !c.checked)?.id);
    await d.locator(`#${id}`).click();
    await d.waitForTimeout(150);
  }
  ok((await strokes()) === 4, `each tick draws a stroke (${await strokes()})`);
  ok((await d.locator('.stamp').count()) === 0, 'no stamp before the fifth');

  const fifth = await d.evaluate(() => [...document.querySelectorAll('.task .check')].find((c) => !c.checked)?.id);
  await d.locator(`#${fifth}`).click();
  await d.waitForTimeout(300);
  ok((await d.locator('.daytally--index .daytally__cross').count()) === 1, 'the fifth crosses the gate');
  ok((await d.locator('.stamp').textContent())?.includes('Good start'), 'and brings down the stamp');
  await d.waitForTimeout(2400);
  ok((await d.locator('.stamp').count()) === 0, 'which lifts away again');

  // Undo the fifth and tick it again: one stamp a milestone a day.
  await d.locator(`#${fifth}`).click();
  await d.waitForTimeout(200);
  await d.locator(`#${fifth}`).click();
  await d.waitForTimeout(300);
  ok((await d.locator('.stamp').count()) === 0, 'reaching five again the same day does not stamp twice');

  await d.evaluate(() => document.activeElement?.blur());
  await d.keyboard.press('j');   // a row is selected, so X would act on it
  await d.waitForTimeout(150);
  ok((await d.locator('.task[data-selected]').count()) === 1, 'a row is selected');
  await d.locator('.daytally--index').click();
  await d.waitForSelector('.receipt');
  ok((await d.locator('.receipt__lines li').count()) === 5, 'the receipt lists the five');
  ok((await d.locator('.receipt__total').textContent()).includes('5'), 'with a total');
  await d.keyboard.press('x');
  ok((await d.locator('.task .check:checked').count()) === 5, 'the list keys do nothing behind the receipt');
  await d.getByRole('button', { name: 'Tear off' }).click();
  await d.waitForTimeout(700);
  ok((await d.locator('.receipt').count()) === 0, 'tearing it off closes it');
  await ctx3.close();
}

// ── 9. on a person, a ticked row stays where it was ─────────────
{
  await p.goto('http://127.0.0.1:4173/people', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  // The person with the most open items, so there is an order to keep.
  const href = await p.evaluate(() => [...document.querySelectorAll('a[href^="/people/"]')]
    .map((a) => ({ h: a.getAttribute('href'), n: parseInt(a.textContent.match(/(\d+)\s*$/)?.[1] ?? '0', 10) }))
    .sort((a, b) => b.n - a.n)[0]?.h);
  await p.goto(`http://127.0.0.1:4173${href}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const before = await p.evaluate(() => [...document.querySelectorAll('.task .check')].map((c) => c.id));
  ok(before.length >= 2, `the person has rows to keep in order (${before.length})`);
  await p.locator(`#${before[0]}`).click();
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => [...document.querySelectorAll('.task .check')].map((c) => c.id));
  ok(JSON.stringify(before) === JSON.stringify(after), 'ticking on a person does not move the row');
  ok((await p.locator('.cleardone').count()) === 1, 'and offers Clear done there too');
}

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll interaction checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
