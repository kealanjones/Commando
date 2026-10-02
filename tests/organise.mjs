/** Organise: create, rename, reorder, move, merge and delete projects and sub-focuses. */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

const focus = (id) => p.locator(`.org__focus[data-focus="${id}"]`);
const project = (id) => p.locator(`.org__project[data-project="${id}"]`);
const names = (id) => project(id).locator('.org__focus .org__name').evaluateAll((els) => els.map((e) => e.value));
// A life's list, found by its heading (every project row also says Work and Personal).
const realm = (name) => p.locator('.org__realm').filter({ has: p.locator('h3.zone', { hasText: new RegExp(`^${name}$`) }) });
const count = (id) => focus(id).locator('.org__n').textContent().then(Number);

await p.goto(`${base}/projects`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.getByRole('link', { name: 'Organise' }).click();
await p.waitForSelector('.org__project');
ok(new URL(p.url()).pathname === '/projects/organise', 'Organise opens from the Projects page');
ok((await p.locator('.org__project').count()) === 5, 'every project is there, in both lives');
await p.screenshot({ path: `${out}/desk-organise.png` });

// ── rename ─────────────────────────────────────────────────────────
// Renaming saves on Enter and shows everywhere. (The demo keeps writes in
// memory, so everything here stays inside the app rather than reloading.)
await focus('isodp-web').locator('.org__name').fill('Website and app');
await focus('isodp-web').locator('.org__name').press('Enter');
await p.locator('.index__stream', { hasText: 'ISODP' }).click();
await p.waitForTimeout(500);
ok((await p.locator('.sectionblock__head h3').allTextContents()).includes('Website and app'),
  'a renamed sub-focus shows under its new name on the project page');
await p.goBack();
await p.waitForSelector('.org__project');

// ── reorder ────────────────────────────────────────────────────────
const before = await names('isodp');
await p.getByRole('button', { name: `Move ${before[1]} up` }).click();
await p.waitForTimeout(200);
const after = await names('isodp');
ok(after[0] === before[1] && after[1] === before[0], `moving up swaps it with the one above (${after.slice(0, 2).join(', ')})`);
ok(await p.getByRole('button', { name: `Move ${after[0]} up` }).isDisabled(), 'the first cannot move further up');

// ── add ────────────────────────────────────────────────────────────
await project('isodp').getByPlaceholder('Add a sub-focus').fill('Volunteers');
await project('isodp').getByRole('button', { name: 'Add sub-focus to ISODP 2027' }).click();
await p.waitForTimeout(200);
ok((await names('isodp')).at(-1) === 'Volunteers', 'a new sub-focus goes at the end of its project');

// ── merge: delete with items moves them first ──────────────────────
const boardN = await count('isodp-board');
const spons = await count('isodp-g-sponsorship');
ok(boardN > 0, `Congress Board has items to move (${boardN})`);
await focus('isodp-board').getByRole('button', { name: 'Delete' }).click();
const merge = focus('isodp-board').getByRole('button', { name: 'Move and delete' });
ok(await merge.isDisabled(), 'with items inside, it will not delete until told where they go');
await focus('isodp-board').locator('.org__dest').selectOption('isodp-g-sponsorship');
await merge.click();
await p.waitForTimeout(300);
ok((await focus('isodp-board').count()) === 0, 'the sub-focus is gone');
ok((await count('isodp-g-sponsorship')) === spons + boardN, 'and its items are in the one chosen: merged, nothing lost');
ok(await p.locator('.toast', { hasText: 'Merged Congress Board into Sponsorship.' }).isVisible(), 'and it says so');

// ── an empty sub-focus deletes straight away ──────────────────────
const vol = p.locator('.org__focus', { has: p.locator('input[value="Volunteers"]') });
await vol.getByRole('button', { name: 'Delete' }).click();
await vol.getByRole('button', { name: 'Delete', exact: true }).last().click();
await p.waitForTimeout(200);
ok(!(await names('isodp')).includes('Volunteers'), 'an empty sub-focus deletes once confirmed');

// ── move a sub-focus to another project ────────────────────────────
const readN = await count('cttl-read');
await focus('cttl-read').locator('.org__move').selectOption('career');
await p.waitForTimeout(300);
ok((await project('career').locator('.org__focus[data-focus="cttl-read"]').count()) === 1,
  'a sub-focus moves to another project');
ok((await count('cttl-read')) === readN, 'taking its items with it');

// ── a new project ─────────────────────────────────────────────────
await p.getByLabel('Project name').fill('Allotment');
await p.getByLabel('Short code').fill('alot');
await p.locator('.org__new').getByRole('button', { name: 'Personal' }).click();
await p.getByRole('button', { name: 'Add project' }).click();
await p.waitForTimeout(300);
const allot = p.locator('.org__project', { has: p.locator('input[value="Allotment"]') });
ok((await allot.count()) === 1, 'a new project is added');
ok((await allot.locator('.org__code').inputValue()) === 'ALOT', 'with its code, in capitals');
ok((await allot.locator('.org__focus .org__name').evaluateAll((e) => e.map((x) => x.value))).join() === 'General',
  'and one sub-focus, General, ready for items');
ok((await realm('Personal').locator('input[value="Allotment"]').count()) === 1,
  'filed under the life chosen');
ok((await p.locator('.index__stream', { hasText: 'Allotment' }).count()) === 1, 'and it is in the sidebar straight away');

// It takes items: add one there from New item.
await p.keyboard.press('Escape');
await p.locator('body').click({ position: { x: 600, y: 5 } });
await p.getByRole('button', { name: 'Add an item' }).click();
await p.getByPlaceholder(/Chase Derek/).fill('Order seed potatoes');
const opt = await p.locator('#add-section option', { hasText: 'General' }).last().getAttribute('value');
await p.locator('#add-section').selectOption(opt);
await p.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
await p.waitForTimeout(400);

// ── delete a project: items must go somewhere first ────────────────
await p.locator('.index__stream', { hasText: 'Allotment' }).click();
await p.waitForTimeout(400);
ok((await p.locator('.task', { hasText: 'Order seed potatoes' }).count()) === 1, 'the new project holds items');
await p.goBack();
await p.waitForSelector('.org__project');
await allot.getByRole('button', { name: 'Delete' }).first().click();
const go = allot.getByRole('button', { name: 'Move and delete' });
ok(await go.isDisabled(), 'a project with items will not go until they have somewhere to be');
await allot.locator('.org__dest').selectOption('per-home');
await go.click();
await p.waitForTimeout(300);
ok((await p.locator('input[value="Allotment"]').count()) === 0, 'then the project is deleted');
ok((await p.locator('.index__stream', { hasText: 'Allotment' }).count()) === 0, 'and leaves the sidebar');
await p.locator('.index__stream', { hasText: 'Personal' }).click();
await p.waitForTimeout(400);
ok((await p.locator('.task', { hasText: 'Order seed potatoes' }).count()) === 1, 'its item lives on where it was sent');

// ── realm and order of projects ────────────────────────────────────
await p.goBack();
await p.waitForSelector('.org__project');
await project('career').getByRole('button', { name: 'Work' }).click();
await p.waitForTimeout(200);
ok((await realm('Work').locator('.org__project[data-project="career"]').count()) === 1,
  'a project can switch lives');

// Order is kept within a life: with ISODP moved into Personal, its
// position sits among the work projects, and "up" must still pass the
// project shown above it rather than one hidden in the other list.
await project('isodp').getByRole('button', { name: 'Personal' }).click();
await p.waitForTimeout(200);
const personal = () => realm('Personal').locator('.org__project')
  .evaluateAll((els) => els.map((e) => e.dataset.project));
ok((await personal()).join() === 'isodp,per', `ISODP now heads the Personal list (${(await personal()).join()})`);
await p.getByRole('button', { name: 'Move Personal up' }).click();
await p.waitForTimeout(200);
ok((await personal()).join() === 'per,isodp', `one press moves a project past the one shown above it (${(await personal()).join()})`);

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow (${over}px)`);

// A meeting comes in from its own button at a desk.
await p.getByRole('button', { name: 'Bring in a meeting' }).click();
await p.waitForTimeout(400);
ok(new URL(p.url()).pathname === '/intake', 'the Meeting button opens Intake');

// Settings links here too.
await p.goto(`${base}/settings`, { waitUntil: 'networkidle' });
ok((await p.getByRole('link', { name: 'Organise projects' }).count()) === 1, 'Settings links to Organise');

// ── on a phone ─────────────────────────────────────────────────────
const phone = await (await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 })).newPage();
await phone.goto(`${base}/projects/organise`, { waitUntil: 'networkidle' });
await phone.waitForTimeout(600);
const pover = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(pover === 0, `Organise fits a phone (${pover}px)`);
await phone.screenshot({ path: `${out}/phone-organise.png` });

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll organise checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
