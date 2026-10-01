#!/usr/bin/env bash
# Re-download the self-hosted fonts and regenerate src/styles/fonts.css.
# Only needed if the type system changes. Latin subset only: the register is in English.
set -euo pipefail
cd "$(dirname "$0")/.."

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
# Ledger: Geist and Geist Mono. Notebook: Newsreader, Courier Prime, Caveat.
URL='https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Courier+Prime:wght@400;700&family=Caveat:wght@500&display=swap'

curl -sS -A "$UA" "$URL" -o /tmp/gf.css
python3 - <<'PY'
import re, subprocess, os, pathlib
css = open('/tmp/gf.css').read()
os.makedirs('public/fonts', exist_ok=True)
out = []
for subset, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
    if subset != 'latin':
        continue
    fam  = re.search(r"font-family:\s*'([^']+)'", body).group(1)
    wght = re.search(r'font-weight:\s*([\d ]+);', body).group(1).strip()
    style = re.search(r'font-style:\s*(\w+)', body).group(1)
    url  = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
    rng  = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
    name = f"{fam.lower().replace(' ', '-')}-{wght.replace(' ', '-')}{'-italic' if style == 'italic' else ''}.woff2"
    subprocess.run(['curl', '-sSL', url, '-o', f'public/fonts/{name}'], check=True)
    out.append(f"""@font-face {{
  font-family: '{fam}';
  font-style: {style};
  font-weight: {wght};
  font-display: swap;
  src: url('/fonts/{name}') format('woff2');
  unicode-range: {rng};
}}""")
pathlib.Path('src/styles/fonts.css').write_text(
  "/* Self-hosted. No third-party request at runtime, works with no signal on\n"
  "   first load, and lets the CSP forbid external font hosts outright.\n"
  "   Regenerate with scripts/fetch-fonts.sh. */\n\n" + "\n\n".join(out) + "\n")
print(f'{len(out)} faces written')
PY

# Variable fonts come back as one file per weight with identical bytes.
# Keep one copy and point every weight at it.
python3 - <<'PY'
import hashlib, os
d = 'public/fonts'; seen = {}
css = open('src/styles/fonts.css').read()
for f in sorted(os.listdir(d)):
    h = hashlib.md5(open(f'{d}/{f}', 'rb').read()).hexdigest()
    if h in seen:
        css = css.replace(f'/fonts/{f}', f'/fonts/{seen[h]}')
        os.remove(f'{d}/{f}')
    else:
        seen[h] = f
open('src/styles/fonts.css', 'w').write(css)
PY
