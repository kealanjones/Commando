/** The date sweep and the brief, in a browser. */
import { chromium } from 'playwright';

const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

// ── the sweep ───────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 1000 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));

  // Today should point at it rather than at a filter that only hides things.
  await p.goto(`${base}/`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const nudge = p.locator('.nudge a');
  ok((await nudge.getAttribute('href')) === '/dates',
    'the date nudge on Today offers to read them back');
  await nudge.click();
  await p.waitForTimeout(700);

  const rows = p.locator('.sweep__row');
  ok((await rows.count()) > 0, `the sweep finds something (${await rows.count()} rows)`);

  const first = rows.first();
  ok(await first.locator('.sweep__quote b').isVisible(),
    'each proposal shows the words it came from, picked out of your own sentence');
  const reason = await first.locator('.sweep__sure').textContent();
  ok(reason.length > 4, `and says why it read that date (${reason})`);
  const proposed = await first.locator('.sweep__date').textContent();
  ok(/\d{4}$/.test(proposed), `with the date in full (${proposed})`);
  await p.screenshot({ path: `${out}/sweep.png` });

  // Skipping writes nothing.
  const before = await rows.count();
  await first.getByRole('button', { name: 'Skip' }).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.sweep__row').count()) === before - 1, 'skipping takes it off the list');
  ok(await p.locator('.sweep__foot').isVisible(), 'and says it was not written anywhere');
  await p.getByRole('button', { name: 'Bring them back' }).click();
  await p.waitForTimeout(300);
  ok((await p.locator('.sweep__row').count()) === before, 'and it can be brought back');

  // Setting one takes it off the list and out of the finding.
  const title = await p.locator('.sweep__row').first().locator('.sweep__title').textContent();
  await p.locator('.sweep__row').first().getByRole('button', { name: 'Set it' }).click();
  await p.waitForTimeout(500);
  const titlesNow = await p.locator('.sweep__title').allTextContents();
  ok(!titlesNow.includes(title), `setting a date takes it off the list (${title.slice(0, 40)}…)`);

  // The sweep offers the same two answers for items that want no date.
  {
    const rows = await p.locator('.sweep__row').count();
    const title = await p.locator('.sweep__row').first().locator('.sweep__title').textContent();
    await p.locator('.sweep__row').first().getByRole('button', { name: 'Already done' }).click();
    await p.waitForTimeout(500);
    ok((await p.locator('.sweep__row').count()) === rows - 1,
      'marking one done takes it off the sweep');
    ok(await p.locator('.toast', { hasText: 'Done.' }).isVisible(), 'and offers to undo it');
    await p.locator('.toast button', { hasText: 'Undo' }).click();
    await p.waitForTimeout(500);
    const titles = await p.locator('.sweep__title').allTextContents();
    ok(titles.includes(title), 'which puts it back');

    await p.locator('.sweep__row').first().getByRole('button', { name: 'Delete' }).click();
    await p.waitForTimeout(500);
    ok(await p.locator('.toast', { hasText: 'Deleted.' }).isVisible(),
      'and a delete is offered back the same way');
    await p.locator('.toast button', { hasText: 'Undo' }).click();
    await p.waitForTimeout(500);
  }

  await p.goto(`${base}/streams`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const dated = await p.locator('.pill--flag, .pill--due').allTextContents();
  ok(dated.some((d) => /due|overdue/.test(d)), 'and the item now wears its date in the list');

  // The second list: promises with no day.
  await p.goto(`${base}/dates`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  const second = await p.locator('.sweep__bar--second').isVisible();
  ok(second, 'items that promise a deadline in words get their own list');
  if (second) {
    const hint = p.locator('.sweep__bar--second ~ ul .sweep__row').first();
    ok(await hint.locator('input[type="date"]').isVisible(),
      'each one offers a date to pin it to rather than guessing');
    ok(!(await hint.locator('.sweep__date').isVisible()),
      'and proposes nothing, because no parser should guess at "before Sydney"');
  }

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── the brief ───────────────────────────────────────────────────────
{
  const ctx = await b.newContext({
    viewport: { width: 1280, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));

  await p.goto(`${base}/people`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  ok(await p.locator('.prompt', { hasText: 'Before a catch-up' }).isVisible(),
    'the People page offers a brief before a catch-up');
  await p.getByRole('link', { name: 'Write one' }).click();
  await p.waitForTimeout(800);

  ok((await p.locator('.brief__head h3').textContent()).length > 0, 'the brief has a subject');
  const stand = await p.locator('.brief__head p').textContent();
  ok(/open/.test(stand), `and a standfirst that counts what is open (${stand})`);

  const headings = await p.locator('.brief__block h4').allTextContents();
  ok(headings.some((h) => /what i need from/i.test(h)),
    `a person's brief leads with what you need from them (${headings[0]})`);
  ok(headings.some((h) => /moved since/i.test(h)), 'and reports what has moved');
  await p.screenshot({ path: `${out}/brief.png` });

  // Switching to a stream changes the shape of the brief, not just the rows.
  await p.getByRole('button', { name: /ISODP 2027/ }).click();
  await p.waitForTimeout(600);
  const streamHeads = await p.locator('.brief__block h4').allTextContents();
  ok(streamHeads.some((h) => /pressing/i.test(h)) && streamHeads.some((h) => /gone quiet/i.test(h)),
    `a stream's brief is a different brief (${streamHeads.join(', ')})`);
  ok((await p.locator('.brief__head h3').textContent()).includes('ISODP'),
    'and is headed by the stream');

  // The window moves what "recently" means.
  await p.getByRole('button', { name: '7 days' }).click();
  await p.waitForTimeout(500);
  ok(/7 days|Nothing closed/.test(await p.locator('.brief__sheet').textContent()),
    'the window changes what counts as recent');

  // What actually gets pasted.
  await p.locator('.brief__raw summary').click();
  await p.waitForTimeout(300);
  const raw = await p.locator('.brief__raw pre').textContent();
  ok(raw.includes('ISODP 2027') && /PRESSING|MOVED RECENTLY/.test(raw),
    'the pasted text carries the headings as plain text');
  ok(!/<[a-z]/i.test(raw), 'and no markup, so it survives Teams and Outlook');

  await p.getByRole('button', { name: 'Copy' }).click();
  await p.waitForTimeout(500);
  const clip = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip.startsWith('ISODP 2027'), 'Copy puts the brief on the clipboard');
  ok(await p.locator('.brief__copy--done').isVisible(), 'and says it did');

  // A line in the brief is still a way into the work.
  await p.locator('.brief__block li button').first().click();
  await p.waitForTimeout(700);
  ok(await p.isVisible('.card'), 'a line opens the item it is about');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);

  ok(errs.length === 0, `no page errors (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

// ── a phone ─────────────────────────────────────────────────────────
{
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));

  for (const [path, name] of [['/dates', 'the sweep'], ['/brief', 'the brief']]) {
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over === 0, `${name} does not overflow at 375px (${over}px)`);
    await p.screenshot({ path: `${out}/phone-${path.slice(1)}.png` });
  }

  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(400);
  const clear = await p.evaluate(() => {
    const nav = document.querySelector('.nav').getBoundingClientRect().top;
    const last = document.querySelector('.brief__raw');
    return last.getBoundingClientRect().bottom <= nav + 1;
  });
  ok(clear, 'and the fixed nav does not cover the end of it');
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll upgrade checks passed');
process.exit(fail.length ? 1 : 0);
