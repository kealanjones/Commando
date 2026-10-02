/** Two levels in the browser: a project, its sub-focuses, and the tags items kept (0011). */
import { launch, out } from './browser.mjs';

const base = 'http://127.0.0.1:4173';
const b = await launch();

const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

// ── reading it ──────────────────────────────────────────────────────
await p.goto(`${base}/projects/isodp`, { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

const focuses = await p.locator('.sectionblock__head h3').allTextContents();
ok(focuses.includes('Sponsorship') && focuses.includes('Finance'),
  `ISODP reads as its sub-focuses (${focuses.join(', ')})`);
ok(focuses.length <= 6, `few enough to take in (${focuses.length})`);
ok((await p.locator('.groupblock').count()) === 0, 'and there is no third level any more');
ok(!focuses.includes('OrganOx'), 'a folded section is not a sub-focus of its own');
await p.screenshot({ path: `${out}/phone-focuses.png` });

const tags = await p.locator('.task__tag').allTextContents();
ok(tags.some((t) => /organox/i.test(t)), `items keep the old section as a tag (${[...new Set(tags)].slice(0, 3).join(', ')})`);

const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(over === 0, `no sideways overflow at 375px (${over}px)`);

// An old link still lands.
await p.goto(`${base}/streams/cttl`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
ok(new URL(p.url()).pathname === '/projects/cttl', `an old /streams link lands on its project (${new URL(p.url()).pathname})`);

// ── filing into it ──────────────────────────────────────────────────
await p.goto(`${base}/projects/isodp`, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
await p.locator('.task__open').first().click();
await p.waitForSelector('#sheet-section');
const options = await p.locator('#sheet-section option').allTextContents();
ok(options.includes('Sponsorship'), 'the picker offers a sub-focus by its plain name');
ok(!options.some((o) => o.includes('›')), 'with no area spelled out in front of it');
ok(!options.includes('OrganOx'), 'and no folded section');
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

// ── finding through it ──────────────────────────────────────────────
await p.keyboard.press('/');
await p.waitForSelector('.find__input');
await p.locator('.find__input').fill('OrganOx');
await p.waitForTimeout(500);
const metas = await p.locator('.find__meta').allTextContents();
ok(metas.some((m) => /Sponsorship · OrganOx/.test(m)),
  `a result says its sub-focus and its tag (${metas[0]})`);

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll two-level checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
