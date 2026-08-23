#!/usr/bin/env bash
# Re-download the self-hosted fonts and regenerate src/styles/fonts.css.
# Only needed if the type system changes. Latin and latin-ext subsets only.
set -euo pipefail
cd "$(dirname "$0")/.."

UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
URL='https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap'

curl -sS -A "$UA" "$URL" -o /tmp/gf.css
python3 - <<'PY'
import re, subprocess, os, pathlib
css = open('/tmp/gf.css').read()
os.makedirs('public/fonts', exist_ok=True)
out = []
for subset, body in re.findall(r'/\*\s*([\w-]+)\s*\*/\s*@font-face\s*\{(.*?)\}', css, re.S):
    if subset not in ('latin', 'latin-ext'):
        continue
    fam  = re.search(r"font-family:\s*'([^']+)'", body).group(1)
    wght = re.search(r'font-weight:\s*(\d+)', body).group(1)
    url  = re.search(r'url\((https://[^)]+\.woff2)\)', body).group(1)
    rng  = re.search(r'unicode-range:\s*([^;]+);', body).group(1).strip()
    name = f"{fam.lower().replace(' ', '-')}-{wght}-{subset}.woff2"
    subprocess.run(['curl', '-sSL', url, '-o', f'public/fonts/{name}'], check=True)
    out.append(f"""@font-face {{
  font-family: '{fam}';
  font-style: normal;
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
