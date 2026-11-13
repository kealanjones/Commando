/**
 * Building context, in a real browser, in fixture mode: telling the memory
 * something, areas of your own, what it knows beside the work, and asking
 * it from search.
 */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };
const settle = (p, ms = 350) => p.waitForTimeout(ms);

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));
await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(p, 600);
const toast = async () => (await p.locator('.toast').last().textContent()) ?? '';

// ── what it knows, beside an item ──────────────────────────────────
await p.locator('.task__open', { hasText: 'Send Anthony the short priority sponsor list' }).first().click();
await settle(p);
const knows = p.locator('.folio .knows');
ok(await knows.isVisible(), 'an open item shows what the memory knows');
const titles = await knows.locator('.knows__title').allTextContents();
ok(titles[0] === 'ISODP 2027', `its project first (${titles.join(', ')})`);
ok(titles.includes('Anthony'), 'and the person it names and waits on');
ok((await knows.locator('li').first().textContent()).includes('Sponsorship is the critical path'), 'with where things stand');
await p.screenshot({ path: `${out}/desk-knows.png` });

await p.locator('.task__open', { hasText: 'Send formal invitations for the Custodian Board meeting' }).first().click();
await settle(p);
ok((await p.locator('.folio .knows').count()) === 0, 'an item the memory knows nothing about shows nothing');

// The title leads to the whole note, opened.
await p.locator('.task__open', { hasText: 'Send Anthony the short priority sponsor list' }).first().click();
await settle(p);
await knows.locator('.knows__title', { hasText: 'Anthony' }).click();
await p.waitForSelector('.mem');
await settle(p);
ok(new URL(p.url()).pathname === '/memory', 'a note\'s name leads to Memory');
ok((await p.locator('.mem__kinds button[aria-pressed="true"]').textContent()).includes('People'), 'on the right kind');
ok(await p.locator('.mem__note', { hasText: 'Anthony' }).locator('.mem__timeline').isVisible(), 'with that note open');

// ── telling it something ───────────────────────────────────────────
await p.evaluate(() => document.activeElement?.blur());
await p.keyboard.press('t');
const sheet = p.getByRole('dialog', { name: 'Tell the memory something' });
await sheet.waitFor();
ok(await p.evaluate(() => document.activeElement?.id === 'tell-text'), 'T opens the tell sheet, ready to type');
ok(await sheet.getByRole('button', { name: 'Remember' }).isDisabled(), 'with nothing to remember yet');
await p.locator('#tell-text').fill('Suzanne says TTS charged 2.9% on sponsor payments at Kyoto.');
await p.keyboard.press('n');   // typing, not a shortcut
ok((await p.locator('.sheet[aria-label="Add an item"]').count()) === 0, 'shortcuts stay quiet while you type');
await p.keyboard.press('Backspace');
await p.keyboard.press('Control+Enter');
await settle(p, 500);
ok((await sheet.count()) === 0, 'Ctrl+Enter files it and closes');
ok((await toast()).includes('Remembered under'), `and says where it went (${(await toast()).trim()})`);

await p.getByRole('button', { name: /Topics/ }).click();
const payments = p.locator('.mem__note', { hasText: 'Sponsor payments' });
await payments.locator('.mem__notehead').click();
const line = payments.locator('.mem__timeline li', { hasText: '2.9%' });
ok((await line.count()) === 1, 'left to decide, it files under the note the words point at');
ok((await line.locator('.mem__from').textContent()).includes('added by hand'), 'marked as added by hand, not from a meeting');

// Aimed at one note, from the note itself.
await payments.getByRole('button', { name: 'Tell it something about Sponsor payments' }).click();
await sheet.waitFor();
ok((await p.locator('#tell-under option:checked').textContent()) === 'Sponsor payments', 'from a note, the sheet is already aimed at it');
await p.locator('#tell-text').fill('Finance will accept card payments through the events team.');
await sheet.getByRole('button', { name: 'Remember' }).click();
await settle(p, 500);
ok((await payments.locator('.mem__timeline li').count()) === 3, 'and the line lands on that note');

// Aimed elsewhere by hand.
await p.getByRole('button', { name: /^Tell it something/ }).first().click();
await sheet.waitFor();
await p.locator('#tell-text').fill('The venue contract is signed.');
await p.locator('#tell-under').selectOption({ label: 'ISODP 2027' });
await sheet.getByRole('button', { name: 'Remember' }).click();
await settle(p, 500);
ok((await toast()).includes('ISODP 2027'), 'naming a note sends it there, whatever the words say');
await p.getByRole('button', { name: /Projects/ }).click();
const isodp = p.locator('.mem__note', { hasText: 'ISODP 2027' });
await isodp.locator('.mem__notehead').click();
ok((await isodp.locator('.mem__timeline li', { hasText: 'venue contract' }).count()) === 1, 'and it is on that timeline');
ok((await isodp.locator('.mem__rename').count()) === 0, 'a project\'s note is named by its project');

