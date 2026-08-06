import { chromium } from './lib/playwright-loader.mjs';

const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { mkdirSync } = await import('node:fs');
const IG_ARTIFACTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');
mkdirSync(IG_ARTIFACTS_DIR, { recursive: true });

const IG_OK = { source:'instagram-graph-api', league:'super-lig', hashtags:['superlig'], updatedAt:new Date().toISOString(),
  items:[
    { id:'p1', source:{kind:'hashtag',value:'superlig'}, permalink:'https://instagram.com/p/1', caption:'Derbi Ã¶ncesi son antrenman tamamlandÄ±. Kadro yarÄ±n aÃ§Ä±klanacak.', mediaType:'IMAGE', preview:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzJhNGE3ZiIvPjwvc3ZnPg==', isVideo:false, username:'club', timestamp:new Date(Date.now()-3600e3).toISOString(), likeCount:1240, commentsCount:86 },
    { id:'p2', source:{kind:'hashtag',value:'galatasaray'}, permalink:'https://instagram.com/p/2', caption:'Taraftar koreografisi tribÃ¼nden bÃ¶yle gÃ¶rÃ¼ntÃ¼lendi.', mediaType:'VIDEO', preview:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzdmMmEyYSIvPjwvc3ZnPg==', isVideo:true, username:'fan', timestamp:new Date(Date.now()-7200e3).toISOString(), likeCount:530, commentsCount:24 },
    { id:'own1', source:{kind:'account',value:'xyzskor'}, permalink:'https://instagram.com/p/own', caption:'HaftanÄ±n en iyi 5 kurtarÄ±ÅŸÄ± XYZ TV\'de.', mediaType:'IMAGE', preview:'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgZmlsbD0iIzFmNmY0YSIvPjwvc3ZnPg==', isVideo:false, username:'xyzskor', timestamp:new Date(Date.now()-1800e3).toISOString(), likeCount:310, commentsCount:12 }
  ], errors:[] };

async function run(label, igMode){
  const b = await chromium.launch({args:['--no-sandbox']});
  const ctx = await b.newContext({viewport:{width:1440,height:1000}});
  const page = await ctx.newPage();
  const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,180)));
  await page.route('**/api/**', r=>{
    const u=r.request().url();
    const json=(x,s=200)=>r.fulfill({status:s,contentType:'application/json',body:JSON.stringify(x)});
    if(u.includes('/api/social/instagram')){
      if(igMode==='ok') return json(IG_OK);
      if(igMode==='unconfigured') return json({error:'instagram_not_configured',required:['INSTAGRAM_ACCESS_TOKEN','INSTAGRAM_BUSINESS_ACCOUNT_ID']},503);
      return json({error:'instagram_upstream_unavailable'},502);
    }
    return json({error:'sportmonks_not_configured'},503);
  });
  await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(2600);
  const res = await page.evaluate(()=>({
    cards: document.querySelectorAll('.instagram-card').length,
    state: document.querySelector('.instagram-state')?.getAttribute('data-state')||null,
    stateText: (document.querySelector('.instagram-state strong')?.textContent||'').trim().slice(0,70),
    status: (document.getElementById('instagramFeedStatus')?.textContent||'').trim(),
    statusState: document.getElementById('instagramFeedStatus')?.dataset.state,
    sourceBadges: [...document.querySelectorAll('.instagram-card-source')].map(n=>n.textContent.trim()),
    videoMarks: document.querySelectorAll('.instagram-card-video').length,
  }));
  if(igMode==='ok'){
    await page.locator('#instagramDesk').scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.locator('#instagramDesk').screenshot({ path: join(IG_ARTIFACTS_DIR, 'shot-instagram.png') });
  }
  await b.close();
  console.log(`\n=== ${label} ===`); console.log(JSON.stringify(res,null,2)); console.log('pageerror:', errs.length?errs:'YOK');
}
await run('instagram-dolu','ok');
await run('instagram-yapilandirilmamis','unconfigured');
await run('instagram-hata','error');


