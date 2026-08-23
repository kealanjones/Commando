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

// Inline stylesheets
html = html.replace(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g, (m, href) => {
  if (href.startsWith('http')) return m;               // Google Fonts stays a link
  const css = fs.readFileSync(path.join(dist, href.replace(/^\.?\//, '')), 'utf8');
  return `<style>\n${css}\n</style>`;
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
  // Icons and manifest are not shipped with a single-file preview.
  .replace(/<link[^>]+rel="(apple-touch-icon|icon|manifest)"[^>]*>\s*/gi, '');

fs.writeFileSync(out, html);
console.log(`${out}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
