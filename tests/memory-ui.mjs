/** The Memory page in a real browser, in fixture mode. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.locator('.index__nav a', { hasText: 'Memory' }).click();
await p.waitForSelector('.mem');
ok(new URL(p.url()).pathname === '/memory', 'Memory is in the sidebar');
ok((await p.locator('.shead__meta').textContent()).includes('3 notes · 4 lines · 2 of 3 meetings'), 'it says how much it knows, and from how many meetings');

// ── browsing ───────────────────────────────────────────────────────
ok((await p.locator('.mem__note').count()) === 1, 'Projects shows the project notes');
await p.getByRole('button', { name: /People/ }).click();
ok((await p.locator('.mem__title').allTextContents()).join() === 'Anthony', 'People shows the people');
await p.getByRole('button', { name: /Projects/ }).click();
const isodp = p.locator('.mem__note', { hasText: 'ISODP 2027' });
await isodp.locator('.mem__notehead').click();
ok((await isodp.locator('.mem__timeline li').count()) === 2, 'a note opens on its timeline');
ok((await isodp.locator('.mem__timeline li').first().textContent()).includes('SMT, sponsorship'), 'each line says which meeting it came from');
await p.screenshot({ path: `${out}/desk-memory.png` });

// ── correcting ─────────────────────────────────────────────────────
const nowBox = isodp.locator('textarea');
await nowBox.fill('Sponsorship is still the critical path; payments route agreed in principle.');
await nowBox.blur();
await p.waitForTimeout(150);
await isodp.locator('.mem__notehead').click();
ok((await isodp.locator('.mem__nowpeek').textContent()).includes('payments route agreed'), 'a corrected "now" is kept');
await isodp.locator('.mem__notehead').click();
await isodp.getByRole('button', { name: /Remove: Isaac will not sign off/ }).click();
await p.waitForTimeout(150);
ok((await isodp.locator('.mem__timeline li').count()) === 1, 'a wrong line can be struck out');

// ── asking ─────────────────────────────────────────────────────────
await p.locator('#mem-q').fill('What did we agree with OrganOx?');
await p.getByRole('button', { name: 'Ask', exact: true }).click();
await p.waitForSelector('.mem__answer');
ok((await p.locator('.mem__answer').textContent()).includes('OrganOx agreed in principle'), 'asking gives an answer from the memory');
ok((await p.locator('.mem__sources').textContent()).includes('SMT, sponsorship'), 'and says which meeting it came from');

// ── meetings ───────────────────────────────────────────────────────
ok(await p.locator('.mem__past').isVisible(), 'a meeting not yet in the memory is pointed out');
const steph = p.locator('.mem__meeting', { hasText: 'Catch-up with Steph' });
ok((await steph.locator('.mem__mstate').textContent()) === 'not yet', 'and listed as not yet remembered');

const smt = p.locator('.mem__meeting', { hasText: 'SMT, sponsorship' });
await smt.getByRole('button', { name: 'Forget' }).click();
await smt.getByRole('button', { name: 'Forget it' }).click();
await p.waitForTimeout(300);
ok((await smt.locator('.mem__mstate').textContent()) === 'forgotten', 'a meeting can be forgotten');
await p.getByRole('button', { name: /Topics/ }).click();
ok((await p.locator('.mem__note').count()) === 0, 'and a note it alone fed goes with it');
await p.getByRole('button', { name: /Projects/ }).click();
// ISODP's other line was struck out above, so forgetting SMT leaves it empty.
ok((await isodp.count()) === 0, 'a note with nothing left after forgetting goes too');
await p.getByRole('button', { name: /People/ }).click();
ok((await p.locator('.mem__note', { hasText: 'Anthony' }).count()) === 1, 'notes other meetings fed stay');
await p.getByRole('button', { name: /Projects/ }).click();

// ── keeping ────────────────────────────────────────────────────────
const [download] = await Promise.all([
  p.waitForEvent('download'),
  p.getByRole('button', { name: 'Export for Claude' }).click(),
]);
ok(/^work-memory-\d{4}-\d{2}-\d{2}\.md$/.test(download.suggestedFilename()), `the export downloads as Markdown (${download.suggestedFilename()})`);
const text = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
ok(text.startsWith('# My work memory') && text.includes('### Anthony') && !text.includes('### ISODP 2027'), 'with every note it still has in it');

await p.getByRole('button', { name: 'Erase memory…' }).click();
await p.getByRole('button', { name: 'Erase memory', exact: true }).click();
await p.waitForTimeout(300);
ok((await p.locator('.shead__meta').textContent()).startsWith('0 notes · 0 lines'), 'erasing empties the memory');
ok((await p.locator('.mem__meeting').count()) === 3, 'but keeps the meetings, to remember again');

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow (${over}px)`);

// ── on a phone, from Settings ──────────────────────────────────────
const phone = await (await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })).newPage();
await phone.goto(`${base}/settings`, { waitUntil: 'networkidle' });
await phone.getByRole('link', { name: 'Open memory' }).click();
await phone.waitForSelector('.mem');
const pover = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(pover === 0, `Memory fits a phone, reached from Settings (${pover}px)`);
await phone.screenshot({ path: `${out}/phone-memory.png` });

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll memory checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
