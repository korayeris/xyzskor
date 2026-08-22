import { launchChromium } from './lib/playwright-loader.mjs';

const b = await launchChromium();
for (const vp of [{n:'desktop',w:1440,h:900},{n:'mobil',w:390,h:844}]) {
  const ctx = await b.newContext({viewport:{width:vp.w,height:vp.h}});
  const page = await ctx.newPage();
  const errs=[], cerrs=[];
  page.on('pageerror',e=>errs.push(String(e).slice(0,200)));
  page.on('console',m=>{ if(m.type()==='error' && !m.text().includes('Failed to load resource')) cerrs.push(m.text().slice(0,160)); });
  await page.route('**/api/**', r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"sportmonks_not_configured"}'}));
  await page.route(/(jsdelivr|unpkg|fonts\.g|wikimedia|fotmob|mythos\.cards|supabase\.co|googleapis)/, r=>r.abort());
  await page.goto('http://127.0.0.1:4180',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3000);

  // Inline onclick'ler minify sonrasi hala calisiyor mu? (kritik test)
  const before = await page.evaluate(()=>document.querySelector('.tabpage.active')?.id);
  await page.click('#tabBtnPredict').catch(()=>{});
  await page.waitForTimeout(700);
  const afterPredict = await page.evaluate(()=>document.querySelector('.tabpage.active')?.id);
  await page.click('#tabBtnFootball').catch(()=>{});
  await page.waitForTimeout(500);
  const backFootball = await page.evaluate(()=>document.querySelector('.tabpage.active')?.id);

  // Futbol alt sekmesi (openFootballSection inline onclick)
  await page.click('[data-football-route="standings"]').catch(()=>{});
  await page.waitForTimeout(700);
  const standingsOpen = await page.evaluate(()=>!!document.querySelector('.standings-archive-banner') || !!document.getElementById('historicStandingsTable')?.children.length);

  // Chat paneli acilabiliyor mu?
  await page.click('#chatLauncher').catch(()=>{});
  await page.waitForTimeout(900);
  const chatOpen = await page.evaluate(()=>document.getElementById('chatPanel')?.classList.contains('open'));
  await page.click('#chatCloseBtn').catch(()=>{});

  const state = await page.evaluate(()=>({
    skeletons: document.querySelectorAll('.skeleton').length,
    empties: ['footballQuickMatches','youtubeMediaGrid','instagramFeedGrid','footballNewsStream']
      .filter(id=>{const e=document.getElementById(id); return e && e.children.length===0 && !e.textContent.trim();}),
    motion: getComputedStyle(document.documentElement).getPropertyValue('--dur-base').trim(),
    versioned: [...document.querySelectorAll('script[src],link[href]')].filter(n=>(n.src||n.href||'').includes('?v=')).length,
  }));

  console.log(`\n=== PRODUCTION BUILD Â· ${vp.n} ===`);
  console.log('  sekme: ', before, '-> predict:', afterPredict, '-> football:', backFootball);
  console.log('  puan durumu acildi:', standingsOpen);
  console.log('  chat acildi:', chatOpen);
  console.log('  surumlu asset:', state.versioned);
  console.log('  motion katmani:', state.motion);
  console.log('  bos konteyner:', state.empties.length?state.empties:'YOK');
  console.log('  pageerror:', errs.length?errs:'YOK âœ…');
  console.log('  console error:', cerrs.length?cerrs:'YOK âœ…');
  await ctx.close();
}
await b.close();

