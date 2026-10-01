/** The plan in a browser. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const loads = (p) => p.locator('.plan__day').evaluateAll((els) => els.map((e) => Number(e.dataset.load)));

// ── placing work, and watching the days darken ──────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1150 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/review/plan`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  ok(await p.locator('.plan__hand').isVisible(), 'one item is in hand');
  const first = await p.locator('.plan__handtitle').textContent();
  const left = Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, ''));
  ok(left > 100, `and the rest are counted (${left} still undated)`);

  // The chips you reach for.
  const chips = await p.locator('.plan__chip span:first-child').allTextContents();
  ok(chips[0] === 'Today' && chips[1] === 'Tomorrow', `today and tomorrow lead (${chips.join(', ')})`);
  // On a Sunday "next week" is tomorrow and folds into it, so the longer throw
  // may be the month.
  ok(chips.some((c) => /^Next (week|month)$/.test(c)), `and there is a longer throw (${chips.at(-1)})`);
  ok(chips.every((c) => !/Saturday|Sunday/.test(c)), 'nobody is offered a Sunday');

  // Placing one takes it out of the queue and darkens its day.
  const before = await loads(p);
  await p.locator('.plan__chip').first().click();          // Today
  await p.waitForTimeout(500);
  const after = await loads(p);
  ok(after.some((l, i) => l > before[i]), 'placing an item darkens the day it lands on');
  ok((await p.locator('.plan__handtitle').textContent()) !== first,
    'and the next item steps forward');
  const nowLeft = Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, ''));
  ok(nowLeft === left - 1, `the queue is one shorter (${left} → ${nowLeft})`);

  // And it can be taken straight back.
  ok(await p.locator('.plan__last').isVisible(), 'what you just placed is named, without a toast');
  await p.getByRole('button', { name: 'Undo' }).click();
  await p.waitForTimeout(500);
  ok(Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, '')) === left,
    'undo puts it back in the queue');

  // The heat scale climbs as a day fills.
  const cells = p.locator('.plan__day');
  const target = 22;
  let seen = [];
  for (let i = 0; i < 8; i++) {
    await cells.nth(target).click();
    await p.waitForTimeout(120);
    seen.push(Number(await cells.nth(target).getAttribute('data-load')));
  }
  ok(seen[0] < seen[seen.length - 1], `a day gets darker the more you put on it (${seen.join(' → ')})`);
  ok(seen[seen.length - 1] === 5, 'and reaches the top of the scale');
  ok(seen.every((v, i) => i === 0 || v >= seen[i - 1]), 'never getting lighter as it fills');
  await p.screenshot({ path: `${out}/plan.png` });

  // Placing shows you what that day now holds.
  ok(await p.locator('.plan__peek').isVisible(), 'and what lands on a day is shown as you fill it');
  const inDay = await p.locator('.plan__peekrow').count();
  ok(inDay >= 8, `every item placed there is listed (${inDay})`);
  await p.locator('.plan__peekrow button').first().click();
  await p.waitForTimeout(700);
  ok(await p.isVisible('#folio-title'), 'and opens the item it names, in the folio');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  // Not everything in a dating queue wants a date.
  {
    const before = Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, ''));
    const title = await p.locator('.plan__handtitle').textContent();
    await p.getByRole('button', { name: 'Already done' }).click();
    await p.waitForTimeout(500);
    ok(Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, '')) === before - 1,
      'marking the item in hand done takes it out of the queue without a date');
    ok((await p.locator('.plan__last').textContent()).includes('marked done'),
      'and says what happened');
    await p.getByRole('button', { name: 'Undo' }).click();
    await p.waitForTimeout(500);
    ok((await p.locator('.plan__handtitle').textContent()) === title, 'undo brings it back');

    await p.getByRole('button', { name: 'Delete' }).click();
    await p.waitForTimeout(500);
    ok(Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, '')) === before - 1,
      'deleting it takes it out too');
    ok((await p.locator('.plan__last').textContent()).includes('deleted'), 'and says so');
    await p.getByRole('button', { name: 'Undo' }).click();
    await p.waitForTimeout(600);
    ok((await p.locator('.plan__handtitle').textContent()) === title,
      'and a delete is reversible, like every other delete in this app');
  }

  // Look rather than place, which is the only way to inspect on a phone.
  await p.getByRole('button', { name: 'Look', exact: true }).click();
  await p.waitForTimeout(200);
  const held = await p.locator('.plan__handtitle').textContent();
  await cells.nth(10).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.plan__handtitle').textContent()) === held,
    'in Look, tapping a day does not place anything');

  // One stream at a time.
  await p.getByRole('button', { name: /Commonwealth/ }).click();
  await p.waitForTimeout(500);
  const crumb = await p.locator('.plan__handwhere').textContent();
  ok(crumb.length > 0, `limiting to a stream keeps a queue (${crumb})`);
  const streamLeft = Number((await p.locator('.shead__meta').first().textContent()).replace(/\D/g, ''));
  ok(streamLeft < nowLeft, `and it is a shorter one (${streamLeft})`);

  // Paging months.
  await p.getByRole('button', { name: 'Everything' }).click();
  const month = await p.locator('.plan__month h3').textContent();
  await p.getByRole('button', { name: 'The month after' }).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.plan__month h3').textContent()) !== month, 'the month can be paged');
  await p.getByRole('button', { name: 'This month' }).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.plan__month h3').textContent()) === month, 'and come back');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── a phone ─────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/review/plan`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over === 0, `the plan does not overflow at 375px (${over}px)`);

  const cell = await p.locator('.plan__day').first().boundingBox();
  ok(cell.height >= 38, `a day is big enough to hit with a thumb (${Math.round(cell.height)}px)`);

  ok(await p.locator('.tabs a[aria-current="page"]', { hasText: 'Review' }).isVisible(),
    'the plan sits under the Review tab');

  await p.locator('.plan__chip').first().click();
  await p.waitForTimeout(500);
  ok(await p.locator('.plan__last').isVisible(), 'a day can be given from the chips on a phone');
  await p.screenshot({ path: `${out}/phone-plan.png`, fullPage: false });
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll planning checks passed');
process.exit(fail.length ? 1 : 0);
