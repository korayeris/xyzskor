// Chat panelinin tarayÄ±cÄ±da davranÄ±ÅŸ + gÃ¶rsel doÄŸrulamasÄ±.
// Supabase sandbox'ta eriÅŸilemediÄŸi iÃ§in fallback istemci devrede olacak;
// bu tam da "servis yok" senaryosunun testidir. AyrÄ±ca sahte bir Supabase
// istemcisi enjekte ederek "servis var" senaryosu da test edilir.

const { dirname, join } = await import('node:path');
const { fileURLToPath } = await import('node:url');
const { mkdirSync } = await import('node:fs');
import { chromium } from './lib/playwright-loader.mjs';
const screenshotsDir = join(dirname(fileURLToPath(import.meta.url)), 'artifacts');
mkdirSync(screenshotsDir, { recursive: true });

const BASE = 'http://127.0.0.1:4173';

// GerÃ§ek supabase-js yerine, chat.js'in kullandÄ±ÄŸÄ± yÃ¼zeyi taklit eden sahte
// istemci. BÃ¶ylece odalar/mesajlar dolu haldeki arayÃ¼z de gÃ¶rÃ¼lebilir.
const FAKE_SUPABASE = `
window.supabase = {
  createClient(){
    const rooms = [
      { id:'r1', slug:'genel-gundem', title:'Genel GÃ¼ndem', topic:'TÃ¼rkiye ve Avrupa futbol gÃ¼ndemi', kind:'general', league_key:null, is_locked:false, min_account_state:'verified', sort_order:10 },
      { id:'r2', slug:'super-lig', title:'SÃ¼per Lig', topic:'SÃ¼per Lig haftasÄ±, maÃ§lar ve tartÄ±ÅŸmalar', kind:'league', league_key:'super-lig', is_locked:false, min_account_state:'verified', sort_order:20 },
      { id:'r3', slug:'champions-league', title:'Åampiyonlar Ligi', topic:'UCL geceleri', kind:'league', league_key:'champions-league', is_locked:false, min_account_state:'verified', sort_order:30 },
      { id:'r4', slug:'transfer', title:'Transfer GÃ¼ndemi', topic:'ResmÃ® transferler ve iddialar', kind:'general', league_key:null, is_locked:true, min_account_state:'verified', sort_order:70 }
    ];
    const now = Date.now();
    const messages = [
      { id:'m1', room_id:'r2', user_id:'u9', body:'Derbi kadrosu aÃ§Ä±klandÄ±, orta sahada rotasyon var.', author_name:'AhmetK', author_team:'Galatasaray', author_verified:true, deleted_at:null, report_count:0, created_at:new Date(now-720000).toISOString() },
      { id:'m2', room_id:'r2', user_id:'u8', body:'Savunma hattÄ± bu sezon Ã§ok daha dengeli duruyor.', author_name:'MerveY', author_team:'FenerbahÃ§e', author_verified:true, deleted_at:null, report_count:0, created_at:new Date(now-420000).toISOString() },
      { id:'m3', room_id:'r2', user_id:'u7', body:'Bu mesaj kaldÄ±rÄ±ldÄ± Ã¶rneÄŸi', author_name:'Spam', author_team:'DiÄŸer', author_verified:false, deleted_at:new Date(now-300000).toISOString(), deleted_reason:'auto_hidden_report_threshold', report_count:4, created_at:new Date(now-360000).toISOString() },
      { id:'m4', room_id:'r2', user_id:'me', body:'Kanat oyuncularÄ±nÄ±n hÄ±z avantajÄ± bence belirleyici olacak.', author_name:'Emre', author_team:'BeÅŸiktaÅŸ', author_verified:true, deleted_at:null, report_count:0, created_at:new Date(now-90000).toISOString() },
      { id:'m5', room_id:'r2', user_id:'u6', body:'Hakem kararlarÄ± sonrasÄ± maÃ§Ä±n ritmi tamamen deÄŸiÅŸti.', author_name:'CanT', author_team:'Trabzonspor', author_verified:false, deleted_at:null, report_count:0, created_at:new Date(now-30000).toISOString() }
    ];
    const build = (rows) => {
      const api = {
        select(){ return api; }, eq(){ return api; }, order(){ return api; },
        limit(){ return api; }, maybeSingle(){ return Promise.resolve({ data:null, error:null }); },
        single(){ return Promise.resolve({ data:rows[0]||null, error:null }); },
        insert(){ return api; },
        then(res){ return Promise.resolve({ data:rows, error:null }).then(res); }
      };
      return api;
    };
    return {
      from(table){ return build(table==='chat_rooms'?rooms:table==='chat_messages'?messages:[]); },
      rpc(name){ return Promise.resolve({ data: name==='is_editorial_admin' ? false : null, error:null }); },
      channel(){ const c={ on(){return c;}, subscribe(){return c;}, unsubscribe(){return Promise.resolve();} }; return c; },
      removeChannel(){ return Promise.resolve(); },
      functions:{ invoke: async()=>({data:null,error:null}) },
      auth:{
        getSession: async()=>({ data:{ session:{ user:{ id:'me', email:'emre@mythoscards.com' } } }, error:null }),
        getUser: async()=>({ data:{ user:{ id:'me' } }, error:null }),
        signOut: async()=>({ error:null }),
        onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; }
      }
    };
  }
};
`;

