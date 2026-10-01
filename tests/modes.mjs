/** Work and personal, and what Today counts — in a browser. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const pills = async (p) => {
  // Urgent folds after five; open it so every row is counted.
  const more = p.locator('.more', { hasText: 'more urgent' });
  if (await more.count()) { await more.click(); await p.waitForTimeout(300); }
  return p.locator('.today .task .pill:not(.pill--due):not(.pill--flag)').allTextContents();
};
const tab = (p, name) => p.locator('.nav').getByRole('link', { name });
const streamRows = async (p) => {
  await tab(p, 'Streams').click();
  await p.waitForTimeout(600);
  return p.locator('.srow').count();
};

// ── work and personal ───────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const both = await pills(p);
  ok(both.some((x) => /career|per/i.test(x)) && both.some((x) => /isodp|dir|cttl/i.test(x)),
    `with both lives showing, Today holds both (${[...new Set(both)].join(', ')})`);
  ok(await streamRows(p) === 5, 'and Streams lists all five');
  ok((await p.locator('.zone').allTextContents()).join(',') === 'Work,Personal',
    'with a word where one life ends and the other begins');

  await p.getByRole('button', { name: 'Work', exact: true }).click();
  await p.waitForTimeout(600);
  ok((await p.locator('.srow').count()) === 3, 'switching to Work leaves three streams');
  ok((await p.locator('.zone').count()) === 0, 'and no realm headings');
  ok(await p.evaluate(() => document.body.dataset.realm) === 'work', 'the page wears the realm');

  await tab(p, 'Today').click();
  await p.waitForTimeout(600);
  const work = await pills(p);
  ok(work.length > 0 && work.every((x) => !/career|per/i.test(x)),
    `nothing personal is on Today (${[...new Set(work)].join(', ')})`);
  await p.screenshot({ path: `${out}/modes-work.png` });

  await p.keyboard.press('/');
  await p.waitForTimeout(300);
  await p.keyboard.type('allotment');
  await p.waitForTimeout(500);
  const hits = await p.locator('.find__row').count();
  ok(hits === 0, `search in Work cannot find the allotment (${hits} hits)`);
  await p.keyboard.press('Escape');

  await p.getByRole('button', { name: 'Personal', exact: true }).click();
  await p.waitForTimeout(600);
  const per = await pills(p);
  ok(per.length > 0 && per.every((x) => /career|per/i.test(x)), `Personal shows only its own on Today (${[...new Set(per)].join(', ')})`);
  ok(await streamRows(p) === 2, 'and two streams');
  const paper = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(paper !== 'rgb(242, 244, 249)', `the paper changes colour with the realm (${paper})`);

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  ok((await p.locator('.srow').count()) === 2, 'the choice survives a reload');
  await p.getByRole('button', { name: 'Both', exact: true }).click();
  await p.waitForTimeout(500);
  ok((await p.locator('.srow').count()) === 5, 'and Both brings everything back');

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── Today: the list, and a count ────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);

  const chrome = await p.evaluate(() =>
    document.querySelectorAll('.prompt, .nudge, .rail, .scard, .tally, .peekat').length);
  ok(chrome === 0, 'Today has nothing above or around the list');
  const heads = await p.locator('.tgroup__head').allTextContents();
  ok(heads.length > 0 && heads.every((h) => /^(Overdue|Today|Urgent)\d+$/.test(h)),
    `it is grouped as overdue, today and urgent (${heads.join(', ')})`);
  ok((await p.locator('.today .task__context, .today .task__note').count()) === 0,
    'rows are a title and a date, not paragraphs');

  const count = async () => {
    const [toDo, done] = (await p.locator('.tcount b').allTextContents()).map(Number);
    return { toDo, done };
  };
  const before = await count();
  ok(before.done === 0, 'nothing has been done yet today');

  await p.locator('.today .task .check').first().click();
  await p.waitForTimeout(500);
  const after = await count();
  ok(after.done === 1 && after.toDo === before.toDo - 1,
    `ticking one moves it from to-do to done (${before.toDo}/${before.done} → ${after.toDo}/${after.done})`);
  await p.locator('.toast button', { hasText: 'Undo' }).last().click();
  await p.waitForTimeout(500);
  const undone = await count();
  ok(undone.done === 0 && undone.toDo === before.toDo, 'and undo puts it back');

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
    ok(lines === 1, `the date stays on one line in ${name}`);
  }
  const nav = await p.evaluate(() => {
    const n = document.querySelector('.nav');
    return { count: n.querySelectorAll('a').length, scrolls: n.scrollWidth > n.clientWidth + 2 };
  });
  ok(nav.count === 4, `the nav is four tabs (${nav.count})`);
  ok(!nav.scrolls, 'and they fit without scrolling');
  await p.screenshot({ path: `${out}/phone-today.png` });
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll mode checks passed');
process.exit(fail.length ? 1 : 0);
