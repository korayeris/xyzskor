import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = path.join(ROOT, 'assets/js/data.js');
const INDEX_PATH = path.join(ROOT, 'index.html');
const MATCHDAY_PATH = path.join(ROOT, 'assets/js/matchday-live.js');
const PREDICT_GAME_PATH = path.join(ROOT, 'assets/js/predict-game.js');
const CHAT_PATH = path.join(ROOT, 'assets/js/chat.js');
const UI_PATH = path.join(ROOT, 'assets/js/ui.js');

const dataSource = fs.readFileSync(DATA_PATH, 'utf8');
const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
const matchdaySource = fs.readFileSync(MATCHDAY_PATH, 'utf8');
const predictGameSource = fs.readFileSync(PREDICT_GAME_PATH, 'utf8');
const chatSource = fs.readFileSync(CHAT_PATH, 'utf8');
const uiSource = fs.readFileSync(UI_PATH, 'utf8');

const LOADER_END = "if(typeof window!=='undefined') window.ensureXYZSupabaseClient=ensureXYZSupabaseClient;";
const loaderEndIndex = dataSource.indexOf(LOADER_END);
assert.notEqual(loaderEndIndex, -1, 'data.js lazy Supabase loader sonu bulunamadi');
const loaderSource = dataSource.slice(0, loaderEndIndex + LOADER_END.length);

const statePrelude = `
let AUTH_SESSION_CACHE={ stale:true };
let AUTH_SESSION_READY=true;
let AUTH_CONTEXT_READY=true;
let COMMON_DATA_CACHE={ stale:true };
const SERVER_LEADERBOARDS=new Map([['stale', true]]);
const SERVER_LEADERBOARD_REQUESTS=new Map([['stale', Promise.resolve(true)]]);
let serverLeaderboardMode='server';
let legacyLeaderboardRequest={ stale:true };
let __bindAuthStateSyncCalls=0;
function bindAuthStateSync(){ __bindAuthStateSyncCalls+=1; }
`;

const stateExport = `
globalThis.__lazySupabaseHarness={
  ensureXYZSupabaseClient,
  activateSupabaseClient,
  state:()=>({
    sb,
    SUPABASE_READY,
    AUTH_SESSION_CACHE,
    AUTH_SESSION_READY,
    AUTH_CONTEXT_READY,
    COMMON_DATA_CACHE,
    leaderboardsSize:SERVER_LEADERBOARDS.size,
    leaderboardRequestsSize:SERVER_LEADERBOARD_REQUESTS.size,
    serverLeaderboardMode,
    legacyLeaderboardRequest,
    bindAuthStateSyncCalls:__bindAuthStateSyncCalls,
  }),
};
`;

function createHarness(){
  const scripts=[];
  const events=[];
  const warnings=[];
  const timers=new Map();
  let nextTimerId=1;

  const sandbox={
    console:{
      log(){},
      info(){},
      warn(...args){ warnings.push(args); },
      error(...args){ warnings.push(args); },
    },
    document:{
      createElement(tag){
        assert.equal(tag, 'script', 'lazy loader yalniz script elementi olusturmali');
        return { async:false, src:'', dataset:{}, onload:null, onerror:null };
      },
      head:{
        appendChild(script){ scripts.push(script); return script; },
      },
    },
    CustomEvent:class CustomEvent {
      constructor(type, options={}){ this.type=type; this.detail=options.detail; }
    },
    dispatchEvent(event){ events.push(event); return true; },
    setTimeout(callback, delay){
      const id=nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id){ timers.delete(id); },
  };
  sandbox.window=sandbox;
  vm.createContext(sandbox);
  new vm.Script(`${statePrelude}\n${loaderSource}\n${stateExport}`, {
    filename:'data.js#lazy-supabase-harness',
  }).runInContext(sandbox);

  return {
    sandbox,
    scripts,
    events,
    warnings,
    timers,
    api:sandbox.__lazySupabaseHarness,
    runNextTimer(){
      const next=timers.entries().next();
      assert.equal(next.done, false, 'calistirilacak bekleyen timer bulunamadi');
      const [id, timer]=next.value;
      timers.delete(id);
      timer.callback();
      return timer.delay;
    },
  };
}

