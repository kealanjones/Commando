/**
 * The Web view in a real browser: the arrangements, the filters, the
 * selection, and the way out to a task.
 */
import { chromium } from 'playwright';

const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

/** Click around the canvas until something is selected; returns where. */
async function findNode(p) {
  const box = await p.evaluate(() => {
    const r = document.querySelector('.web__canvas').getBoundingClientRect();
    return { l: r.left, t: r.top, w: r.width, h: r.height };
  });
  for (let gy = 0.12; gy <= 0.88; gy += 0.04) {
    for (let gx = 0.12; gx <= 0.88; gx += 0.04) {
      await p.mouse.click(box.l + box.w * gx, box.t + box.h * gy);
      if (await p.isVisible('.web__detail')) return { gx, gy, box };
    }
  }
  return null;
}

// ── 1. the opening move, once ───────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/web`, { waitUntil: 'networkidle' });

  const first = await p.getByRole('button', { name: 'As filed' }).getAttribute('aria-pressed');
  ok(first === 'true', 'a first visit opens on the filed arrangement');

  await p.waitForTimeout(2600);
  const after = await p.getByRole('button', { name: 'As connected' }).getAttribute('aria-pressed');
  ok(after === 'true', 'and then lets go by itself, once, to make the point');

  await p.getByRole('button', { name: 'Under pressure' }).click();
  await p.waitForTimeout(2400);
  await p.screenshot({ path: `${out}/web-pressure.png` });
  ok((await p.textContent('.web__caption')).includes('Quiet across'), 'the caption follows the arrangement');

  // The chosen arrangement survives a reload; the opening move does not repeat.
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  ok(
    (await p.getByRole('button', { name: 'Under pressure' }).getAttribute('aria-pressed')) === 'true',
    'it opens where you left it next time',
  );
  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 2. filters, selection, and the way through to a task ────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/web`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(2800);

  // A stream key narrows to that stream and says what leaks out of it.
  await p.getByRole('button', { name: /Directorate/ }).click();
  await p.waitForTimeout(600);
  const streamCaption = await p.textContent('.web__caption');
  ok(streamCaption.startsWith('Directorate.'), `a stream key reads back that stream (${streamCaption.slice(0, 34)}…)`);
  ok(/links run outside the stream|links outside/.test(streamCaption), 'and how much of it reaches outside itself');

  // A connector narrows to their reach.
  await p.getByRole('button', { name: /^Anthony/ }).click();
  await p.waitForTimeout(600);
  const who = await p.textContent('.web__caption');
  ok(who.startsWith('Anthony'), 'picking a connector reads back their reach');
  ok(/\d+ sections/.test(who), 'with the number of sections they are in');
  ok(
    (await p.getByRole('button', { name: /Directorate/ }).getAttribute('aria-pressed')) === 'false',
    'and clears the stream filter rather than fighting it',
  );
  await p.screenshot({ path: `${out}/web-connector.png` });

  await p.getByRole('button', { name: 'Show everything' }).click();
  await p.waitForTimeout(400);
  ok(!(await p.isVisible('button:has-text("Show everything")')), 'clearing the filter puts the button away');

  // Selecting a section opens the panel, with a way into the work.
  const hit = await findNode(p);
  ok(hit !== null, 'clicking a dot selects that section');
  const detail = (await p.textContent('.web__detail')).replace(/\s+/g, ' ');
  ok(/to do/.test(detail) && /keep tabs/.test(detail), `the panel shows what is in it (${detail.slice(0, 46)}…)`);
  ok((await p.locator('.sr-only[aria-live]').textContent()).length > 0, 'and it is announced for a screen reader');
  await p.screenshot({ path: `${out}/web-detail.png` });

  const items = p.locator('.web__items button');
  if (await items.count()) {
    await items.first().click();
    await p.waitForTimeout(500);
    ok(await p.isVisible('.sheet'), 'a task in the panel opens the same editor as everywhere else');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
  } else {
    ok(false, 'the panel lists the section’s open tasks');
  }

  await p.locator('.web__dismiss').click();
  await p.waitForTimeout(300);
  ok(!(await p.isVisible('.web__detail')), 'closing the panel puts it away');

  // Zoom, and back.
  await p.getByRole('button', { name: 'Zoom in' }).click();
  await p.waitForTimeout(300);
  ok(await p.isVisible('.web__zoomlevel'), 'zooming shows what zoom you are at');
  await p.getByRole('button', { name: 'Fit everything on screen' }).click();
  await p.waitForTimeout(300);
  ok(await p.isVisible('.web__canvas'), 'fit does not throw the view away');

  // Keyboard: arrows walk between sections.
  await p.locator('.web__canvas').focus();
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(300);
  ok(await p.isVisible('.web__detail'), 'an arrow key selects a section without a mouse');
  const firstPick = await p.textContent('.web__detail h3');
  await p.keyboard.press('ArrowLeft');
  await p.waitForTimeout(300);
  ok((await p.textContent('.web__detail h3')) !== firstPick, 'and the next arrow moves to a different one');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(250);
  ok(!(await p.isVisible('.web__detail')), 'escape clears the selection');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 3. a phone ──────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/web`, { waitUntil: 'networkidle' });

  await p.waitForTimeout(2800);

  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(overflow === 0, `no horizontal overflow at 375px (${overflow}px)`);

  const nav = await p.evaluate(() => {
    const a = [...document.querySelectorAll('.nav a')].map((n) => n.textContent);
    const r = document.querySelector('.nav').getBoundingClientRect();
    return { labels: a, right: r.right, width: r.width };
  });
  ok(nav.labels.includes('Web'), 'the Web has a place in the navigation');
  ok(nav.right <= 375.5, 'and the navigation still fits the screen');

  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(400);
  const clear = await p.evaluate(() => {
    const navTop = document.querySelector('.nav').getBoundingClientRect().top;
    const last = document.querySelector('.web__rail');
    return last.getBoundingClientRect().bottom <= navTop + 1;
  });
  ok(clear, 'the fixed navigation does not cover the last thing on the page');

  const hit = await findNode(p);
  ok(hit !== null, 'a dot can be tapped on a phone');
  await p.screenshot({ path: `${out}/web-phone.png`, fullPage: false });
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── 4. reduced motion ───────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/web`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  ok(
    (await p.getByRole('button', { name: 'As connected' }).getAttribute('aria-pressed')) === 'true',
    'reduced motion lands on the arrangement rather than animating into it',
  );
  const painted = await p.evaluate(() => {
    const c = document.querySelector('.web__canvas');
    const ctx2 = c.getContext('2d');
    const d = ctx2.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
    return false;
  });
  ok(painted, 'and the map is still drawn');
  ok(errs.length === 0, `no page errors under reduced motion (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} failed:\n- ${fail.join('\n- ')}` : '\nAll web checks passed');
process.exit(fail.length ? 1 : 0);
