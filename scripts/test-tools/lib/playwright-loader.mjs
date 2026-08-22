import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);

const candidates = [
  process.env.PLAYWRIGHT_PACKAGE,
  'playwright',
].filter(Boolean);

let lastError;

for (const candidate of candidates) {
  try {
    if (candidate.includes('\\') || candidate.includes('/')) {
      if (!existsSync(candidate)) continue;
    }
    const playwright = require(candidate);
    exportLoaded(playwright);
    break;
  } catch (error) {
    lastError = error;
  }
}

function exportLoaded(playwright) {
  globalThis.__XYZSKOR_PLAYWRIGHT__ = playwright;
}

if (!globalThis.__XYZSKOR_PLAYWRIGHT__) {
  console.error('Playwright bulunamadı. Yerelde kurulum: npm i -D playwright');
  if (lastError) console.error(lastError.message);
  process.exit(1);
}

export const { chromium } = globalThis.__XYZSKOR_PLAYWRIGHT__;

// 2026-08-21: Chromium indirmesi olmayan/farkli surumde olan ortamlar icin
// (CI, bulut sandbox) acik executablePath destegi. XYZSKOR_CHROMIUM_PATH veya
// PLAYWRIGHT_CHROMIUM_EXECUTABLE tanimliysa o ikili kullanilir.
export async function launchChromium(options = {}) {
  const explicit = process.env.XYZSKOR_CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  const args = ['--no-sandbox', '--disable-dev-shm-usage', ...(options.args || [])];
  try {
    return await chromium.launch({ ...options, args, ...(explicit ? { executablePath: explicit } : {}) });
  } catch (error) {
    if (explicit) throw error;
    // Playwright'in bekledigi surum kurulmamis olabilir; sistemdeki chromium'u dene.
    const candidates = [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    ];
    const { existsSync } = await import('node:fs');
    const found = candidates.find((p) => existsSync(p));
    if (!found) throw error;
    console.log(`[playwright-loader] Playwright ikilisi bulunamadi, sistem Chromium kullaniliyor: ${found}`);
    return chromium.launch({ ...options, args, executablePath: found });
  }
}