function installSupabaseProvider(harness, label){
  const client={ label, auth:{ getSession:async()=>({ data:{ session:null }, error:null }) } };
  const calls=[];
  harness.sandbox.supabase={
    createClient(url, key){
      calls.push({ url, key });
      return client;
    },
  };
  return { client, calls };
}

function assertActivationReset(harness){
  const state=harness.api.state();
  assert.equal(state.SUPABASE_READY, true, 'gercek Supabase istemcisi aktif olmali');
  assert.equal(state.AUTH_SESSION_CACHE, null, 'auth session cache aktivasyonda temizlenmeli');
  assert.equal(state.AUTH_SESSION_READY, false, 'auth session hazir bayragi sifirlanmali');
  assert.equal(state.AUTH_CONTEXT_READY, false, 'profil ve oturum baglami aktivasyonda yeniden hydrate edilmeli');
  assert.equal(state.COMMON_DATA_CACHE, null, 'common data cache aktivasyonda temizlenmeli');
  assert.equal(state.leaderboardsSize, 0, 'leaderboard cache aktivasyonda temizlenmeli');
  assert.equal(state.leaderboardRequestsSize, 0, 'leaderboard request cache aktivasyonda temizlenmeli');
  assert.equal(state.serverLeaderboardMode, 'unknown', 'leaderboard modu yeniden kesfedilmeli');
  assert.equal(state.legacyLeaderboardRequest, null, 'legacy leaderboard istegi temizlenmeli');
  assert.equal(state.bindAuthStateSyncCalls, 1, 'auth state listener yalniz bir kez baglanmali');
  assert.equal(
    harness.events.filter((event)=>event?.type==='xyz:supabase-ready').length,
    1,
    'xyz:supabase-ready yalniz bir kez yayinlanmali',
  );
}

async function flushMicrotasks(){
  await Promise.resolve();
  await Promise.resolve();
}

async function testParallelSingleFlight(){
  const harness=createHarness();
  const pending=Array.from({ length:20 }, ()=>harness.api.ensureXYZSupabaseClient());

  assert.equal(harness.scripts.length, 1, '20 paralel ensure tek script baslatmali');
  assert.equal(harness.scripts[0].dataset.xyzSupabaseSource, '0', 'ilk istek primary CDN olmali');
  assert.equal(harness.scripts.filter((script)=>script.dataset.xyzSupabaseSource==='1').length, 0, 'primary beklerken fallback baslamamali');

  const provider=installSupabaseProvider(harness, 'parallel-primary');
  harness.scripts[0].onload();
  const clients=await Promise.all(pending);

  assert.equal(provider.calls.length, 1, '20 paralel ensure tek Supabase client olusturmali');
  assert.ok(clients.every((client)=>client===provider.client), 'tum ensure cagirilari ayni client ile cozulmeli');
  assert.equal(harness.scripts.length, 1, 'primary basariliysa fallback eklenmemeli');
  assertActivationReset(harness);
}

async function testLatePrimaryAfterTimeout(){
  const harness=createHarness();
  const pending=Array.from({ length:20 }, ()=>harness.api.ensureXYZSupabaseClient());
  const primary=harness.scripts[0];

  assert.equal(harness.runNextTimer(), 4500, 'primary timeout sozlesmesi 4500 ms olmali');
  await flushMicrotasks();

  assert.equal(harness.scripts.length, 2, 'primary timeout sonrasi tek fallback denenmeli');
  assert.equal(harness.scripts.filter((script)=>script.dataset.xyzSupabaseSource==='0').length, 1, 'primary en fazla bir kez eklenmeli');
  assert.equal(harness.scripts.filter((script)=>script.dataset.xyzSupabaseSource==='1').length, 1, 'fallback en fazla bir kez eklenmeli');
  assert.equal(typeof primary.onload, 'function', 'timeout sonrasi gec primary onload aktivasyon icin korunmali');

  const fallback=harness.scripts.find((script)=>script.dataset.xyzSupabaseSource==='1');
  const provider=installSupabaseProvider(harness, 'late-primary');
  primary.onload();
  assert.equal(provider.calls.length, 1, "gec primary onload client'i otomatik aktive etmeli");

  const clients=await Promise.all(pending);
  assert.ok(clients.every((client)=>client===provider.client), 'gec primary aktive olur olmaz ensure fallback timeoutunu beklemeden cozulmeli');
  fallback.onload();
  assert.equal(provider.calls.length, 1, 'fallback onload ikinci bir client olusturmamali');
  assert.equal(harness.scripts.filter((script)=>script.dataset.xyzSupabaseSource==='1').length, 1, 'fallback tek-flight boyunca tekrarlanmamali');

  await harness.api.ensureXYZSupabaseClient();
  assert.equal(harness.scripts.length, 2, 'aktivasyon sonrasi ensure yeni script baslatmamali');
  assert.equal(provider.calls.length, 1, 'aktivasyon sonrasi ensure yeni client olusturmamali');
  assertActivationReset(harness);
}

