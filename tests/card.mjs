/**
 * The card: the row lifting off the page, and dropping back into it.
 *
 * The geometry is what makes this feel like one object rather than two, so
 * it is asserted numerically rather than eyeballed.
 */
import { chromium } from 'playwright';

const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const near = (a, b, slack) => Math.abs(a - b) <= slack;

/**
 * Sample the card's width every frame — started *before* the click, so the
 * very first frame of the growth is caught rather than whatever the test
 * happened to arrive in time for.
 */
async function watch(p) {
  await p.evaluate(() => {
    window.__frames = [];
    const t0 = performance.now();
    const tick = () => {
      const c = document.querySelector('.card');
      if (c) {
        const r = c.getBoundingClientRect();
        window.__frames.push([
          Math.round(performance.now() - t0), Math.round(r.width),
          Math.round(r.left), Math.round(r.top),
        ]);
      }
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const frames_ = (p) => p.evaluate(() => window.__frames);

// ── 1. it grows out of the row you touched ──────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const row = await p.locator('.task').first().boundingBox();
  const clicked = p.locator('.task__open').first();
  await watch(p);
  await clicked.click();
  await p.waitForTimeout(700);
  const frames = await frames_(p);

  const first = frames[0];
  const last = frames[frames.length - 1];
  // The trace can miss the first frame or two, so assert which end of the
  // journey it began at rather than an exact rectangle.
  ok(first[1] > (row.width + last[1]) / 2 && near(first[2], row.x, 40),
    `it starts at the row's end of the journey (${first[1]}px against the row's ${Math.round(row.width)})`);
  ok(last[1] < row.width * 0.75, `and ends at the card's (${last[1]}px)`);

  // The growth has to be watchable. Timing from the test's own clock is
  // unreliable — it starts after the click resolves — so assert the shape
  // instead: many distinct sizes between the row's and the card's, spread
  // across the range rather than bunched at one end.
  const between = [...new Set(frames
    .map((f) => f[1])
    .filter((w) => w < row.width - 8 && w > last[1] + 8))];
  // Headless Chromium composites at maybe fifteen frames a second, so the
  // bar is "not a jump" rather than a frame count a real browser would hit.
  ok(between.length >= 3,
    `the growth is drawn over several frames rather than jumping (${between.length} intermediate sizes)`);
  const span = row.width - last[1];
  const spread = between.map((w) => (row.width - w) / span);
  ok(spread.some((v) => v < 0.4) && spread.some((v) => v > 0.4 && v < 0.85),
    'and passes through the middle of the journey, not just the ends');
  ok(last[1] === frames[frames.length - 1][1], 'and settles rather than overshooting at the end');

  await p.waitForTimeout(400);
  ok(await p.isVisible('.card'), 'the card is open');
  ok((await p.locator('#sheet-title').inputValue()).length > 0, 'the title is there to edit');
  ok(await p.locator('.card__crumb').isVisible(), 'it says where the item is filed');
  await p.screenshot({ path: `${out}/card-desk.png` });

  // ── 2. and drops back into the list ───────────────────────────────
  const open = await p.locator('.card').boundingBox();
  await watch(p);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(420);
  // Sampled across the whole close rather than at one instant: headless
  // composites too coarsely to land on a chosen millisecond.
  const back = await frames_(p);
  const widest = Math.max(...back.map((f) => f[1]));
  ok(widest > open.width + 60 && widest <= row.width + 8,
    `closing travels back out to the row rather than vanishing `
    + `(${Math.round(open.width)} → ${widest} → ${Math.round(row.width)})`);
  await p.waitForTimeout(300);
  ok(!(await p.isVisible('.card')), 'and then it is gone');

  const focused = await p.evaluate(() => document.activeElement?.className ?? '');
  ok(focused.includes('task__open'), `focus returns to the row that opened it (${focused || 'nothing'})`);
  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 3. everything about the item is on it ───────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/streams/isodp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('.task__open').first().click();
  await p.waitForTimeout(800);

  ok(await p.locator('.card__block--quoted').isVisible(), 'the detail the register carried is shown');
  ok(await p.locator('#sheet-note').isVisible(), 'and a place for your own note');
  ok((await p.locator('.mark').count()) === 3, 'the three states are one tap each');

  const nowPressed = await p.locator('.mark--now').getAttribute('aria-pressed');
  await p.locator('.mark--now').click();
  await p.waitForTimeout(200);
  ok((await p.locator('.mark--now').getAttribute('aria-pressed')) !== nowPressed,
    'do-now toggles on the card itself');

  const foldHeight = () => p.evaluate(() =>
    document.querySelector('.card__more').parentElement
      .querySelector('.collapse').getBoundingClientRect().height);
  const foldedHeight = await foldHeight();
  ok(foldedHeight < 4, `its history stays folded away until asked for (${Math.round(foldedHeight)}px)`);
  await p.locator('.card__more').click();
  await p.waitForTimeout(450);
  const openHeight = await foldHeight();
  ok(openHeight > 60, `and unfolds when it is (${Math.round(openHeight)}px)`);
  const history = (await p.locator('.card__history').textContent()).replace(/\s+/g, ' ');
  ok(/Added/.test(history) && /Last touched/.test(history),
    `and then says when it arrived and when it was last touched (${history.slice(0, 44)}…)`);
  ok(/the register|you/.test(history), 'and whether it came from the register or from you');
  await p.screenshot({ path: `${out}/card-history.png` });

  // The note keeps the caret, which is the whole reason this is local state.
  await p.locator('#sheet-note').click();
  await p.keyboard.type('Spoke to Anthony on Thursday.', { delay: 8 });
  ok((await p.evaluate(() => document.activeElement?.id)) === 'sheet-note',
    'typing a note does not lose the caret');

  await p.getByRole('button', { name: 'Save' }).click();
  await p.waitForTimeout(700);
  ok(!(await p.isVisible('.card')), 'saving closes it');
  ok(await p.locator('.task__note').first().isVisible(), 'and the note shows on the row');
  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 4. opened from somewhere with no row to grow from ───────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.keyboard.press('/');
  await p.waitForSelector('.find__input');
  await p.locator('.find__input').fill('belaal');
  await p.waitForTimeout(400);
  await p.locator('.find__row').first().click();
  await p.waitForTimeout(700);
  ok(await p.isVisible('.card'), 'a search result opens the same card');
  ok(await p.evaluate(() => {
    const c = document.querySelector('.card');
    return c && Math.abs(c.getBoundingClientRect().width - 560) < 40;
  }), 'and it arrives at full size rather than growing from nothing');
  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 5. a phone ──────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/streams/isodp`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.locator('.task__open').first().click();
  await p.waitForTimeout(800);

  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over === 0, `no sideways overflow at 375px (${over}px)`);

  const fits = await p.evaluate(() => {
    const c = document.querySelector('.card').getBoundingClientRect();
    return c.top >= -1 && c.bottom <= window.innerHeight + 1 && c.left >= -1 && c.right <= window.innerWidth + 1;
  });
  ok(fits, 'the whole card is on the screen');
  const footVisible = await p.evaluate(() => {
    const f = document.querySelector('.card__foot').getBoundingClientRect();
    return f.bottom <= window.innerHeight + 1 && f.height > 20;
  });
  ok(footVisible, 'and Save is reachable without hunting for it');
  await p.screenshot({ path: `${out}/card-phone.png` });
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 6. reduced motion ───────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.locator('.task__open').first().click();
  await p.waitForTimeout(90);
  const early = await p.locator('.card').boundingBox();
  ok(early && Math.abs(early.width - 560) < 40,
    `reduced motion arrives at full size instead of growing (${early ? Math.round(early.width) : 'missing'}px)`);
  const contentShown = await p.evaluate(() =>
    getComputedStyle(document.querySelector('.card__title')).opacity === '1');
  ok(contentShown, 'and its contents are readable straight away');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  ok(!(await p.isVisible('.card')), 'and it closes without a flourish');
  ok(errs.length === 0, `no page errors under reduced motion (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll card checks passed');
process.exit(fail.length ? 1 : 0);
