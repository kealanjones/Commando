/** The brief, in a browser: reached from a person and from a stream. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

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
  await p.locator('.person').first().click();
  await p.waitForTimeout(600);
  await p.getByRole('link', { name: 'Brief' }).click();
  await p.waitForTimeout(800);
  ok(p.url().includes('/brief?person='), 'a person page offers their brief');

  ok((await p.locator('.brief__head h3').textContent()).length > 0, 'the brief has a subject');
  const stand = await p.locator('.brief__head p').textContent();
  ok(/open/.test(stand), `and a standfirst that counts what is open (${stand})`);

  const headings = await p.locator('.brief__block h4').allTextContents();
  ok(headings.some((h) => /what i need from/i.test(h)),
    `a person's brief leads with what you need from them (${headings[0]})`);
  ok(headings.some((h) => /moved since/i.test(h)), 'and reports what has moved');
  await p.screenshot({ path: `${out}/brief.png` });

  // A stream's brief, from the stream: a different shape, not just other rows.
  await p.getByRole('link', { name: 'Streams' }).click();
  await p.waitForTimeout(600);
  await p.locator('.srow', { hasText: 'ISODP' }).click();
  await p.waitForTimeout(600);
  await p.getByRole('link', { name: 'Brief' }).click();
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
  ok(await p.isVisible('#folio-title'), 'a line opens the item it is about, in the folio at a desk');
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

  for (const [path, name] of [['/brief', 'the brief']]) {
    await p.goto(base + path, { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over === 0, `${name} does not overflow at 375px (${over}px)`);
    await p.screenshot({ path: `${out}/phone-${path.slice(1)}.png` });
  }

  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(400);
  const clear = await p.evaluate(() => {
    const nav = document.querySelector('.phonebottom').getBoundingClientRect().top;
    const last = document.querySelector('.brief__raw');
    return last.getBoundingClientRect().bottom <= nav + 1;
  });
  ok(clear, 'and the fixed nav does not cover the end of it');
  ok(errs.length === 0, `no page errors on the phone (${errs.slice(0, 2).join('; ') || 'none'})`);
  await ctx.close();
}

await b.close();
console.log(fail.length ? `\n${fail.length} FAILING:\n- ${fail.join('\n- ')}` : '\nAll brief checks passed');
process.exit(fail.length ? 1 : 0);