function extractAsyncFunction(source, name){
  const signature=new RegExp(`async\\s+function\\s+${name}\\s*\\(`);
  const match=signature.exec(source);
  assert.ok(match, `${name} fonksiyonu bulunamadi`);
  const open=source.indexOf('{', match.index);
  assert.notEqual(open, -1, `${name} govde basi bulunamadi`);
  let depth=0;
  let quote='';
  let escaped=false;
  for(let index=open; index<source.length; index+=1){
    const char=source[index];
    if(quote){
      if(escaped){ escaped=false; continue; }
      if(char==='\\'){ escaped=true; continue; }
      if(char===quote) quote='';
      continue;
    }
    if(char==='\'' || char==='"' || char==='`'){ quote=char; continue; }
    if(char==='{') depth+=1;
    if(char==='}'){
      depth-=1;
      if(depth===0) return source.slice(match.index, index+1);
    }
  }
  assert.fail(`${name} govde sonu bulunamadi`);
}

function testStaticContracts(){
  const externalSupabaseScripts=indexSource.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']*(?:supabase-js|supabase\.js)[^"']*["'][^>]*>/gi) || [];
  assert.deepEqual(externalSupabaseScripts, [], 'index.html harici Supabase defer/script tasimamali');

  const matchdayAuth=extractAsyncFunction(matchdaySource, 'predictionAuthToken');
  const matchdayEnsure=matchdayAuth.indexOf('await ensureXYZSupabaseClient()');
  const matchdaySession=matchdayAuth.indexOf('sb.auth.getSession()');
  assert.ok(matchdayEnsure>=0, 'predictionAuthToken lazy Supabase ensure beklemeli');
  assert.ok(matchdaySession>matchdayEnsure, 'predictionAuthToken session okumadan once ensure beklemeli');

  const predictAuth=extractAsyncFunction(predictGameSource, 'authHeaders');
  const predictEnsure=predictAuth.indexOf('await ensureXYZSupabaseClient()');
  const predictSession=predictAuth.indexOf('sb.auth.getSession()');
  assert.ok(predictEnsure>=0, 'predict-game authHeaders lazy Supabase ensure beklemeli');
  assert.ok(predictSession>predictEnsure, 'predict-game authHeaders session okumadan once ensure beklemeli');

  assert.match(dataSource, /AUTH_CONTEXT_READY=true[\s\S]*xyz:auth-context-ready/, 'loadAllData profil ve oturum baglami tamamlandiginda ayri auth eventi yayinlamali');
  assert.match(chatSource, /xyz:auth-context-ready[\s\S]*chatUnsubscribe\(\)[\s\S]*chatInit\(\)/, 'acik sohbet oturum baglami degistiginde tek abonelikle yeniden hydrate edilmeli');
  assert.match(uiSource, /xyz:auth-context-ready[^\n]*refreshAccountPresentation/, 'acik hesap paneli profil hidrasyonu tamamlandiginda yeniden cizilmeli');
}

await testParallelSingleFlight();
console.log('OK  20 paralel ensure: tek primary script, tek client ve tek ready event');
await testLatePrimaryAfterTimeout();
console.log('OK  primary timeout + gec onload: otomatik aktivasyon ve tek fallback');
testStaticContracts();
console.log('OK  index/auth statik lazy Supabase sozlesmeleri');
console.log('\nLazy Supabase QA: tum regresyonlar gecti.');