// A project the memory has never heard of can still be filed under.
await p.getByRole('button', { name: /^Tell it something/ }).first().click();
await sheet.waitFor();
const offered = await p.locator('#tell-under optgroup[label="Projects"] option').allTextContents();
ok(offered.length >= 5 && offered.includes('Directorate'), `every project is offered, noted or not (${offered.length})`);
await p.locator('#tell-text').fill('The away day is moved to March.');
await p.locator('#tell-under').selectOption({ label: 'Directorate' });
// Two presses in the same tick: it must still be filed once.
await sheet.getByRole('button', { name: 'Remember' }).evaluate((b) => { b.click(); b.click(); });
await settle(p, 500);
ok((await toast()).includes('Directorate'), 'filing under one starts its note');
const dir = p.locator('.mem__note', { hasText: 'Directorate' });
await dir.locator('.mem__notehead').click();
ok((await dir.locator('.mem__timeline li', { hasText: 'away day' }).count()) === 1, 'with the line on it, once, however fast Remember is pressed');

// Escape keeps nothing and closes.
await p.evaluate(() => document.activeElement?.blur());
await p.keyboard.press('t');
await sheet.waitFor();
await p.keyboard.press('Escape');
await settle(p, 200);
ok((await sheet.count()) === 0 && new URL(p.url()).pathname === '/memory', 'Escape closes the sheet and nothing else');

// ── areas of your own ──────────────────────────────────────────────
await p.getByRole('button', { name: /Topics/ }).click();
await p.getByLabel('New topic').fill('Board politics');
await p.getByRole('button', { name: 'Add topic' }).click();
await settle(p);
const board = p.locator('.mem__note', { hasText: 'Board politics' });
ok((await board.count()) === 1, 'a topic of your own can be added');
ok((await p.locator('.mem__kinds button', { hasText: 'Topics' }).textContent()).includes('2'), 'and is counted');
await p.getByLabel('New topic').fill('board  POLITICS');
await p.getByRole('button', { name: 'Add topic' }).click();
await settle(p);
ok((await p.locator('.mem__note', { hasText: /board politics/i }).count()) === 1, 'the same name twice is still one topic');

await board.locator('.mem__notehead').click();
await board.locator('.mem__rename').fill('Board dynamics');
await board.locator('.mem__rename').blur();
await settle(p, 200);
const renamed = p.locator('.mem__note', { hasText: 'Board dynamics' });
ok((await renamed.locator('.mem__title').textContent()) === 'Board dynamics', 'it can be renamed');
await renamed.getByRole('button', { name: 'Delete note…' }).click();
await renamed.getByRole('button', { name: 'Keep' }).click();
ok((await renamed.count()) === 1, 'deleting asks first');
await renamed.getByRole('button', { name: 'Delete note…' }).click();
await renamed.getByRole('button', { name: 'Delete note', exact: true }).click();
await settle(p, 200);
ok((await renamed.count()) === 0, 'and then goes');

await p.getByRole('button', { name: /People/ }).click();
await p.getByLabel('New person').fill('Suzanne Clarke');
await p.getByRole('button', { name: 'Add person' }).click();
await settle(p);
ok((await p.locator('.mem__note', { hasText: 'Suzanne Clarke' }).count()) === 1, 'a person can be added the same way');
await p.screenshot({ path: `${out}/desk-memory-areas.png`, fullPage: true });

// ── asking from search ─────────────────────────────────────────────
await p.evaluate(() => document.activeElement?.blur());
await p.keyboard.press('/');
await p.waitForSelector('.find');
ok((await p.locator('.find__hint').textContent()).includes('ask the memory'), 'search says a ? asks the memory');
await p.keyboard.type('? What did we agree with OrganOx');
ok((await p.locator('.find__askhint').textContent()).includes('to ask the memory'), 'a ? turns search into a question');
ok((await p.locator('.find__list').count()) === 0, 'and stops matching items');
await p.keyboard.press('Enter');
await p.waitForSelector('.find__answer');
ok((await p.locator('.find__answer').textContent()).includes('OrganOx agreed in principle'), 'Enter brings the answer, in place');
ok((await p.locator('.find__sources').textContent()).includes('SMT, sponsorship'), 'with the meeting it came from');
await p.screenshot({ path: `${out}/desk-ask-search.png` });
await p.locator('.find__input').fill('? and what about the venue');
ok((await p.locator('.find__answer').count()) === 0, 'a new question clears the old answer');
await p.locator('.find__input').fill('zzzz qqqq');
await p.getByRole('button', { name: 'Ask the memory instead' }).click();
await p.waitForSelector('.find__answer');
ok((await p.locator('.find__input').inputValue()) === '? zzzz qqqq', 'a search with no matches can be turned into a question');
await p.keyboard.press('Escape');
await settle(p, 200);

