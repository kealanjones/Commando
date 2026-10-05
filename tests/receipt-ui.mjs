/** The till and the roll in a real browser, in fixture mode. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const settle = (p, ms = 600) => p.waitForTimeout(ms);

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(p);

// ── the till prints as you tick ────────────────────────────────────
const till = p.locator('.till');
ok(await till.isVisible(), 'the till sits in the index');
const head = async () => Number((await till.locator('.till__head').textContent()).replace(/\D/g, ''));
const before = await head();
const box = p.locator('main input.check:not(:checked)').first();
const title = (await box.getAttribute('aria-label')).replace(/^Complete: /, '');
await box.click();
await settle(p, 800);
ok((await head()) === before + 1, `a tick rings one more through (${before} → ${await head()})`);
const last = till.locator('.till__line').last();
ok((await last.locator('.till__title').textContent()).trim() === title, 'and the till prints its line');
ok((await last.locator('.till__time').textContent()).match(/^\d\d:\d\d$/), 'with the time');

// Undo takes the line back; a plain un-tick prints RETURNED instead.
await p.locator('.toast button', { hasText: 'Undo' }).last().click();
await settle(p, 400);
ok((await head()) === before, 'Undo takes the line back off the roll');
ok((await till.locator('.till__line', { hasText: title }).count()) === 0, 'nothing is left of it');
await p.getByLabel(`Complete: ${title}`).click();
await settle(p, 400);
await p.getByLabel(`Reopen: ${title}`).click();
await settle(p, 600);
const returned = till.locator('.till__line[data-kind="returned"]');
ok((await returned.count()) === 1 && (await returned.textContent()).includes('RETURNED'), 'un-ticking prints RETURNED');
ok((await head()) === before, 'and the total is back where it was');

// ── the receipt and the roll ───────────────────────────────────────
await till.click();
const sheet = p.getByRole('dialog', { name: 'The receipt' });
await sheet.waitFor();
await settle(p, 1300);
ok((await sheet.locator('.receipt__meta').textContent()).startsWith('TODAY'), 'the till opens on today');
ok((await sheet.locator('.receipt__lines li[data-kind="returned"] .receipt__mark').count()) === 1, 'the return is marked on the paper');
ok((await sheet.locator('.receipt__bars rect').count()) > 20, 'the barcode is real');
ok((await sheet.locator('.receipt__day').textContent()).match(/^\d{4}-\d\d-\d\d$/), 'and says which day it encodes');
const codes = new Set(await sheet.locator('.receipt__lines li[data-kind="done"] .receipt__code').allTextContents());
ok((await sheet.locator('.receipt__subs').count()) === (codes.size > 1 ? 1 : 0), `a subtotal per project once there are two (${[...codes].join(', ')})`);
const place = async () => (await sheet.locator('.receipt__place').textContent()).trim();
ok((await place()).startsWith('1 of'), `today is first on the roll (${await place()})`);
await p.screenshot({ path: `${out}/desk-receipt-today.png` });

await p.keyboard.press('ArrowLeft');
await settle(p, 500);
ok((await sheet.locator('.receipt__meta').textContent()).startsWith('YESTERDAY'), 'left flicks back a day');
ok((await place()).startsWith('2 of'), 'and the place moves');
ok((await sheet.locator('.receipt__lines li').count()) > 0, 'yesterday has its lines');
await p.screenshot({ path: `${out}/desk-receipt-yesterday.png` });
await p.keyboard.press('ArrowLeft');
await settle(p, 500);
ok((await place()).startsWith('3 of'), 'and again');
await sheet.getByRole('button', { name: 'Later receipt' }).click();
await sheet.getByRole('button', { name: 'Later receipt' }).click();
await settle(p, 500);
ok((await place()).startsWith('1 of'), 'forward comes back to today');
ok(await sheet.getByRole('button', { name: 'Later receipt' }).isDisabled(), 'and no further');
ok(await sheet.getByRole('button', { name: 'Share' }).isVisible() && await sheet.getByRole('button', { name: 'Copy' }).isVisible(), 'Copy and Share are offered');
await p.keyboard.press('Escape');
await settle(p, 600);
ok((await p.locator('.receipt').count()) === 0, 'Escape tears it off');

// ── a delete prints VOID ───────────────────────────────────────────
await p.keyboard.press('c');
await p.waitForSelector('.fx__setup');
await p.keyboard.press('Enter');
await p.waitForSelector('.fx__card');
const gone = (await p.locator('.fx__title').textContent()).trim();
await p.keyboard.press('Backspace');
await p.keyboard.press('Enter');
await settle(p, 900);
await p.keyboard.press('Escape');
await settle(p, 500);
const voided = till.locator('.till__line[data-kind="void"]');
ok((await voided.count()) === 1 && (await voided.textContent()).includes(gone.slice(0, 12)), 'a delete prints VOID on the till');
await ctx.close();

// ── a phone ────────────────────────────────────────────────────────
const phone = await b.newContext({ viewport: { width: 390, height: 844 } });
const q = await phone.newPage();
q.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));
await q.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(q, 500);
await q.locator('.daytally--phone').click();
const qs = q.getByRole('dialog', { name: 'The receipt' });
await qs.waitFor();
await settle(q, 1300);
ok(await q.evaluate(() => document.querySelector('.receipt').getBoundingClientRect().right <= window.innerWidth), 'on a phone the receipt fits');
await q.keyboard.press('ArrowLeft');
await settle(q, 500);
ok((await qs.locator('.receipt__meta').textContent()).startsWith('YESTERDAY'), 'and the roll flicks there too');
await q.screenshot({ path: `${out}/phone-receipt.png` });
await phone.close();

await b.close();
console.log(fail.length ? `\nFAILED:\n${fail.join('\n')}` : '\nall passed');
process.exit(fail.length ? 1 : 0);
