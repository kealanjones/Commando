/**
 * Fold a Vite build into one self-contained page.
 *
 * Used for the shareable preview only: inlines every script and stylesheet,
 * strips the document skeleton, and leaves the Google Fonts link (the one
 * external host an Artifact is allowed to reach).
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] ?? 'dist-artifact';
const out = process.argv[3] ?? 'preview.html';

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

/** Fonts have no /fonts path in a single file — embed them. */
function embedFonts(css) {
  return css.replace(/url\(['"]?(?:\.\.?\/)*fonts\/([^'")]+)['"]?\)/g, (m, name) => {
    const file = path.join(dist, 'fonts', name);
    if (!fs.existsSync(file)) return m;
    return `url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')})`;
  });
}

// Inline stylesheets
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (m, href) => {
  if (href.startsWith('http')) return m;
  const css = fs.readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');
  return `<style>\n${embedFonts(css)}\n</style>`;
});

// Inline module scripts. `</script>` inside a string literal would close the
// tag early, so it is broken up rather than escaped.
html = html.replace(/<script([^>]*)src="([^"]+)"([^>]*)><\/script>/g, (m, a, src, b) => {
  if (src.startsWith('http')) return m;
  const js = fs
    .readFileSync(path.join(dist, src.replace(/^\.?\//, '')), 'utf8')
    .replaceAll('</script', '<\\/script');
  const type = /type="module"/.test(a + b) ? ' type="module"' : '';
  return `<script${type}>\n${js}\n</script>`;
});

// Strip the document skeleton — the host wraps the fragment itself.
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*$/i, '')
  .replace(/<\/?head[^>]*>\s*/gi, '')
  .replace(/<\/?body[^>]*>\s*/gi, '')
  .replace(/<meta charset[^>]*>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  // Icons, manifest and font preloads have no path in a single-file preview.
  .replace(/<link[^>]+rel="(apple-touch-icon|icon|manifest|preload)"[^>]*>\s*/gi, '');

// A code-split build would leave chunk imports pointing at files that do not
// exist inside a single page. Fail here rather than shipping a blank preview.
// Chunk imports appear as siblings ("./vendor-x.js") or under assets/,
// depending on `base` — catch any relative .js import left in the page.
const dangling = [...html.matchAll(/(?:\bfrom|\bimport)\s*["'](\.{0,2}\/[^"']+\.js)["']/g)].map((m) => m[1]);
if (dangling.length) {
  console.error(
    `Unresolved chunk imports: ${[...new Set(dangling)].join(', ')}\n` +
      'Build with ARTIFACT=1 so rollup emits a single chunk.',
  );
  process.exit(1);
}
if (/(?:src|href)="(?:\.{0,2}\/)?assets\//.test(html)) {
  console.error('Unresolved asset reference left in the page.');
  process.exit(1);
}

fs.writeFileSync(out, html);
console.log(`${out}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
