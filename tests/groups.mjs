/** The middle level in the browser: reading it, filing into it, finding through it. */
import { chromium } from 'playwright';

const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const base = 'http://127.0.0.1:4173';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new', '--no-sandbox'] });

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

// ── reading it ──────────────────────────────────────────────────────
await p.goto(`${base}/streams/isodp`, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

const groups = await p.locator('.groupblock__head h3').allTextContents();
ok(groups.includes('Sponsorship') && groups.includes('Finance'),
  `ISODP reads as areas, not a flat list (${groups.join(', ')})`);
ok(groups.length <= 6, `and there are few enough of them to take in (${groups.length})`);
await p.screenshot({ path: `${out}/phone-groups.png` });

const first = p.locator('.groupblock').first();
ok(/\d+ in \d+ sections?/.test((await first.locator('.groupblock__meta').textContent()) ?? ''),
  'each area says how much is in it and how far it spreads');

const inside = await first.locator('.sectionblock__head h3').allTextContents();
ok(inside.length >= 2, `sections sit inside their area (${inside.slice(0, 3).join(', ')})`);
ok(!inside.some((t) => t.includes('—')),
  'and no longer spell their parent out in their own name');

// The area collapses as one, taking its sections with it.
const before = await p.locator('.sectionblock').count();
await first.locator('.groupblock__head').click();
await p.waitForTimeout(500);
ok((await first.locator('.groupblock__head').getAttribute('aria-expanded')) === 'false',
  'an area collapses');
const shrunk = await p.evaluate(() => {
  const body = document.querySelector('.groupblock .collapse');
  return body.getBoundingClientRect().height < 8;
});
ok(shrunk, 'and takes its sections down with it');
await first.locator('.groupblock__head').click();
await p.waitForTimeout(500);
ok((await p.locator('.sectionblock').count()) === before, 'opening it brings them back');

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow at 375px (${over}px)`);

// A stream with few sections is left flat rather than given empty headings.
await p.goto(`${base}/streams/cttl`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
ok((await p.locator('.groupblock').count()) === 0,
  'a small stream keeps no middle level it does not need');
ok((await p.locator('.sectionblock').count()) > 0, 'its sections still show');

// ── filing into it ──────────────────────────────────────────────────
await p.goto(`${base}/streams/isodp`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.locator('.rowbtn').first().click();
await p.waitForSelector('#sheet-section');
const options = await p.locator('#sheet-section option').allTextContents();
ok(options.some((o) => o.includes('›')), `the picker carries the area (${options.find((o) => o.includes('›'))})`);
ok(!options.some((o) => o.trim() === 'Sponsorship'),
  'and an area itself is never offered as somewhere to put a task');
ok(options.includes('Website'), 'a section with no area is offered plainly');
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// ── finding through it ──────────────────────────────────────────────
await p.keyboard.press('/');
await p.waitForSelector('.find__input');
await p.locator('.find__input').fill('OrganOx');
await p.waitForTimeout(500);
const metas = await p.locator('.find__meta').allTextContents();
ok(metas.some((m) => m.includes('›')),
  `a result says which area it came from (${metas.find((m) => m.includes('›')) ?? metas[0]})`);
await p.screenshot({ path: `${out}/phone-groupsearch.png` });

// ── the web leaves the headings out ─────────────────────────────────
await p.keyboard.press('Escape');
await p.goto(`${base}/web`, { waitUntil: 'networkidle' });
await p.waitForTimeout(3000);
const tally = (await p.locator('.web__caption, .shead__meta').first().textContent()) ?? '';
const count = Number((await p.locator('.shead__meta').first().textContent() ?? '').replace(/\D.*/, ''));
ok(count === 33, `the map still draws 33 sections, not 40 with seven empty ones (${count})`);
ok(tally.length > 0, 'and still has something to say about them');

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll grouping checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
