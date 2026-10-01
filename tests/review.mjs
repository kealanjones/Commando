/** The decision surface: the Review tab, the weekly deck, and per-person. */
import { launch, out } from './browser.mjs';

const b = await launch();
const fail = [];
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail.push(m); };

const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
p.on('pageerror', (e) => fail.push('PAGEERROR ' + e.message));

await p.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await p.waitForTimeout(900);

// Today is the list and nothing else: the review lives on its own tab.
ok((await p.locator('.prompt').count()) === 0, 'Today carries no prompts above the list');

await p.getByRole('link', { name: 'Review' }).click();
await p.waitForTimeout(600);
const hub = p.locator('.hub', { hasText: 'Weekly review' });
ok(await hub.isVisible(), 'the Review tab offers the weekly review');
const hubText = (await hub.textContent()) ?? '';
ok(/no finish line/.test(hubText), `and names why (${hubText.replace(/\s+/g, ' ').slice(0, 80).trim()})`);
ok(await p.locator('.hub', { hasText: 'Plan' }).isVisible(), 'beside the plan');
await p.screenshot({ path: `${out}/phone-review-hub.png` });

await hub.click();
await p.waitForSelector('.rv__card');
await p.waitForTimeout(400);
ok(await p.locator('.rv__badge').isVisible(), 'each card states its reason');
const count = (await p.locator('.rv__count').textContent()) ?? '';
ok(/1 of \d/.test(count), `progress is shown (${count})`);
await p.screenshot({ path: `${out}/phone-review.png` });

const firstTitle = ((await p.locator('.rv__title').textContent()) ?? '').trim();
ok((await p.getByRole('button', { name: /Just watch|Not clear/ }).count()) === 0,
  'there is no watch or park option: date it, finish it, drop it or leave it');
await p.locator('.rv__act', { hasText: /^Done$/ }).click();
await p.waitForTimeout(700);
ok(((await p.locator('.rv__title').textContent()) ?? '').trim() !== firstTitle, 'deciding advances to the next card');
ok(/2 of/.test((await p.locator('.rv__count').textContent()) ?? ''), 'progress advances');
ok(await p.locator('.toast', { hasText: 'Done.' }).isVisible(), 'the decision is confirmed and undoable');

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

await p.locator('.rv__done').getByRole('button', { name: 'Done' }).click();
await p.waitForTimeout(700);
ok(p.url().endsWith('/review'), 'finishing returns to the Review tab');

await p.getByRole('link', { name: 'People' }).click();
await p.waitForTimeout(800);
const persons = await p.locator('.person').count();
ok(persons > 5, `people are listed by what they owe (${persons})`);
const top = ((await p.locator('.person').first().textContent()) ?? '').replace(/\s+/g, ' ');
ok(/Anthony/.test(top), `the busiest person is first (${top.slice(0, 55).trim()})`);
await p.screenshot({ path: `${out}/phone-people.png` });

await p.locator('.person').first().click();
await p.waitForTimeout(600);
ok((await p.locator('.task').count()) > 5, 'a person opens on everything that names them');
ok(await p.getByRole('link', { name: 'Brief' }).isVisible(), 'with a brief one tap away');
await p.getByRole('link', { name: 'Go through them' }).click();
await p.waitForSelector('.rv__card');
await p.waitForTimeout(400);
ok(await p.getByRole('button', { name: /chased them/ }).isVisible(), 'a person deck offers chasing, not just doing');
await p.screenshot({ path: `${out}/phone-person.png` });

for (const path of ['/', '/streams', '/streams/isodp', '/review', '/review/plan', '/people', '/brief']) {
  await p.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over === 0, `${path} does not overflow at 375px (${over}px)`);
}

console.log(fail.length ? `\n${fail.length} FAILING:\n- ` + fail.join('\n- ') : '\nAll review checks passed');
await b.close();
process.exit(fail.length ? 1 : 0);
