/** Search: opening it, ranking, keyboard, and getting to the thing. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

// opens from the header, and from the keyboard
await p.getByRole('button', { name: 'Search the register' }).click();
await p.waitForSelector('.find');
ok(await p.evaluate(() => document.activeElement?.classList.contains('find__input')),
  'the field is focused on open');
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
ok((await p.locator('.find').count()) === 0, 'Escape closes it');

await p.keyboard.press('/');
await p.waitForSelector('.find');
ok(true, 'the / shortcut opens it');
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
await p.keyboard.press('Control+k');
await p.waitForSelector('.find');
ok(true, 'Ctrl+K opens it');

// before typing, useful jumps rather than a blank box
ok((await p.locator('.find__jumps .chip').count()) === 4, 'the empty state offers jumps');

// ranking and highlighting
await p.locator('.find__input').fill('belaal');
await p.waitForTimeout(350);
const first = await p.locator('.find__row').first().textContent();
ok(/Belaal/.test(first ?? ''), `a name finds its task (${(first ?? '').slice(0, 46).trim()})`);
ok((await p.locator('.find__row mark').first().textContent())?.toLowerCase() === 'belaal',
  'the matched run is highlighted');
await p.screenshot({ path: `${out}/phone-search.png` });

// searches beyond titles
await p.locator('.find__input').fill('emirates');
await p.waitForTimeout(350);
ok((await p.locator('.find__row').count()) > 0, 'finds a word that only appears in the seeded detail');
ok(await p.locator('.find__where').first().isVisible(), 'and shows the line it was found in');

// every term must match
await p.locator('.find__input').fill('satya flights');
await p.waitForTimeout(350);
const both = await p.locator('.find__row').count();
ok(both > 0 && both < 20, `two terms narrow rather than widen (${both})`);

await p.locator('.find__input').fill('zzzznothing');
await p.waitForTimeout(350);
ok((await p.locator('.find__row').count()) === 0, 'no matches shows nothing, not everything');
ok(/Nothing matches/.test((await p.locator('.find__hint').textContent()) ?? ''), 'and says so');

// keyboard through the results, then straight into the item
await p.locator('.find__input').fill('sponsor');
await p.waitForTimeout(350);
const target = (await p.locator('.find__row').nth(2).textContent()) ?? '';
await p.keyboard.press('ArrowDown');
await p.keyboard.press('ArrowDown');
ok(await p.locator('.find__row').nth(2).getAttribute('aria-selected') === 'true',
  'arrow keys move the selection');
await p.keyboard.press('Enter');
await p.waitForTimeout(600);
ok((await p.locator('.find').count()) === 0, 'Enter closes search');
ok(await p.locator('.sheet').isVisible(), 'and opens the item it landed on');
const title = await p.locator('#sheet-title').inputValue();
ok(target.includes(title.slice(0, 25)), `the right item opened (${title.slice(0, 40)})`);

// nothing overflows
await p.keyboard.press('Escape');
await p.waitForTimeout(300);
await p.getByRole('button', { name: 'Search the register' }).click();
await p.locator('.find__input').fill('sponsorship');
await p.waitForTimeout(400);
const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow at 375px (${over}px)`);

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll search checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
