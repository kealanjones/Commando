/** Smart grouping: suggested, edited, accepted or turned down. */
import { chromium } from 'playwright';

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

// the prompt lives where structure lives
await p.goto('http://127.0.0.1:4173/streams', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);
const prompt = p.locator('.prompt').first();
ok(await prompt.isVisible(), 'Streams offers the threads it has spotted');
ok(/possible thread/.test((await prompt.textContent()) ?? ''), 'and names a few');

await prompt.getByRole('link', { name: 'Take a look' }).click();
await p.waitForSelector('.prop');
await p.waitForTimeout(400);

const props = await p.locator('.prop').count();
ok(props > 0 && props <= 6, `proposals are offered, capped (${props})`);
await p.screenshot({ path: `${out}/phone-threads.png` });

const first = p.locator('.prop').first();
const name = await first.locator('.prop__name').inputValue();
ok(name.length > 0, `each proposal arrives named (${name})`);

// every item is listed, with where it is filed, and pre-selected
const items = await first.locator('.prop__item').count();
ok(items >= 3, `it lists what it would gather (${items})`);
ok((await first.locator('.prop__item .check:checked').count()) === items, 'all pre-selected');
ok(await first.locator('.prop__item i').first().isVisible(), 'each item shows its section');
ok(/across|sections/.test((await first.locator('.prop__why').textContent()) ?? ''), 'it explains why these are together');

// the whole point: pulling one out before agreeing
const before = Number((await first.getByRole('button', { name: /Group these/ }).textContent() ?? '').replace(/\D/g, ''));
await first.locator('.prop__item label').first().click();
await p.waitForTimeout(250);
const after = Number((await first.getByRole('button', { name: /Group these/ }).textContent() ?? '').replace(/\D/g, ''));
ok(after === before - 1, `unticking removes it from the group (${before} → ${after})`);
ok((await first.locator('.prop__item--out').count()) === 1, 'and the row shows as dropped');
await first.locator('.prop__item label').first().click();
await p.waitForTimeout(250);
ok(Number((await first.getByRole('button', { name: /Group these/ }).textContent() ?? '').replace(/\D/g, '')) === before,
  'and ticking puts it back');

// rename, then accept
await first.locator('.prop__name').fill('Everything Dale owes me');
await p.waitForTimeout(150);
await first.getByRole('button', { name: /Group these/ }).click();
await p.waitForTimeout(800);
ok(await p.locator('.toast', { hasText: 'kept' }).isVisible(), 'accepting confirms');
ok((await p.locator('.thread').count()) === 1, 'the thread is kept and listed');
ok(/Everything Dale owes me/.test((await p.locator('.thread').first().textContent()) ?? ''),
  'under the name you gave it');

// Turning one down removes that one for good. The count may hold steady:
// as items get grouped, fresh strands surface to fill the gap, which is the
// system working rather than the dismissal failing.
const doomed = await p.locator('.prop').first().locator('.prop__name').inputValue();
await p.locator('.prop').first().getByRole('button', { name: 'Not a thread' }).click();
await p.waitForTimeout(700);
const names = await p.locator('.prop__name').evaluateAll((els) => els.map((e) => e.value));
ok(!names.includes(doomed), `the dismissed proposal is gone (${doomed})`);
ok(/not be suggested again/.test((await p.locator('.toast').textContent()) ?? ''), 'and says it will not return');

// grouped items are not offered again, and wear their thread
await p.getByRole('link', { name: 'Streams' }).click();
await p.waitForTimeout(900);
ok((await p.locator('.threadchip').count()) > 0, 'grouped tasks show which thread they are in');

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow at 375px (${over}px)`);

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll grouping checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
