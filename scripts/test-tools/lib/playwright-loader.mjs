import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);

const candidates = [
  process.env.PLAYWRIGHT_PACKAGE,
  'playwright',
  process.env.CODEX_NODE_MODULES ? join(process.env.CODEX_NODE_MODULES, 'playwright') : null,
  'C:\\Users\\koray\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright',
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
