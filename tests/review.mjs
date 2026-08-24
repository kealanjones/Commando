/** The decision surface: weekly review, unclear pile, and per-person. */
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

const prompt = p.locator('.prompt').first();
ok(await prompt.isVisible(), 'Today offers the review when decisions are waiting');
const promptText = (await prompt.textContent()) ?? '';
ok(/no finish line/.test(promptText), `the prompt names why (${promptText.replace(/\s+/g, ' ').slice(0, 80).trim()})`);
await p.screenshot({ path: `${out}/phone-today-prompt.png` });

await prompt.getByRole('link', { name: 'Start' }).click();
await p.waitForSelector('.rv__card');
await p.waitForTimeout(400);
ok(await p.locator('.rv__badge').isVisible(), 'each card states its reason');
const count = (await p.locator('.rv__count').textContent()) ?? '';
ok(/1 of \d/.test(count), `progress is shown (${count})`);
await p.screenshot({ path: `${out}/phone-review.png` });

const firstTitle = ((await p.locator('.rv__title').textContent()) ?? '').trim();
await p.getByRole('button', { name: 'Just watch it' }).click();
await p.waitForTimeout(700);
ok(((await p.locator('.rv__title').textContent()) ?? '').trim() !== firstTitle, 'deciding advances to the next card');
ok(/2 of/.test((await p.locator('.rv__count').textContent()) ?? ''), 'progress advances');
ok(await p.locator('.toast', { hasText: 'periphery' }).isVisible(), 'the decision is confirmed and undoable');

await p.locator('.toast button', { hasText: 'Undo' }).click();
await p.waitForTimeout(600);
ok(((await p.locator('.rv__title').textContent()) ?? '').trim() === firstTitle, 'undo returns the card');

await p.getByRole('button', { name: 'Give it a date' }).click();
await p.waitForTimeout(300);
ok(await p.getByRole('button', { name: 'Friday' }).isVisible(), 'quick dates are offered');
await p.getByRole('button', { name: 'Friday' }).click();
await p.waitForTimeout(700);
ok(/of \d/.test((await p.locator('.rv__count').textContent()) ?? ''), 'dating advances the deck');

for (let i = 0; i < 12; i++) {
  if (await p.locator('.rv__done').count()) break;
  const drop = p.getByRole('button', { name: 'Drop it' });
  if (!(await drop.count())) break;
  await drop.click();
  await p.waitForTimeout(420);
}
ok(await p.locator('.rv__done').isVisible(), 'the deck ends in a summary');
const summary = ((await p.locator('.rv__done').textContent()) ?? '').replace(/\s+/g, ' ');
ok(/lighter/.test(summary), `the summary reports what changed (${summary.match(/.{0,32}lighter/)?.[0]?.trim()})`);
await p.screenshot({ path: `${out}/phone-review-done.png` });

await p.getByRole('button', { name: 'Back to Today' }).click();
await p.waitForTimeout(700);

await p.getByRole('link', { name: 'People' }).click();
await p.waitForTimeout(800);
const persons = await p.locator('.person').count();
ok(persons > 5, `people are listed by what they owe (${persons})`);
const top = ((await p.locator('.person').first().textContent()) ?? '').replace(/\s+/g, ' ');
ok(/Anthony/.test(top), `the busiest person is first (${top.slice(0, 55).trim()})`);
await p.screenshot({ path: `${out}/phone-people.png` });

await p.locator('.person').first().click();
await p.waitForSelector('.rv__card');
await p.waitForTimeout(400);
ok(await p.getByRole('button', { name: /chased them/ }).isVisible(), 'a person deck offers chasing, not just doing');
await p.screenshot({ path: `${out}/phone-person.png` });

for (const path of ['/', '/review', '/people']) {
  await p.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over === 0, `${path} does not overflow at 375px (${over}px)`);
}

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll review checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
