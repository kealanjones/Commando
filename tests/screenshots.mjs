import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--headless=new','--no-sandbox'] });
const out = '/tmp/claude-0/-home-user-Commando/55cd7d66-6986-5bab-a214-9d42a2d3da06/scratchpad';
const errs = [];

async function shot(name, w, h, path='/') {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type()==='error') errs.push(`${name}: ${m.text()}`); });
  p.on('pageerror', e => errs.push(`${name}: PAGEERROR ${e.message}`));
  await p.goto('http://127.0.0.1:4173' + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  // horizontal overflow check
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`${name} (${w}px) overflow-x: ${over}px`);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  await ctx.close();
}

await shot('phone-today', 375, 812, '/');
await shot('phone-streams', 375, 812, '/streams');
await shot('phone-periphery', 375, 812, '/periphery');
await shot('desktop-today', 1280, 900, '/');
await shot('desktop-streams', 1280, 900, '/streams/isodp');

console.log(errs.length ? '\nCONSOLE ERRORS:\n' + errs.join('\n') : '\nno console errors');
await b.close();
