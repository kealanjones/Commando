/**
 * Renders public/icon.svg to the PNGs the manifest and iOS need.
 *
 *   node scripts/icons.mjs
 *
 * The maskable one is the same drawing at 72%, so Android's circle or
 * squircle mask never cuts the receipt off.
 */
import fs from 'node:fs';
import { launch } from '../tests/browser.mjs';

const svg = fs.readFileSync('public/icon.svg', 'utf8');
const page = (scale) => `<body style="margin:0;background:#111111;width:512px;height:512px;display:grid;place-items:center">
  <div style="width:${512 * scale}px;height:${512 * scale}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body>`;

const b = await launch();
const p = await b.newPage({ viewport: { width: 512, height: 512 } });
for (const [file, size, scale] of [
  ['public/icon-512.png', 512, 1],
  ['public/icon-192.png', 192, 1],
  ['public/apple-touch-icon.png', 180, 1],
  ['public/icon-maskable-512.png', 512, 0.72],
]) {
  await p.setContent(page(scale));
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 512, height: 512 }, scale: 'css' });
  if (size !== 512) {
    // Downscale in the browser for a clean resample.
    const data = fs.readFileSync(file).toString('base64');
    await p.setContent(`<body style="margin:0"><img src="data:image/png;base64,${data}" width="${size}" height="${size}" style="display:block"></body>`);
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size }, scale: 'css' });
  }
  console.log(file);
}
await b.close();
