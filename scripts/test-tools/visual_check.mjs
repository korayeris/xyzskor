// XYZSKOR gÃ¶rsel/console doÄŸrulama harness'i.
// dev-server'Ä± ayaÄŸa kaldÄ±rÄ±p Chromium ile sayfayÄ± aÃ§ar, console hatalarÄ±nÄ±,
// baÅŸarÄ±sÄ±z network isteklerini ve kritik DOM durumlarÄ±nÄ± raporlar.
// /api/* istekleri sandbox'ta engellendiÄŸi iÃ§in route interception ile
// gerÃ§ekÃ§i mock yanÄ±tlar dÃ¶ndÃ¼rÃ¼lÃ¼r â€” bÃ¶ylece "API var" ve "API yok"
// senaryolarÄ±nÄ±n ikisi de test edilebilir.

import { launchChromium } from './lib/playwright-loader.mjs';

const BASE = 'http://127.0.0.1:4173';
const MODE = process.argv[2] || 'nodata'; // 'nodata' | 'withdata'

const mockSeason = {
  source: 'sportmonks-football-api-v3', league: 'super-lig', competition: 'SÃ¼per Lig',
  updatedAt: new Date().toISOString(),
  matches: [
    { id: 'sportmonks:1', hafta: 1, ev: 'Galatasaray', konuk: 'FenerbahÃ§e', kickoff: new Date(Date.now() + 864e5).toISOString(), stadyum: 'RAMS Park', status: null, verified: true, competition: 'SÃ¼per Lig' },
    { id: 'sportmonks:2', hafta: 1, ev: 'BeÅŸiktaÅŸ', konuk: 'Trabzonspor', kickoff: new Date(Date.now() + 1728e5).toISOString(), stadyum: 'TÃ¼praÅŸ Stadyumu', status: null, verified: true, competition: 'SÃ¼per Lig' },
  ],
  results: [], standings: [], coverage: { fixtures: 2, results: 0, standings: 0 },
  errors: [],
};

const mockYouTube = {
  source: 'youtube-data-api-v3', updated_at: new Date().toISOString(),
  channels: [], items: [
    { id: 'v1', title: 'SÃ¼per Lig Ã¶zet', channelTitle: 'TRT Spor', channelHandle: '@trtspor', publishedAt: new Date().toISOString(), thumbnail: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', duration: 'PT5M', live: false, upcoming: false, url: 'https://www.youtube.com/watch?v=v1' },
  ],
};

async function main() {
  const browser = await launchChromium();
  const results = [];

  for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await ctx.newPage();

    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 220)); });
    page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));
    page.on('requestfailed', (r) => {
      const u = r.url();
      // Supabase ve harici CDN'ler sandbox aÄŸ engeli yÃ¼zÃ¼nden dÃ¼ÅŸer; bunlar beklenen.
      if (u.includes('supabase.co') || u.includes('jsdelivr') || u.includes('fonts.g') ||
          u.includes('wikimedia') || u.includes('fotmob') || u.includes('mythos.cards') ||
          u.includes('transfermarkt') || u.includes('google.com')) return;
      failedRequests.push(`${r.failure()?.errorText || 'fail'} ${u.slice(0, 110)}`);
    });

    // /api/* mock: sandbox'ta gerÃ§ek upstream yok.
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (MODE === 'nodata') {
        // Secret tanÄ±msÄ±z senaryosu: worker'Ä±n gerÃ§ek davranÄ±ÅŸÄ±.
        if (url.includes('/api/media/youtube')) return json({ error: 'youtube_not_configured', channels: [] }, 503);
        return json({ error: 'sportmonks_not_configured', provider: 'sportmonks' }, 503);
      }
      if (url.includes('/api/football/season')) return json(mockSeason);
      if (url.includes('/api/media/youtube')) return json(mockYouTube);
      if (url.includes('/api/football/live')) return json({ source: 'x', league: 'super-lig', matches: [], updatedAt: new Date().toISOString() });
      if (url.includes('/api/health')) return json({ status: 'ok', checks: { sportmonks_live: 'configured' } });
      return json({ error: 'not_mocked' }, 503);
    });

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    // Render zincirinin ve fetch'lerin oturmasÄ± iÃ§in bekle.
    await page.waitForTimeout(3500);

    const dom = await page.evaluate(() => {
      const txt = (id) => (document.getElementById(id)?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90);
      const has = (sel) => Boolean(document.querySelector(sel));
      const emptyIds = [];
      for (const id of ['footballQuickMatches', 'footballNewsStream', 'footballStandingsCompact',
        'youtubeMediaGrid', 'clubSocialStage', 'footballTransferStream', 'liveScoreList',
        'historicStandingsTable', 'footballFeaturedDevelopment']) {
        const el = document.getElementById(id);
        if (el && el.children.length === 0 && !el.textContent.trim()) emptyIds.push(id);
      }
      return {
        title: document.title,
        broadcastStatus: txt('youtubeMediaStatus'),
        broadcastState: document.getElementById('youtubeMediaStatus')?.dataset.state || null,
        seasonCard: (document.querySelector('.standings-season-card')?.textContent || '').trim().replace(/\s+/g, ' '),
        archiveBannerCount: document.querySelectorAll('.standings-archive-banner').length,
        skeletonCount: document.querySelectorAll('.skeleton').length,
        emptyContainers: emptyIds,
        hasMotionLayer: getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim(),
        deferredScripts: [...document.querySelectorAll('script[src]')].filter((s) => s.defer).length,
        visibleTabPage: document.querySelector('.tabpage.active')?.id || null,
        hasLeagueWaiting: has('.league-module-waiting'),
      };
    });

    results.push({ viewport: viewport.name, consoleErrors, pageErrors, failedRequests, dom });
    await ctx.close();
  }

  await browser.close();

  console.log(`\n################ MOD: ${MODE} ################`);
  for (const r of results) {
    console.log(`\n===== ${r.viewport.toUpperCase()} =====`);
    console.log('Sayfa hatalarÄ± (pageerror):', r.pageErrors.length ? r.pageErrors : 'YOK âœ…');
    console.log('Console error:', r.consoleErrors.length ? r.consoleErrors : 'YOK âœ…');
    console.log('BaÅŸarÄ±sÄ±z istek (beklenmeyen):', r.failedRequests.length ? r.failedRequests : 'YOK âœ…');
    console.log('DOM:', JSON.stringify(r.dom, null, 2));
  }
}

main().catch((e) => { console.error('HARNESS HATASI:', e); process.exit(1); });