// ── the other places it shows up ───────────────────────────────────
await p.goto(`${base}/checkout?project=isodp`, { waitUntil: 'networkidle' });
await p.waitForSelector('.fx__setup');
await p.keyboard.press('Enter');
await p.waitForSelector('.fx__card');
await settle(p, 800);
ok((await p.locator('.fx__card .knows .knows__title').first().textContent()) === 'ISODP 2027', 'a Check out card carries what it knows');
await p.goto(`${base}/brief?stream=isodp`, { waitUntil: 'networkidle' });
await settle(p);
ok((await p.locator('.brief .knows').textContent()).includes('Sponsorship is the critical path'), 'a project\'s brief opens with it');
ok(!(await p.locator('.brief__raw pre').textContent()).includes('critical path'), 'but it stays out of the text that gets pasted');
await p.goto(`${base}/review/decide`, { waitUntil: 'networkidle' });
await settle(p, 600);
const rvKnows = await p.locator('.rv__card .knows').count();
const rvStream = await p.locator('.rv__card').getAttribute('data-stream');
ok(rvStream === 'isodp' ? rvKnows === 1 : rvKnows <= 1, `the review card shows it when it has some (${rvStream}: ${rvKnows})`);

// From New item: an item, and something for the memory with it.
await p.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(p, 400);
await p.keyboard.press('n');
await p.locator('#add-title').fill('Call 23Red about the campaign');
await p.locator('#add-section').selectOption({ label: 'Sponsorship' });
await p.locator('#add-remember').fill('23Red are the campaign agency; Maya leads the account.');
await p.mouse.click(5, 500);   // a stray click outside the sheet
ok((await p.locator('#add-title').inputValue()) === 'Call 23Red about the campaign', 'a click outside does not throw away a half-typed item');
await p.getByRole('button', { name: 'Add', exact: true }).click();
await settle(p, 600);
ok((await p.locator('.toast').allTextContents()).some((t) => t.includes('Added.')), 'New item adds the item');
ok((await toast()).includes('Remembered under ISODP 2027'), 'and tells the memory with it, under the item\'s project');
await p.keyboard.press('/');
await p.keyboard.type('23Red');
await settle(p, 300);
ok((await p.locator('.find__row', { hasText: 'Call 23Red about the campaign' }).count()) === 1, 'the item is there to be found');
await p.keyboard.press('Escape');
await p.locator('.index__nav a', { hasText: 'Memory' }).click();
await p.waitForSelector('.mem');
const isodp2 = p.locator('.mem__note', { hasText: 'ISODP 2027' });
await isodp2.locator('.mem__notehead').click();
ok((await isodp2.locator('.mem__timeline li', { hasText: 'Maya leads the account' }).count()) === 1, 'and the note is on that project\'s timeline');
const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow (${over}px)`);
await ctx.close();

// ── a phone ────────────────────────────────────────────────────────
const phone = await (await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })).newPage();
phone.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));
await phone.goto(`${base}/`, { waitUntil: 'networkidle' });
await settle(phone, 500);
await phone.locator('.task__open', { hasText: 'Send Anthony the short priority sponsor list' }).first().click();
await settle(phone, 700);
ok((await phone.locator('.knows--card .knows__title').first().textContent()) === 'ISODP 2027', 'on a phone the item card shows it too');
await phone.screenshot({ path: `${out}/phone-knows.png` });
await phone.locator('.knows--card .knows__title').first().click();
await phone.waitForSelector('.mem');
await settle(phone, 500);
ok((await phone.locator('.card, .scrim').count()) === 0, 'following a note from the card closes the card');
ok(await phone.evaluate(() => getComputedStyle(document.body).overflow !== 'hidden'), 'and gives the page back its scroll');
ok(await phone.locator('.mem__note', { hasText: 'ISODP 2027' }).locator('.mem__timeline').isVisible(), 'with the note open underneath');
await phone.goto(`${base}/memory`, { waitUntil: 'networkidle' });
await phone.getByRole('button', { name: /^Tell it something/ }).click();
await phone.getByRole('dialog', { name: 'Tell the memory something' }).waitFor();
const pover = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(pover === 0, `the tell sheet fits a phone (${pover}px)`);
await phone.screenshot({ path: `${out}/phone-tell.png` });

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll context checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
