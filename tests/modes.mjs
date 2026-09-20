/** Work and personal, the tally, and focus — in a browser. */
import { chromium } from 'playwright';

const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const pills = (p) => p.locator('.today .task .pill:not(.pill--due):not(.pill--flag)').allTextContents();

// ── work and personal ───────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  ok((await p.locator('.scard').count()) === 5, 'with both lives showing, all five streams are on the rail');
  const zones = await p.locator('.today .zone').allTextContents();
  ok(zones.join(',') === 'Work,Personal', `and Today is drawn in two zones (${zones.join(', ')})`);
  const both = await pills(p);
  ok(both.some((x) => /career|per/i.test(x)) && both.some((x) => /isodp|dir|cttl/i.test(x)),
    `each zone holds its own realm (${both.join(', ')})`);
  ok(await p.locator('.hello__date').textContent() === (await p.locator('.hello__date').textContent()).replace(/^(Work|Personal)/, ''),
    'the date line does not name a realm while both are showing');

  await p.getByRole('button', { name: 'Work', exact: true }).click();
  await p.waitForTimeout(700);
  ok((await p.locator('.scard').count()) === 3, 'switching to Work leaves three streams');
  ok(/^Work ·/.test(await p.locator('.hello__date').textContent()), 'and the date line says so');
  ok((await p.locator('.today .zone').count()) === 0, 'one realm is one list, not two zones');
  const work = await pills(p);
  ok(work.length > 0 && work.every((x) => !/career|per/i.test(x)),
    `nothing personal is on Today (${work.join(', ')})`);
  ok(await p.evaluate(() => document.body.dataset.realm) === 'work', 'the page wears the realm');
  await p.screenshot({ path: `${out}/modes-work.png` });

  // The scope reaches every screen, not just Today.
  await p.goto(`${base}/streams`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const heads = await p.locator('.chip[data-stream]').allTextContents();
  ok(!heads.some((h) => /Career|Personal/.test(h)), 'Streams does not offer the personal streams');
  ok((await p.locator('section[data-stream]').count()) === 3, 'and lists only the three at work');

  await p.keyboard.press('/');
  await p.waitForTimeout(300);
  await p.keyboard.type('allotment');
  await p.waitForTimeout(500);
  const hits = await p.locator('.search__hit, [class*="search"] li').count();
  ok(hits === 0, `search in Work cannot find the allotment (${hits} hits)`);
  await p.keyboard.press('Escape');

  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Personal', exact: true }).click();
  await p.waitForTimeout(700);
  ok((await p.locator('.scard').count()) === 2, 'Personal is the other two');
  const per = await pills(p);
  ok(per.length > 0 && per.every((x) => /career|per/i.test(x)), `and only they are on Today (${per.join(', ')})`);
  const paper = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(paper !== 'rgb(242, 244, 249)', `the paper changes colour with the realm (${paper})`);
  await p.screenshot({ path: `${out}/modes-personal.png` });

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  ok((await p.locator('.scard').count()) === 2, 'the choice survives a reload');
  await p.getByRole('button', { name: 'Both', exact: true }).click();
  await p.waitForTimeout(500);
  ok((await p.locator('.scard').count()) === 5, 'and Both brings everything back');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── the tally ───────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const tally = p.locator('.tally');
  ok(await tally.isVisible(), 'Today carries the tally');
  ok((await p.locator('.tally__n').textContent()) === '0', 'nothing has been done yet today');
  ok((await p.locator('.tally__seg').count()) === 0, 'so the ring is empty');
  ok((await p.locator('.tally__col').count()) === 7, 'the week is seven columns');
  ok((await p.locator('.tally__bead').count()) > 5, 'with beads for what was finished this week');
  const weekBefore = Number((await p.locator('.tally__sum b').textContent()));

  // Tick one: the ring draws, the number pops, the week grows.
  await p.locator('.today .task .check').first().click();
  await p.waitForTimeout(1100);
  ok((await p.locator('.tally__n').textContent()) === '1', 'ticking something makes it one done today');
  const seg = p.locator('.tally__seg').first();
  ok((await seg.count()) === 1, 'and draws one wedge');
  const dash = await seg.evaluate((el) => Number(el.getAttribute('stroke-dasharray').split(' ')[0]));
  const circ = 2 * Math.PI * 50;
  ok(dash > 0 && dash < circ / 4, `a single wedge, not a full ring (${Math.round(dash)} of ${Math.round(circ)})`);
  const stream = await seg.getAttribute('data-stream');
  ok(Boolean(stream), `in the colour of the stream it came from (${stream})`);
  ok(Number(await p.locator('.tally__sum b').textContent()) === weekBefore + 1, 'the week counts it too');
  const todayCol = p.locator('.tally__col[data-today]');
  ok((await todayCol.locator('.tally__bead').count()) === 1, "and today's column gains a bead");
  await p.screenshot({ path: `${out}/tally.png`, clip: { x: 130, y: 0, width: 1020, height: 1000 }, fullPage: true });

  // Ticking a second, then undoing it, takes it straight back off.
  await p.locator('.today .task .check').nth(1).click();
  await p.waitForTimeout(600);
  ok((await p.locator('.tally__seg').count()) === 2, 'a second tick is a second wedge');
  await p.locator('.toast button', { hasText: 'Undo' }).last().click();
  await p.waitForTimeout(600);
  ok((await p.locator('.tally__seg').count()) === 1, 'and undoing it takes the wedge back');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── focus ───────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const before = await p.evaluate(() => ({
    rail: document.querySelectorAll('.scard').length,
    prompt: document.querySelectorAll('.prompt, .nudge').length,
    title: parseFloat(getComputedStyle(document.querySelector('.task__title')).fontSize),
    notes: [...document.querySelectorAll('.task__context, .task__note')].filter((e) => e.offsetParent).length,
  }));
  await p.getByRole('button', { name: 'Focus' }).click();
  await p.waitForTimeout(600);
  const after = await p.evaluate(() => ({
    rail: document.querySelectorAll('.scard').length,
    prompt: document.querySelectorAll('.prompt, .nudge').length,
    title: parseFloat(getComputedStyle(document.querySelector('.task__title')).fontSize),
    notes: [...document.querySelectorAll('.task__context, .task__note')].filter((e) => e.offsetParent).length,
    tasks: document.querySelectorAll('.today .task').length,
    tally: Boolean(document.querySelector('.tally')),
    peek: document.querySelectorAll('.peekat').length,
    pills: [...document.querySelectorAll('.today .pill')].filter((e) => e.offsetParent).map((e) => e.className),
  }));
  ok(before.rail === 5 && after.rail === 0, 'Focus takes the stream cards off');
  ok(before.prompt > 0 && after.prompt === 0, 'and the prompts and nudges');
  ok(after.peek === 0, 'and the periphery');
  ok(before.notes > 0 && after.notes === 0, 'and the notes under each row');
  ok(after.pills.every((c) => /pill--due/.test(c)), `only a closing date is still worn (${after.pills.length} pills)`);
  ok(after.title > before.title, `the rows grow (${before.title}px → ${after.title}px)`);
  ok(after.tasks > 0 && after.tally, 'what is left is the work and the tally');
  ok(await p.evaluate(() => document.body.classList.contains('is-focus')), 'the page wears it');
  await p.screenshot({ path: `${out}/focus.png` });

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  ok((await p.locator('.scard').count()) === 0, 'Focus survives a reload');
  await p.getByRole('button', { name: 'Focus' }).click();
  await p.waitForTimeout(500);
  ok((await p.locator('.scard').count()) === 5, 'and comes off with one tap');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── a phone ─────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  for (const name of ['Work', 'Personal', 'Both']) {
    await p.getByRole('button', { name, exact: true }).click();
    await p.waitForTimeout(500);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over === 0, `${name} does not overflow at 375px (${over}px)`);
    const lines = await p.locator('.hello__date').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)));
    ok(lines === 1, `the date line stays on one line in ${name}`);
  }
  const tally = await p.locator('.tally').boundingBox();
  ok(tally.width <= 375 - 32 + 1, `the tally fits the phone (${Math.round(tally.width)}px)`);
  await p.getByRole('button', { name: 'Focus' }).click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/phone-focus.png` });
  await p.getByRole('button', { name: 'Focus' }).click();
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll mode checks passed');
process.exit(fail.length ? 1 : 0);