async function run(label, { fake, viewport, loggedIn }) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 220)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text().slice(0, 200)); });

  if (fake) await page.addInitScript(FAKE_SUPABASE);
  await page.route('**/api/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"sportmonks_not_configured"}' }));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  if (loggedIn && fake) {
    // getCurrentUser()'Ä±n dolu dÃ¶nmesi iÃ§in data.js iÃ§ state'ini taklit et.
    await page.evaluate(() => {
      window.__origGetCurrentUser = window.getCurrentUser;
      window.getCurrentUser = () => ({ id: 'me', username: 'Emre', team: 'BeÅŸiktaÅŸ', is_admin: false, email: 'emre@mythoscards.com' });
    });
  }

  const launcherVisible = await page.isVisible('#chatLauncher');
  await page.click('#chatLauncher');
  await page.waitForTimeout(1600);

  const state = await page.evaluate(() => ({
    panelOpen: document.getElementById('chatPanel')?.classList.contains('open'),
    ariaHidden: document.getElementById('chatPanel')?.getAttribute('aria-hidden'),
    roomCount: document.querySelectorAll('.chat-room-chip').length,
    activeRoom: document.querySelector('.chat-room-chip.active')?.textContent?.trim() || null,
    messageCount: document.querySelectorAll('.chat-message').length,
    deletedShown: document.querySelectorAll('.chat-message.is-deleted').length,
    verifiedBadges: document.querySelectorAll('.chat-verified').length,
    composerHTML: (document.getElementById('chatComposer')?.textContent || '').trim().slice(0, 110),
    hasTextarea: Boolean(document.getElementById('chatInput')),
    stateCard: (document.querySelector('.chat-state-card')?.textContent || '').trim().slice(0, 90),
    title: document.getElementById('chatPanelTitle')?.textContent,
  }));

  await page.screenshot({ path: join(screenshotsDir, `shot-${label}.png`), fullPage: false });

  // Oda deÄŸiÅŸtirme testi
  let roomSwitch = null;
  if (state.roomCount > 1) {
    await page.click('.chat-room-chip:nth-child(3)');
    await page.waitForTimeout(700);
    roomSwitch = await page.evaluate(() => document.querySelector('.chat-room-chip.active')?.textContent?.trim());
  }

  // Kapatma testi
  await page.click('#chatCloseBtn');
  await page.waitForTimeout(500);
  const closed = await page.evaluate(() => !document.getElementById('chatPanel')?.classList.contains('open'));

  await browser.close();
  return { label, launcherVisible, ...state, roomSwitch, closed, errors };
}

const scenarios = [
  ['supabase-yok-desktop', { fake: false, viewport: { width: 1440, height: 900 }, loggedIn: false }],
  ['dolu-desktop', { fake: true, viewport: { width: 1440, height: 900 }, loggedIn: true }],
  ['dolu-mobil', { fake: true, viewport: { width: 390, height: 844 }, loggedIn: true }],
];

for (const [label, opts] of scenarios) {
  const r = await run(label, opts);
  console.log(`\n===== ${label} =====`);
  console.log(JSON.stringify(r, null, 2));
}

