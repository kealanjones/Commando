/**
 * Shared setup for the browser tests, so they run the same on a laptop, in
 * a cloud sandbox and in CI.
 *
 * Chromium: a pre-installed browser is used when one is there (sandboxes
 * that ship one at /opt/pw-browsers), otherwise Playwright's own — which is
 * what `npx playwright install chromium` gives CI.
 *
 * Screenshots go to SHOTS_DIR, or a folder under the system temp dir.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const preinstalled = '/opt/pw-browsers/chromium';

export const out = process.env.SHOTS_DIR ?? path.join(os.tmpdir(), 'register-shots');
fs.mkdirSync(out, { recursive: true });

export function launch() {
  return chromium.launch({
    ...(fs.existsSync(preinstalled) ? { executablePath: preinstalled } : {}),
    args: ['--headless=new', '--no-sandbox'],
  });
}
