/** Check out in a real browser, in fixture mode. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const settle = (p, ms = 750) => p.waitForTimeout(ms);

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(p, 500);

// ── choosing the pile ──────────────────────────────────────────────
await p.getByRole('button', { name: 'Check out items one by one' }).click();
await p.waitForSelector('.fx__setup');
ok(new URL(p.url()).pathname === '/checkout', 'Check out opens from the bar at a desk');
ok(!(await p.locator('.index').count()), 'it takes the whole screen: nothing else in sight');

const count = async () => Number((await p.locator('.fx__count .num__in').textContent()).trim());
const everything = await count();
ok(everything > 10, `everything open is the default pile (${everything})`);

await p.locator('.fx__chip', { hasText: 'ISODP 2027' }).click();
await settle(p, 200);
const isodp = await count();
ok(isodp > 0 && isodp < everything, `one project narrows it (${isodp})`);
ok(await p.locator('.fx__chips--sub').isVisible(), 'and offers its sub-focuses');
await p.locator('.fx__chips--sub .fx__chip', { hasText: 'Sponsorship' }).click();
await settle(p, 200);
const spon = await count();
ok(spon > 0 && spon <= isodp, `one sub-focus narrows it again (${spon})`);
const url = new URL(p.url());
ok(url.searchParams.get('project') === 'isodp' && url.searchParams.get('focus'), 'the choice is kept in the address');
await p.locator('.fx__chip', { hasText: 'Due this week' }).click();
await settle(p, 200);
ok((await count()) <= spon, 'which items narrows it further');
await p.locator('.fx__chip', { hasText: 'Everything open' }).click();
await p.locator('.fx__chip', { hasText: 'By due date' }).click();
await settle(p, 300);
await p.screenshot({ path: `${out}/desk-focus-setup.png` });

const peek = (await p.locator('.fx__peektitle').textContent()).trim();
await p.keyboard.press('Enter');
await p.waitForSelector('.fx__card');
await settle(p);
const title = async () => (await p.locator('.fx__title').textContent()).trim();
ok((await title()) === peek, 'Start opens on the card shown on top of the pile');
ok((await p.locator('.fx__tally').textContent()).includes(`${spon} to go`), 'the bar says how many are left');
ok(await p.locator('.fx__facts').isVisible(), 'the card shows its details');
await p.screenshot({ path: `${out}/desk-focus-card.png` });

// ── the decisions ──────────────────────────────────────────────────
const first = await title();
await p.keyboard.press('d');
await settle(p, 250);
ok(await p.locator('.fx__stamp').isVisible(), 'done stamps the card on its way out');
await settle(p, 700);
const second = await title();
ok(second !== first, 'done brings on the next card');
ok((await p.locator('.fx__tally').textContent()).startsWith('1 done'), 'and counts it');

await p.keyboard.press('z');
await settle(p);
ok((await title()) === first, 'undo brings the last one back');
await p.keyboard.press('d');
await settle(p, 60);
await p.locator('.toast button', { hasText: 'Undo' }).click();
await settle(p, 1000);
ok((await title()) === first, 'undo pressed while the card is still leaving is not lost');
await p.keyboard.press('d');
await settle(p, 1000);

await p.keyboard.press('l');
await settle(p);
ok((await title()) !== second, 'later moves on');
const li = p.locator('.fx__ticks li');
ok((await li.count()) === 0 || (await p.locator('.fx__ticks li[data-state="passed"]').count()) === 1, 'and marks it passed over');

const third = await title();
await p.keyboard.press('t');
await settle(p, 300);
ok(await p.locator('.fx__menu[aria-label="Snooze until"]').isVisible(), 'snooze offers its days');
await p.keyboard.press('1');
await settle(p);
ok((await title()) !== third, 'a snooze moves on');
ok((await p.locator('.toast').last().textContent()).includes('Snoozed to tomorrow'), 'and says until when');

// Note, pin and move keep the card where it is.
const here = await title();
await p.keyboard.press('n');
await p.locator('#fx-note').fill('Ask Priya first');
await p.keyboard.press('Control+Enter');
await settle(p, 300);
ok((await p.locator('.fx__notebody').textContent()).includes('Ask Priya first'), 'a note is written on the card');
const pinned = await p.locator('.fx__badge', { hasText: 'Do now' }).count();
await p.keyboard.press('p');
await settle(p, 300);
ok((await p.locator('.fx__badge', { hasText: 'Do now' }).count()) !== pinned, 'P puts it on or takes it off Do now');
await p.keyboard.press('m');
await settle(p, 300);
const target = p.locator('.fx__movelist .fx__chip:not([disabled])').nth(3);
const where = (await target.textContent()).split(' → ').at(-1);
await target.click();
await settle(p, 300);
ok((await p.locator('.fx__crumb').textContent()).includes(where), `move files it somewhere else (${where})`);
ok((await title()) === here, 'and the card stays');

// Stay with it.
await p.keyboard.press('s');
await settle(p, 1300);
ok(await p.locator('.fx__clock').isVisible(), 'stay with it starts a clock');
ok((await p.locator('.fx__clock').textContent()) !== '0:00', 'that runs');
await p.screenshot({ path: `${out}/desk-focus-stay.png` });
await p.keyboard.press('s');
await settle(p, 300);
ok(!(await p.locator('.fx__clock').count()), 'and stops when you step away');

// Delete asks first.
await p.keyboard.press('Backspace');
await settle(p, 300);
ok(await p.getByRole('group', { name: 'Delete this item?' }).isVisible(), 'delete asks first');
await p.keyboard.press('Escape');
await settle(p, 300);
ok((await title()) === here, 'escape keeps it');
await p.keyboard.press('Backspace');
await p.keyboard.press('Enter');
await settle(p);
ok((await title()) !== here, 'enter deletes it');

// Out, and the list has the changes.
await p.keyboard.press('Escape');
await settle(p, 500);
ok(new URL(p.url()).pathname === '/', 'escape goes back where it came from');
await p.locator('.deskbar__search').click();
await p.keyboard.type(first.slice(0, 18));
await settle(p, 400);
await p.keyboard.press('Escape');

// ── a whole run, from a project page ───────────────────────────────
await p.goto(`${base}/projects/per`, { waitUntil: 'networkidle' });
await settle(p, 400);
await p.getByRole('link', { name: 'Check out' }).click();
await p.waitForSelector('.fx__setup');
ok((await p.locator('.fx__chip[aria-pressed="true"]').allTextContents()).includes('All of Personal'), 'from a project page, the project is already chosen');
const n = await count();
await p.keyboard.press('Enter');
await p.waitForSelector('.fx__card');
for (let i = 0; i < n; i++) { await settle(p, 120); await p.keyboard.press('d'); await settle(p, 700); }
await p.waitForSelector('.fx__end');
ok((await p.locator('.fx__endnum').textContent()).trim() === String(n), `the end says how many were done (${n})`);
ok((await p.locator('.fx__endh').textContent()).includes('Every one done'), 'and says so');
ok((await p.locator('.fx__endpaper .receipt__lines li').count()) === n, 'the run prints its own receipt');
ok((await p.locator('.fx__endpaper .receipt__total dd').textContent()) === String(n), 'with the total');
await p.locator('.toast button', { hasText: 'Undo' }).click();
await settle(p, 900);
ok(await p.locator('.fx__card').isVisible(), 'undo at the end brings the last card back');
await p.keyboard.press('d');
await settle(p, 900);
await p.waitForSelector('.fx__end');
await p.screenshot({ path: `${out}/desk-focus-end.png` });
await p.getByRole('button', { name: 'Another pile' }).click();

await settle(p, 300);
ok(await p.locator('.fx__setup').isVisible(), 'another pile goes back to choosing');
ok((await count()) === 0, 'and that project is now clear');
await p.getByRole('button', { name: 'Close check out' }).focus();
await p.keyboard.press('Enter');
await settle(p, 400);
ok(new URL(p.url()).pathname !== '/checkout', 'Enter on a focused control does what that control does');
await ctx.close();

// ── a phone ────────────────────────────────────────────────────────
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
const q = await phone.newPage();
q.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));
await q.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(q, 400);
await q.getByRole('button', { name: 'Check out items one by one' }).click();
await q.waitForSelector('.fx__setup');
await settle(q);
const wide = () => q.evaluate(() => document.querySelector('.fx').scrollWidth <= window.innerWidth);
ok(await wide(), 'on a phone the choosing fits the width');
ok(await q.locator('.fx__start').isVisible(), 'and Start is in reach');
await q.locator('.fx__start').click();
await settle(q);
ok(await wide(), 'the card fits the width');
await q.getByRole('button', { name: 'Done' }).click();
await settle(q, 900);
ok((await q.locator('.fx__tally').count()) === 1, 'buttons work by touch');
await q.screenshot({ path: `${out}/phone-focus-card.png` });
await phone.close();

await b.close();
console.log(fail.length ? `\nFAILED:\n${fail.join('\n')}` : '\nall passed');
process.exit(fail.length ? 1 : 0);
