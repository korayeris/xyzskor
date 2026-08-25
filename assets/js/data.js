/* ===================== SUPABASE BAĞLANTISI ===================== */
const SUPABASE_URL = 'https://swhwmqbamzczztpfxctg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Wufys3KETZb610JDyaf9WA_gD76ysAg';

/* Supabase istemcisi CDN'den yüklenen supabase-js'e bağlıdır. CDN kesintisi,
   ağ filtresi veya reklam engelleyici bu script'i düşürürse `window.supabase`
   tanımsız kalır. Daha önce bu durumda dosyanın ilk satırı hata fırlatıyor,
   data.js'in TAMAMI çalışmadan kesiliyor ve site tamamen ölüyordu
   (ardından live.js'te "Cannot access 'lastLoadError' before initialization"
   gibi ikincil TDZ hataları geliyordu).

   Artık bu durumda gerçek istemci yerine, aynı çağrı yüzeyini taklit eden ve
   her isteğe tek tip hata yanıtı veren bir yedek istemci kurulur. Böylece
   Supabase'e bağlı özellikler (giriş, tahmin, liderlik) zarifçe devre dışı
   kalırken Worker API'den beslenen futbol içeriği çalışmaya devam eder. */
const SUPABASE_UNAVAILABLE_MESSAGE = 'Hesap servisine şu anda ulaşılamıyor.';
function createSupabaseFallbackClient(reason){
  const error = { message: reason || SUPABASE_UNAVAILABLE_MESSAGE, code: 'supabase_unavailable' };
  const queryPayload = { data: null, error, count: null, status: 503, statusText: 'Service Unavailable' };
  /* Zincirlenebilir sorgu kurucusu: .select().eq().order()... her adımda
     kendini döndürür, await edildiğinde tek tip hata yanıtı verir. */
  const builder = new Proxy(function(){}, {
    get(_target, prop){
      if(prop === 'then') return (onFulfilled) => Promise.resolve(queryPayload).then(onFulfilled);
      if(prop === 'catch') return () => builder;
      if(prop === 'finally') return (callback) => { try{ if(callback) callback(); }catch(_error){} return builder; };
      return builder;
    },
    apply(){ return builder; },
  });
  const authPayload = { data: { session: null, user: null }, error };
  const channelStub = { on(){ return channelStub; }, subscribe(){ return channelStub; }, unsubscribe(){ return Promise.resolve('ok'); }, send(){ return Promise.resolve('ok'); } };
  return {
    __fallback: true,
    __reason: error.message,
    from(){ return builder; },
    rpc(){ return builder; },
    channel(){ return channelStub; },
    removeChannel(){ return Promise.resolve('ok'); },
    functions: { invoke: async () => ({ data: null, error }) },
    auth: {
      async getSession(){ return authPayload; },
      async getUser(){ return authPayload; },
      async signUp(){ return authPayload; },
      async resend(){ return authPayload; },
      async signInWithPassword(){ return authPayload; },
      async signOut(){ return { error: null }; },
      onAuthStateChange(){ return { data: { subscription: { unsubscribe(){} } } } ; },
    },
  };
}
let sb = createSupabaseFallbackClient('Hesap servisi henüz başlatılmadı.');
/* Futbolun kritik yolu harici CDN'i beklemez. Gerçek istemci hesap/veri
   hidrasyonu başladığında arka planda yüklenir ve bu bağlantı atomik olarak
   güncellenir; diğer klasik scriptler aynı `sb` bağını kullanmaya devam eder. */
let SUPABASE_READY = false;
let supabaseClientLoadPromise = null;
let resolveSupabaseClientReady = null;
const supabaseClientReadyPromise = new Promise(resolve=>{ resolveSupabaseClientReady=resolve; });
const SUPABASE_CLIENT_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
];
function activateSupabaseClient(){
  try{
    if(SUPABASE_READY) return true;
    if(!window.supabase || typeof window.supabase.createClient!=='function') return false;
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    SUPABASE_READY=true;
    AUTH_CONTEXT_READY=false;
    AUTH_SESSION_CACHE=null;
    AUTH_SESSION_READY=false;
    COMMON_DATA_CACHE=null;
    SERVER_LEADERBOARDS.clear();
    SERVER_LEADERBOARD_REQUESTS.clear();
    serverLeaderboardMode='unknown';
    legacyLeaderboardRequest=null;
    bindAuthStateSync();
    if(resolveSupabaseClientReady){ resolveSupabaseClientReady(sb); resolveSupabaseClientReady=null; }
    if(typeof CustomEvent!=='undefined') window.dispatchEvent(new CustomEvent('xyz:supabase-ready'));
    return true;
  }catch(error){
    console.warn('[XYZSkor] Supabase istemcisi kurulamadı:',error?.message||error);
    return false;
  }
}
function loadSupabaseClientSource(src,index){
  return new Promise(resolve=>{
    if(activateSupabaseClient()){ resolve(true); return; }
    const script=document.createElement('script');
    script.async=true;
    script.src=src;
    script.dataset.xyzSupabaseSource=String(index);
    let settled=false;
    const finish=(ok,mayArriveLate=false)=>{
      if(settled) return;
      settled=true;
      clearTimeout(timer);
      script.onload=mayArriveLate ? ()=>activateSupabaseClient() : null;
      script.onerror=null;
      resolve(ok&&activateSupabaseClient());
    };
    const timer=setTimeout(()=>finish(false,true),4500);
    script.onload=()=>finish(true);
    script.onerror=()=>finish(false);
    document.head.appendChild(script);
  });
}
async function ensureXYZSupabaseClient(){
  if(SUPABASE_READY||activateSupabaseClient()) return sb;
  if(supabaseClientLoadPromise) return supabaseClientLoadPromise;
  supabaseClientLoadPromise=(async()=>{
    if(typeof document==='undefined') return sb;
    for(let index=0;index<SUPABASE_CLIENT_SOURCES.length;index+=1){
      const loaded=await Promise.race([
        loadSupabaseClientSource(SUPABASE_CLIENT_SOURCES[index],index),
        supabaseClientReadyPromise.then(()=>true),
      ]);
      if(loaded||SUPABASE_READY) return sb;
    }
    console.warn('[XYZSkor] Hesap servisi kütüphanesine ulaşılamadı; futbol içeriği çalışmaya devam edecek.');
    return sb;
  })().finally(()=>{ if(!SUPABASE_READY) supabaseClientLoadPromise=null; });
  return supabaseClientLoadPromise;
}
if(typeof window!=='undefined') window.ensureXYZSupabaseClient=ensureXYZSupabaseClient;

let authStateTimer = null;
let authStateUnsubscribe = null;
let accountContextRequest = null;
let accountContextSequence = 0;

/* ===================== SABİTLER ===================== */
const TEAMS = ['Beşiktaş','Diğer','Fenerbahçe','Galatasaray','Trabzonspor'];
const TEAM_COLORS = {Galatasaray:'var(--gs)',Fenerbahçe:'var(--fb)',Beşiktaş:'var(--bjk)',Trabzonspor:'var(--ts)',Diğer:'var(--other)'};
const TEAM_CRESTS = {
  Alanyaspor:'https://upload.wikimedia.org/wikipedia/en/4/40/Alanyaspor_logo.svg',
  'Amed Sportif Faaliyetler':'https://upload.wikimedia.org/wikipedia/en/1/18/AmedSFKLogo.png',
  Galatasaray:'https://upload.wikimedia.org/wikipedia/commons/0/07/Galatasaray_S.K._Logo_2026_5-stars.svg',
  Fenerbahçe:'https://upload.wikimedia.org/wikipedia/en/3/39/Fenerbah%C3%A7e.svg',
  Beşiktaş:'https://upload.wikimedia.org/wikipedia/commons/d/da/BesiktasJK-Logo.svg',
  Trabzonspor:'https://upload.wikimedia.org/wikipedia/en/d/de/Trabzonspor_Amblem.svg',
  Başakşehir:'https://upload.wikimedia.org/wikipedia/en/e/e1/%C4%B0stanbul_Ba%C5%9Fak%C5%9Fehir_logo.svg',
  'Başakşehir FK':'https://upload.wikimedia.org/wikipedia/en/e/e1/%C4%B0stanbul_Ba%C5%9Fak%C5%9Fehir_logo.svg',
  'Çaykur Rizespor':'https://upload.wikimedia.org/wikipedia/en/5/5f/Caykur_Rizespor_logo.svg',
  'Çorum FK':'https://upload.wikimedia.org/wikipedia/en/a/ab/%C3%87orum_F.K._crest.svg',
  'Erzurumspor FK':'https://upload.wikimedia.org/wikipedia/en/6/68/Erzurumspor_F.K._crest_%282025%29.png',
  Eyüpspor:'https://upload.wikimedia.org/wikipedia/commons/6/62/Ey%C3%BCpspor_Logosu.png',
  'Gaziantep FK':'https://upload.wikimedia.org/wikipedia/en/c/c6/Gazi%C5%9Fehir_Gaziantep_logo.svg',
  Gençlerbirliği:'https://upload.wikimedia.org/wikipedia/en/1/13/Gen%C3%A7lerbirli%C4%9Fi_S.K._crest.svg',
  Göztepe:'https://upload.wikimedia.org/wikipedia/en/0/0f/G%C3%B6ztepe_S.K._logo.png',
  Kasımpaşa:'https://upload.wikimedia.org/wikipedia/en/1/18/Kasimpasa_logo.svg',
  Kocaelispor:'https://upload.wikimedia.org/wikipedia/en/c/cc/Kocaelispor_current_logo.png',
  Konyaspor:'https://upload.wikimedia.org/wikipedia/en/d/d1/Konyaspor_logo.svg',
  Samsunspor:'https://upload.wikimedia.org/wikipedia/en/8/83/Samsunspor_crest.svg'
};
const ANALYSIS_FIELDS = [
  ['sonFormEv','Ev sahibi son 5 maç formu'], ['sonFormKonuk','Deplasman son 5 maç formu'],
  ['evDisPerf','İç/dış saha performansı'], ['golOrt','Gol atma / yeme ortalaması'],
  ['sakatlik','Eksik, sakat, cezalı oyuncular'], ['muhtemelKadro','Muhtemel kadrolar'],
  ['hakem','Hakem ve eğilimleri'], ['hava','Hava durumu'], ['gecmisMaclar','Geçmiş karşılaşmalar']
];
const ALL_BADGES = ['İlk Tahmin','Haftayı Eksiksiz Tamamladı','Kesin Skor Uzmanı','5 Doğru Tahmin','Taraftar Ligi İlk 10','Haftanın Şampiyonu','Veri Ustası'];
/* Fikstur tazelik kaynagi.
   `manualCheck` YALNIZCA elle dogrulanmis seed veri icindir; saglayicidan gelen
   fikstur icin kullanilmaz. Iki kaynagin ayni etiketle gosterilmesi kullaniciya
   sahte tazelik sunar. Seed veri elle guncellendiginde manualCheck tarihini de
   guncelle; aksi halde arayuz veriyi bayat olarak isaretler. */
const VERIFIED = { kaynak: 'TFF (tff.org), Hürriyet Spor Arena', manualCheck: '2026-07-31' };
const MANUAL_CHECK_STALE_DAYS = 7;
/* Saglayici yaniti geldiginde gercek updatedAt buraya yazilir. */
const DATA_FRESHNESS = { providerUpdatedAt: null, providerSource: null, fromProvider: false };

function formatCheckDate(value){
  const parsed = value ? new Date(value) : null;
  if(!parsed || Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Istanbul'}).format(parsed);
}
function formatCheckDateTime(value){
  const parsed = value ? new Date(value) : null;
  if(!parsed || Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'}).format(parsed);
}
function manualCheckAgeDays(){
  const parsed = new Date(VERIFIED.manualCheck);
  if(Number.isNaN(parsed.getTime())) return Infinity;
  return Math.floor((Date.now()-parsed.getTime())/86400000);
}
/* Fikstur tazeligini DURUSTCE etiketler.
   Saglayici verisi varsa gercek updatedAt gosterilir; yoksa elle kontrol tarihi
   ve eskiyse bayatlik uyarisi verilir. Hicbir durumda uydurma tazelik yazilmaz. */
function fixtureFreshness(){
  if(DATA_FRESHNESS.fromProvider && DATA_FRESHNESS.providerUpdatedAt){
    const stamp = formatCheckDateTime(DATA_FRESHNESS.providerUpdatedAt);
    return { live:true, stale:false, text: stamp ? `Sağlayıcı verisi · Güncellendi: ${stamp}` : 'Sağlayıcı verisi' };
  }
  const age = manualCheckAgeDays();
  const stale = age > MANUAL_CHECK_STALE_DAYS;
  const stamp = formatCheckDate(VERIFIED.manualCheck) || VERIFIED.manualCheck;
  return { live:false, stale, text: stale
    ? `Elle doğrulanmış arşiv · Son kontrol: ${stamp} · güncelliği teyit edilmedi`
    : `Elle doğrulanmış veri · Son kontrol: ${stamp}` };
}
const LIVE_FEED_CONFIG = {
  functionName: 'football-live',
  scope: 'selected-leagues',
  seasonScope: 'selected-leagues-season',
  refreshMs: 30000
};
// Canlı skor ayrı endpointten gelir. Sezon fikstürü/puan tablosunu her lig
// geçişinde yeniden indirmek yerine aynı sekmede on dakika paylaşırız.
const PROVIDER_SEASON_CACHE_MS = 10 * 60 * 1000;
const PROVIDER_LIVE_FALLBACK = '/api/football';
const SELECTED_COMPETITIONS = [
  { key:'super-lig', label:'Süper Lig', short:'Süper Lig', sportmonksId:'600' },
  { key:'premier-league', label:'Premier League', short:'EPL', sportmonksId:'8' },
  { key:'la-liga', label:'La Liga', short:'La Liga', sportmonksId:'564' },
  { key:'bundesliga', label:'Bundesliga', short:'Bundesliga', sportmonksId:'82' },
  { key:'serie-a', label:'Serie A', short:'Serie A', sportmonksId:'384' },
  // UCL ve UEL yapılandırmaları aşağıda korunuyor; özel paket yeniden
  // etkinleştirilene kadar navigasyon ve toplu API sorgularına dahil edilmiyor.
  { key:'all', label:'Tüm ligler', short:'Tümü', sportmonksId:'600,8,564,82,384' }
];
const FOOTBALL_COVERAGE_CACHE_MS = 60 * 60 * 1000;
const FOOTBALL_COVERAGE_FAILURE_BACKOFF_MS = 30 * 1000;
let FOOTBALL_COVERAGE_CACHE = null;
let footballCoverageRequest = null;
let footballCoverageAbortController = null;
let footballCoverageRequestSequence = 0;
let footballCoverageRetryAt = 0;
function footballCoverageState(leagueKey){
  if(!FOOTBALL_COVERAGE_CACHE || FOOTBALL_COVERAGE_CACHE.expiresAt<=Date.now()) return null;
  if(leagueKey==='all'){
    const rows=[...FOOTBALL_COVERAGE_CACHE.leagues.values()];
    return { available:rows.some(row=>row.available), partial:rows.some(row=>!row.available) };
  }
  return FOOTBALL_COVERAGE_CACHE.leagues.get(leagueKey) || null;
}
function footballCoverageUnavailable(leagueKey){ return footballCoverageState(leagueKey)?.available===false; }
function footballCoverageMessage(leagueKey){
  const label=competitionLabelBySlug(leagueKey);
  const reason=footballCoverageState(leagueKey)?.reason;
  if(reason==='season_unavailable') return `${label} abonelikte yer alıyor ancak aktif sezon henüz sağlayıcı tarafından yayınlanmadı.`;
  if(reason==='fixtures_unavailable') return `${label} abonelikte yer alıyor ancak fikstür erişimi şu anda kullanılamıyor.`;
  return `${label} mevcut veri sağlayıcı aboneliğinde yer almıyor. Kapsam açıldığında doğrulanmış maç ve tablo verileri burada otomatik yayınlanacak.`;
}
async function loadFootballCoverage(){
  if(FOOTBALL_COVERAGE_CACHE?.expiresAt>Date.now()) return FOOTBALL_COVERAGE_CACHE;
  if(footballCoverageRetryAt>Date.now()) return null;
  if(footballCoverageRequest) return footballCoverageRequest;
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const sequence=++footballCoverageRequestSequence;
  footballCoverageAbortController=controller;
  footballCoverageRequest=(async()=>{
    try{
      const response=await fetch('/api/football/coverage',{headers:{Accept:'application/json'},signal:controller?.signal});
      const payload=await response.json().catch(()=>null);
      if(controller?.signal.aborted||sequence!==footballCoverageRequestSequence) return null;
      if(!response.ok || !Array.isArray(payload?.selected)) throw new Error('coverage_unavailable');
      FOOTBALL_COVERAGE_CACHE={
        leagues:new Map(payload.selected.map(row=>[String(row.league),{available:row.available===true,currentSeasonId:row.currentSeasonId||null,reason:row.reason||null,capabilities:row.capabilities||null}])),
        updatedAt:payload.updatedAt||null,
        expiresAt:Date.now()+FOOTBALL_COVERAGE_CACHE_MS
      };
      return FOOTBALL_COVERAGE_CACHE;
    }catch(_error){
      if(controller?.signal.aborted||sequence!==footballCoverageRequestSequence||_error?.name==='AbortError') return null;
      // Coverage yardimci bir katmandir. 5xx veya ag hatasi lig akisini engellemez.
      footballCoverageRetryAt=Date.now()+FOOTBALL_COVERAGE_FAILURE_BACKOFF_MS;
      return null;
    }finally{
      if(sequence===footballCoverageRequestSequence){
        footballCoverageRequest=null;
        footballCoverageAbortController=null;
      }
    }
  })();
  return footballCoverageRequest;
}
function abortFootballCoverage(){
  footballCoverageRequestSequence+=1;
  footballCoverageAbortController?.abort?.();
  footballCoverageAbortController=null;
  footballCoverageRequest=null;
}
const LEAGUE_CONTEXT = {
  all:{headline:'5 lig genel görünümü',copy:'Süper Lig, Premier League, La Liga, Bundesliga ve Serie A verisi aynı vitrinde toplanır.',agenda:'Seçili liglerin doğrulanmış gündemi',standings:'Lig tabloları',transfer:'Transfer gelişmeleri'},
  'super-lig':{headline:'Süper Lig hafta vitrini',copy:'Türkiye futbol gündemi, maç akışı, kulüp verileri ve transfer hareketleri tek ekranda izlenir.',agenda:'Süper Lig gündemi',standings:'Süper Lig puan durumu',transfer:'Süper Lig transfer gelişmeleri'},
  'champions-league':{headline:'Şampiyonlar Ligi hafta vitrini',copy:'Turnuvanın maç akışı, puan tablosu, kulüp gündemi ve öne çıkan bağlamı aynı alanda sunulur.',agenda:'Şampiyonlar Ligi gündemi',standings:'Lig aşaması tablosu',transfer:'Turnuva takımları transfer gündemi'},
  'europa-league':{headline:'UEFA Avrupa Ligi hafta vitrini',copy:'UEFA Avrupa Ligi maçları, tablo, kulüp akışı ve sezon bağlamı tek akışta izlenir.',agenda:'UEFA Avrupa Ligi gündemi',standings:'Lig aşaması tablosu',transfer:'Turnuva takımları transfer gündemi'},
  'la-liga':{headline:'La Liga hafta vitrini',copy:'İspanya ligi için maç akışı, puan durumu, kulüp gündemi ve transfer dosyası birlikte gösterilir.',agenda:'La Liga gündemi',standings:'La Liga puan durumu',transfer:'La Liga transfer gelişmeleri'},
  bundesliga:{headline:'Bundesliga hafta vitrini',copy:'Almanya ligi için maç akışı, puan durumu, kulüp gündemi ve transfer dosyası birlikte gösterilir.',agenda:'Bundesliga gündemi',standings:'Bundesliga puan durumu',transfer:'Bundesliga transfer gelişmeleri'},
  'serie-a':{headline:'Serie A hafta vitrini',copy:'İtalya ligi için maç akışı, puan durumu, kulüp gündemi ve transfer dosyası birlikte gösterilir.',agenda:'Serie A gündemi',standings:'Serie A puan durumu',transfer:'Serie A transfer gelişmeleri'},
  'premier-league':{headline:'Premier League hafta vitrini',copy:'İngiltere ligi için maç akışı, puan durumu, kulüp gündemi ve transfer dosyası tek düzende toplanır.',agenda:'Premier League gündemi',standings:'Premier League puan durumu',transfer:'Premier League transfer gelişmeleri'}
};
const OFFICIAL_SEASON_SUMMARIES = Object.freeze({
  'super-lig':{
    season:'2025/26',
    champion:'Galatasaray',
    championNote:'TFF tescili · son tamamlanan sezon',
    standoutLabel:'Gol kralları',
    standout:'Paul Onuachu · Eldor Shomurodov',
    standoutTeam:'Trabzonspor · Başakşehir',
    standoutNote:'TFF resmî gol krallığı kaydı',
    sourceLinks:[
      {label:'TFF şampiyonluk tescili',url:'https://www.tff.org/default.aspx?pageID=687&ftxtID=50600'},
      {label:'TFF gol krallığı',url:'https://www.tff.org/default.aspx?pageID=545'}
    ]
  },
  'champions-league':{
    season:'2025/26',
    champion:'Paris Saint-Germain',
    championNote:'UEFA resmî şampiyon kaydı',
    standoutLabel:'Sezonun oyuncusu',
    standout:'Khvicha Kvaratskhelia',
    standoutTeam:'Paris Saint-Germain',
    standoutNote:'UEFA Teknik Gözlemciler',
    sourceLinks:[
      {label:'UEFA sezon kaydı',url:'https://www.uefa.com/uefachampionsleague/history/seasons/2026/'},
      {label:'UEFA sezonun oyuncusu',url:'https://www.uefa.com/uefachampionsleague/news/029a-1e2f66419d80-e5c6f9634f70-1000--kvaratskhelia-named-2025-26-uefa-champions-league-player/'}
    ]
  },
  'europa-league':{
    season:'2025/26',
    champion:'Aston Villa',
    championNote:'UEFA resmî şampiyon kaydı',
    standoutLabel:'Sezonun oyuncusu',
    standout:'Morgan Rogers',
    standoutTeam:'Aston Villa',
    standoutNote:'UEFA Teknik Gözlemciler',
    sourceLinks:[
      {label:'UEFA sezon kaydı',url:'https://www.uefa.com/uefaeuropaleague/history/seasons/2026/'},
      {label:'UEFA sezonun oyuncusu',url:'https://www.uefa.com/uefaeuropaleague/news/029a-1e2f3953e01d-5791ee9eef57-1000--rogers-named-2025-26-uefa-europa-league-player-of-the-s/'}
    ]
  },
  'la-liga':{
    season:'2025/26',
    champion:'Barcelona',
    championNote:'LALIGA resmî sezon kaydı',
    standoutLabel:'Sezonun oyuncusu',
    standout:'Lamine Yamal',
    standoutTeam:'Barcelona',
    standoutNote:'LALIGA EA SPORTS ödülü',
    sourceLinks:[
      {label:'LALIGA sezon özeti',url:'https://www.laliga.com/en-GB/news/fc-barcelona-win-laliga-ea-sports-title-2025-26'},
      {label:'LALIGA sezonun oyuncusu',url:'https://www.laliga.com/en-GB/news/lamine-yamal-named-laliga-ea-sports-player-of-the-season-2025-26'}
    ]
  },
  'premier-league':{
    season:'2025/26',
    champion:'Arsenal',
    championNote:'Premier League resmî sezon kaydı',
    standoutLabel:'Sezonun oyuncusu',
    standout:'Bruno Fernandes',
    standoutTeam:'Manchester United',
    standoutNote:'EA SPORTS Player of the Season',
    sourceLinks:[
      {label:'Premier League sezon özeti',url:'https://www.premierleague.com/news/4309828'},
      {label:'Premier League sezonun oyuncusu',url:'https://www.premierleague.com/news/4307899'}
    ]
  }
});
const LEAGUE_FALLBACK_CLUBS = Object.freeze({
  'champions-league':['Arsenal','Bayern München','Liverpool','Tottenham Hotspur','Barcelona','Chelsea','Sporting CP','Manchester City','Real Madrid','Inter','Paris Saint-Germain','Newcastle United','Juventus','Atlético Madrid','Atalanta','Bayer Leverkusen'],
  'europa-league':['Roma','Porto','Rangers','Fenerbahçe','Galatasaray','Real Betis','Lazio','Feyenoord','Lyon','Ajax','Braga','Villarreal','Freiburg','Olympiacos','Trabzonspor','Beşiktaş'],
  'la-liga':['Barcelona','Real Madrid','Atlético Madrid','Athletic Club','Villarreal','Real Betis','Real Sociedad','Sevilla','Valencia','Celta Vigo','Osasuna','Getafe','Rayo Vallecano','Mallorca','Girona','Espanyol','Levante','Elche'],
  'premier-league':['Liverpool','Arsenal','Manchester City','Chelsea','Tottenham Hotspur','Manchester United','Newcastle United','Aston Villa','Brighton','Bournemouth','Crystal Palace','Everton','Fulham','West Ham United','Brentford','Wolverhampton Wanderers','Leeds United','Sunderland','Burnley','Hull City']
});
Object.assign(TEAM_CRESTS, {
  Arsenal:'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg',
  'Bayern München':'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
  Liverpool:'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
  'Tottenham Hotspur':'https://upload.wikimedia.org/wikipedia/en/b/b4/Tottenham_Hotspur.svg',
  Barcelona:'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
  Chelsea:'https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg',
  'Sporting CP':'https://upload.wikimedia.org/wikipedia/en/e/e1/Sporting_Clube_de_Portugal_%28Logo%29.svg',
  'Manchester City':'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
  'Real Madrid':'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
  Inter:'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
  'Paris Saint-Germain':'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
  'Newcastle United':'https://upload.wikimedia.org/wikipedia/en/5/56/Newcastle_United_Logo.svg',
  Juventus:'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg',
  'Atlético Madrid':'https://upload.wikimedia.org/wikipedia/en/f/f4/Atletico_Madrid_2017_logo.svg',
  Atalanta:'https://upload.wikimedia.org/wikipedia/en/6/66/AtalantaBC.svg',
  'Bayer Leverkusen':'https://upload.wikimedia.org/wikipedia/en/5/59/Bayer_04_Leverkusen_logo.svg',
  Roma:'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo_%282017%29.svg',
  Porto:'https://upload.wikimedia.org/wikipedia/en/f/f1/FC_Porto.svg',
  Rangers:'https://upload.wikimedia.org/wikipedia/en/4/43/Rangers_FC.svg',
  'Real Betis':'https://upload.wikimedia.org/wikipedia/en/1/13/Real_betis_logo.svg',
  Lazio:'https://upload.wikimedia.org/wikipedia/en/c/ce/S.S._Lazio_badge.svg',
  Feyenoord:'https://upload.wikimedia.org/wikipedia/en/e/e3/Feyenoord_logo.svg',
  Lyon:'https://upload.wikimedia.org/wikipedia/en/c/c6/Olympique_Lyonnais.svg',
  Ajax:'https://upload.wikimedia.org/wikipedia/en/7/79/Ajax_Amsterdam.svg',
  Braga:'https://upload.wikimedia.org/wikipedia/en/7/79/S.C._Braga_logo.svg',
  Villarreal:'https://upload.wikimedia.org/wikipedia/en/7/70/Villarreal_CF_logo.svg',
  Freiburg:'https://upload.wikimedia.org/wikipedia/en/f/f1/SC_Freiburg_logo.svg',
  Olympiacos:'https://upload.wikimedia.org/wikipedia/en/0/0e/Olympiacos_FC_logo.svg',
  'Athletic Club':'https://upload.wikimedia.org/wikipedia/en/9/98/Club_Athletic_Bilbao_logo.svg',
  'Real Sociedad':'https://upload.wikimedia.org/wikipedia/en/f/f1/Real_Sociedad_logo.svg',
  Sevilla:'https://upload.wikimedia.org/wikipedia/en/3/3b/Sevilla_FC_logo.svg',
  Valencia:'https://upload.wikimedia.org/wikipedia/en/c/ce/Valenciacf.svg',
  'Celta Vigo':'https://upload.wikimedia.org/wikipedia/en/1/12/RC_Celta_de_Vigo_logo.svg',
  Osasuna:'https://upload.wikimedia.org/wikipedia/en/2/2e/CA_Osasuna_logo.svg',
  Getafe:'https://upload.wikimedia.org/wikipedia/en/9/9f/Getafe_CF_logo.svg',
  'Rayo Vallecano':'https://upload.wikimedia.org/wikipedia/en/1/11/Rayo_Vallecano_logo.svg',
  Mallorca:'https://upload.wikimedia.org/wikipedia/en/e/e0/RCD_Mallorca.svg',
  Girona:'https://upload.wikimedia.org/wikipedia/en/f/f7/Girona_FC_Logo.svg',
  Espanyol:'https://upload.wikimedia.org/wikipedia/en/d/d6/Rcd_espanyol_logo.svg',
  Levante:'https://upload.wikimedia.org/wikipedia/en/6/69/Levante_UD_logo.svg',
  Elche:'https://upload.wikimedia.org/wikipedia/en/a/a7/Elche_CF_logo.svg',
  'Manchester United':'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg',
  'Aston Villa':'https://upload.wikimedia.org/wikipedia/en/9/9a/Aston_Villa_FC_new_crest.svg',
  Brighton:'https://upload.wikimedia.org/wikipedia/en/f/fd/Brighton_%26_Hove_Albion_logo.svg',
  Bournemouth:'https://upload.wikimedia.org/wikipedia/en/e/e5/AFC_Bournemouth_%282013%29.svg',
  'Crystal Palace':'https://upload.wikimedia.org/wikipedia/en/a/a2/Crystal_Palace_FC_logo_%282022%29.svg',
  Everton:'https://upload.wikimedia.org/wikipedia/en/7/7c/Everton_FC_logo.svg',
  Fulham:'https://upload.wikimedia.org/wikipedia/en/e/eb/Fulham_FC_%28shield%29.svg',
  'West Ham United':'https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg',
  Brentford:'https://upload.wikimedia.org/wikipedia/en/2/2a/Brentford_FC_crest.svg',
  'Wolverhampton Wanderers':'https://upload.wikimedia.org/wikipedia/en/f/fc/Wolverhampton_Wanderers.svg',
  'Leeds United':'https://upload.wikimedia.org/wikipedia/en/5/54/Leeds_United_F.C._logo.svg',
  Sunderland:'https://upload.wikimedia.org/wikipedia/en/7/77/Logo_Sunderland.svg',
  Burnley:'https://upload.wikimedia.org/wikipedia/en/0/02/Burnley_FC_badge.svg'
});
const VIDEO_CONFIG = {
  title: '',
  description: '',
  poster: '',
  src: '',
  source: '',
  duration: ''
};
const X_CLUBS = [
  { team:'Galatasaray', handle:'GalatasaraySK', url:'https://x.com/GalatasaraySK' },
  { team:'Fenerbahçe', handle:'Fenerbahce', url:'https://x.com/Fenerbahce' },
  { team:'Beşiktaş', handle:'Besiktas', url:'https://x.com/Besiktas' },
  { team:'Trabzonspor', handle:'Trabzonspor', url:'https://x.com/Trabzonspor' }
];
const makeXClubList = pairs => pairs.map(([team,handle])=>({team,handle,url:`https://x.com/${handle}`}));
const X_CLUBS_BY_LEAGUE = Object.freeze({
  'super-lig': X_CLUBS,
  'champions-league': makeXClubList([
    ['Arsenal','Arsenal'],['Bayern München','FCBayern'],['Liverpool','LFC'],['Tottenham Hotspur','SpursOfficial'],
    ['Barcelona','FCBarcelona'],['Chelsea','ChelseaFC'],['Sporting CP','SportingCP'],['Manchester City','ManCity'],
    ['Real Madrid','realmadrid'],['Inter','Inter'],['Paris Saint-Germain','PSG_English'],['Newcastle United','NUFC'],
    ['Juventus','juventusfc'],['Atlético Madrid','Atleti'],['Atalanta','Atalanta_BC'],['Bayer Leverkusen','bayer04fussball']
  ]),
  'europa-league': makeXClubList([
    ['Roma','OfficialASRoma'],['Porto','FCPorto'],['Rangers','RangersFC'],['Fenerbahçe','Fenerbahce'],
    ['Galatasaray','GalatasaraySK'],['Real Betis','RealBetis'],['Lazio','OfficialSSLazio'],['Feyenoord','Feyenoord'],
    ['Lyon','OL'],['Ajax','AFCAjax'],['Braga','SCBragaOficial'],['Villarreal','VillarrealCF'],
    ['Freiburg','scfreiburg'],['Olympiacos','olympiacosfc'],['Trabzonspor','Trabzonspor'],['Beşiktaş','Besiktas']
  ]),
  'la-liga': makeXClubList([
    ['Real Madrid','realmadrid'],['Barcelona','FCBarcelona'],['Atlético Madrid','Atleti'],['Athletic Club','AthleticClub'],
    ['Villarreal','VillarrealCF'],['Real Betis','RealBetis'],['Real Sociedad','RealSociedad'],['Sevilla','SevillaFC'],
    ['Valencia','valenciacf'],['Celta Vigo','RCCelta'],['Osasuna','Osasuna'],['Getafe','GetafeCF'],
    ['Rayo Vallecano','RayoVallecano'],['Mallorca','RCD_Mallorca'],['Girona','GironaFC'],['Espanyol','RCDEspanyol'],
    ['Levante','LevanteUD'],['Elche','elchecf'],['Alavés','Alaves'],['Real Oviedo','RealOviedo']
  ]),
  'premier-league': makeXClubList([
    ['Liverpool','LFC'],['Arsenal','Arsenal'],['Manchester City','ManCity'],['Chelsea','ChelseaFC'],
    ['Tottenham Hotspur','SpursOfficial'],['Manchester United','ManUtd'],['Newcastle United','NUFC'],['Aston Villa','AVFCOfficial'],
    ['Brighton','OfficialBHAFC'],['Bournemouth','afcbournemouth'],['Crystal Palace','CPFC'],['Everton','Everton'],
    ['Fulham','FulhamFC'],['West Ham United','WestHam'],['Brentford','BrentfordFC'],['Wolverhampton Wanderers','Wolves'],
    ['Leeds United','LUFC'],['Sunderland','SunderlandAFC'],['Burnley','BurnleyOfficial'],['Hull City','HullCity']
  ]),
  bundesliga: makeXClubList([
    ['Bayern München','FCBayern'],['Borussia Dortmund','BVB'],['Bayer Leverkusen','bayer04fussball'],['RB Leipzig','RBLeipzig'],
    ['Eintracht Frankfurt','Eintracht'],['VfB Stuttgart','VfB'],['Werder Bremen','werderbremen'],['Freiburg','scfreiburg']
  ]),
  'serie-a': makeXClubList([
    ['Inter','Inter'],['Milan','acmilan'],['Juventus','juventusfc'],['Napoli','sscnapoli'],
    ['Roma','OfficialASRoma'],['Lazio','OfficialSSLazio'],['Atalanta','Atalanta_BC'],['Fiorentina','acffiorentina']
  ])
});

const HISTORIC_STANDINGS_2024_25 = [
  {team:'Galatasaray',played:36,won:30,drawn:5,lost:1,goals_for:91,goals_against:31,goal_difference:60,points:95,form:'WWWWW',zone:'champion'},
  {team:'Fenerbahçe',played:36,won:26,drawn:6,lost:4,goals_for:90,goals_against:39,goal_difference:51,points:84,form:'LWWLW',zone:'europe'},
  {team:'Samsunspor',played:36,won:19,drawn:7,lost:10,goals_for:55,goals_against:41,goal_difference:14,points:64,form:'WWWDW',zone:'europe'},
  {team:'Beşiktaş',played:36,won:17,drawn:11,lost:8,goals_for:59,goals_against:36,goal_difference:23,points:62,form:'WWDLW',zone:'europe'},
  {team:'Başakşehir',played:36,won:16,drawn:6,lost:14,goals_for:60,goals_against:56,goal_difference:4,points:54,form:'WLWLL',zone:'europe'},
  {team:'Eyüpspor',played:36,won:15,drawn:8,lost:13,goals_for:53,goals_against:47,goal_difference:6,points:53,form:'LLLLW'},
  {team:'Trabzonspor',played:36,won:13,drawn:12,lost:11,goals_for:58,goals_against:45,goal_difference:13,points:51,form:'LLDDW'},
  {team:'Göztepe',played:36,won:13,drawn:11,lost:12,goals_for:59,goals_against:50,goal_difference:9,points:50,form:'WDLLW'},
  {team:'Çaykur Rizespor',played:36,won:15,drawn:4,lost:17,goals_for:52,goals_against:58,goal_difference:-6,points:49,form:'WLWWW'},
  {team:'Kasımpaşa',played:36,won:11,drawn:14,lost:11,goals_for:62,goals_against:63,goal_difference:-1,points:47,form:'DWLDL'},
  {team:'Konyaspor',played:36,won:13,drawn:7,lost:16,goals_for:45,goals_against:50,goal_difference:-5,points:46,form:'WLWLL'},
  {team:'Alanyaspor',played:36,won:12,drawn:9,lost:15,goals_for:43,goals_against:50,goal_difference:-7,points:45,form:'WDDWW'},
  {team:'Kayserispor',played:36,won:11,drawn:12,lost:13,goals_for:45,goals_against:57,goal_difference:-12,points:45,form:'WWLDL'},
  {team:'Gaziantep FK',played:36,won:12,drawn:9,lost:15,goals_for:45,goals_against:50,goal_difference:-5,points:45,form:'LLDDD'},
  {team:'Antalyaspor',played:36,won:12,drawn:8,lost:16,goals_for:37,goals_against:62,goal_difference:-25,points:44,form:'WLDLL'},
  {team:'Bodrum FK',played:36,won:9,drawn:10,lost:17,goals_for:26,goals_against:43,goal_difference:-17,points:37,form:'LDDDL',zone:'relegated'},
  {team:'Sivasspor',played:36,won:9,drawn:8,lost:19,goals_for:44,goals_against:60,goal_difference:-16,points:35,form:'WLDLL',zone:'relegated'},
  {team:'Hatayspor',played:36,won:6,drawn:8,lost:22,goals_for:47,goals_against:74,goal_difference:-27,points:26,form:'LDWWL',zone:'relegated'},
  {team:'Adana Demirspor',played:36,won:3,drawn:5,lost:28,goals_for:34,goals_against:92,goal_difference:-58,points:2,form:'LLLWD',zone:'relegated'}
];

const SUPER_LIG_CLUBS_2026_27 = [
  {team:'Alanyaspor',city:'Antalya · Alanya',stadium:'Alanya Oba Stadyumu',capacity:'9.789'},
  {team:'Amed Sportif Faaliyetler',display:'Amed SFK',city:'Diyarbakır · Kayapınar',stadium:'Diyarbakır Stadyumu',capacity:'30.480',promoted:true},
  {team:'Beşiktaş',city:'İstanbul · Beşiktaş',stadium:'Beşiktaş Park',capacity:'42.593'},
  {team:'Çaykur Rizespor',city:'Rize',stadium:'Çaykur Didi Stadyumu',capacity:'15.332'},
  {team:'Çorum FK',city:'Çorum',stadium:'Çorum Şehir Stadyumu',capacity:'15.000',promoted:true},
  {team:'Erzurumspor FK',city:'Erzurum · Yakutiye',stadium:'Kâzım Karabekir Stadyumu',capacity:'21.374',promoted:true},
  {team:'Eyüpspor',city:'İstanbul · Eyüpsultan',stadium:'Recep Tayyip Erdoğan Stadyumu',capacity:'14.234'},
  {team:'Fenerbahçe',city:'İstanbul · Kadıköy',stadium:'Şükrü Saracoğlu Stadyumu',capacity:'47.430'},
  {team:'Galatasaray',city:'İstanbul · Sarıyer',stadium:'Ali Sami Yen Spor Kompleksi',capacity:'53.798'},
  {team:'Gaziantep FK',city:'Gaziantep · Şehitkamil',stadium:'Gaziantep Stadyumu',capacity:'33.502'},
  {team:'Gençlerbirliği',city:'Ankara · Yenimahalle',stadium:'Eryaman Stadyumu',capacity:'20.672'},
  {team:'Göztepe',city:'İzmir · Konak',stadium:'Gürsel Aksel Stadyumu',capacity:'25.035'},
  {team:'Başakşehir',city:'İstanbul · Başakşehir',stadium:'Başakşehir Fatih Terim Stadyumu',capacity:'17.319'},
  {team:'Kasımpaşa',city:'İstanbul · Beyoğlu',stadium:'Recep Tayyip Erdoğan Stadyumu',capacity:'14.234'},
  {team:'Kocaelispor',city:'Kocaeli · İzmit',stadium:'Kocaeli Stadyumu',capacity:'34.829'},
  {team:'Konyaspor',city:'Konya · Selçuklu',stadium:'Konya Büyükşehir Bld. Stadyumu',capacity:'42.000'},
  {team:'Samsunspor',city:'Samsun · Canik',stadium:'Samsun 19 Mayıs Stadyumu',capacity:'33.919'},
  {team:'Trabzonspor',city:'Trabzon · Ortahisar',stadium:'Şenol Güneş Spor Kompleksi',capacity:'41.461'}
];

const CLUB_MARKET_SOURCE_URL = 'https://www.transfermarkt.com.tr/super-lig/teilnehmer/pokalwettbewerb/TR1/saison_id/2026';
const CLUB_COACH_SOURCE_URL = 'https://www.transfermarkt.com.tr/super-lig/trainer/pokalwettbewerb/TR1';
const CLUB_INTELLIGENCE_2026_27 = Object.freeze({
  Alanyaspor:{marketValue:'€31,83 Mn',squadSize:26,averageAge:'25,7',coach:{name:'João Pereira',age:42,nationality:'Portekiz',tenure:'1 yıl 4 ay',contract:'2027'}},
  'Amed Sportif Faaliyetler':{marketValue:'€21,95 Mn',squadSize:28,averageAge:'27,3',coach:{name:'Besnik Hasi',age:54,nationality:'Arnavutluk',tenure:'1 ay',contract:'2028'}},
  Beşiktaş:{marketValue:'€202,40 Mn',squadSize:34,averageAge:'25,6',coach:{name:'Vincenzo Italiano',age:48,nationality:'İtalya',tenure:'1 ay',contract:'2028'}},
  'Çaykur Rizespor':{marketValue:'€44,85 Mn',squadSize:27,averageAge:'25,3',coach:{name:'Recep Uçar',age:50,nationality:'Türkiye',tenure:'8 ay',contract:'2027'}},
  'Çorum FK':{marketValue:'€18,38 Mn',squadSize:28,averageAge:'27,6',coach:{name:'Uğur Uçar',age:39,nationality:'Türkiye',tenure:'5 ay',contract:'2027'}},
  'Erzurumspor FK':{marketValue:'€14,55 Mn',squadSize:29,averageAge:'27,2',coach:{name:'Serkan Özbalta',age:47,nationality:'Türkiye',tenure:'11 ay',contract:'2027'}},
  Eyüpspor:{marketValue:'€12,15 Mn',squadSize:27,averageAge:'24,3',coach:{name:'Özhan Pulat',age:41,nationality:'Türkiye',tenure:'1 ay',contract:'Açıklanmadı'}},
  Fenerbahçe:{marketValue:'€332,15 Mn',squadSize:41,averageAge:'27,6',coach:{name:'İsmail Kartal',age:65,nationality:'Türkiye',tenure:'1 ay',contract:'2027'}},
  Galatasaray:{marketValue:'€323,15 Mn',squadSize:34,averageAge:'25,9',coach:{name:'Okan Buruk',age:52,nationality:'Türkiye',tenure:'4 yıl 1 ay',contract:'Açıklanmadı'}},
  'Gaziantep FK':{marketValue:'€23,15 Mn',squadSize:30,averageAge:'25,1',coach:{name:'Mirel Rădoi',age:45,nationality:'Romanya',tenure:'3 ay',contract:'2027'}},
  Gençlerbirliği:{marketValue:'€14,55 Mn',squadSize:26,averageAge:'25,6',coach:{name:'Metin Diyadin',age:58,nationality:'Türkiye',tenure:'2 ay',contract:'2027'}},
  Göztepe:{marketValue:'€67,45 Mn',squadSize:28,averageAge:'24,6',coach:{name:'Stanimir Stoilov',age:59,nationality:'Bulgaristan',tenure:'2 yıl 8 ay',contract:'2027'}},
  Başakşehir:{marketValue:'€84,30 Mn',squadSize:42,averageAge:'26,0',coach:{name:'Nuri Şahin',age:37,nationality:'Türkiye',tenure:'10 ay',contract:'2028'}},
  Kasımpaşa:{marketValue:'€30,65 Mn',squadSize:39,averageAge:'24,7',coach:{name:'Emre Belözoğlu',age:45,nationality:'Türkiye',tenure:'7 ay',contract:'2027'}},
  Kocaelispor:{marketValue:'€18,65 Mn',squadSize:26,averageAge:'25,9',coach:{name:'Selçuk İnan',age:41,nationality:'Türkiye',tenure:'1 yıl 1 ay',contract:'2028'}},
  Konyaspor:{marketValue:'€29,38 Mn',squadSize:23,averageAge:'26,3',coach:{name:'İlhan Palut',age:49,nationality:'Türkiye',tenure:'5 ay',contract:'2027'}},
  Samsunspor:{marketValue:'€49,65 Mn',squadSize:37,averageAge:'24,0',coach:{name:'Thorsten Fink',age:58,nationality:'Almanya',tenure:'5 ay',contract:'2027'}},
  Trabzonspor:{marketValue:'€135,40 Mn',squadSize:32,averageAge:'26,5',coach:{name:'Fatih Tekke',age:48,nationality:'Türkiye',tenure:'1 yıl 4 ay',contract:'2029'}}
});
SUPER_LIG_CLUBS_2026_27.forEach(club=>Object.assign(club,CLUB_INTELLIGENCE_2026_27[club.team]||{}, {
  marketSourceUrl:CLUB_MARKET_SOURCE_URL,
  coachSourceUrl:CLUB_COACH_SOURCE_URL,
  checkedAt:'3 Ağustos 2026'
}));

const TRANSFER_CENTER_DATA = {
  confirmed:[
    {name:'Mason Greenwood',from:'Marsilya',to:'Fenerbahçe',fee:'€39 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Orkun Kökçü',from:'Benfica',to:'Beşiktaş',fee:'€30 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Leandro Trossard',from:'Arsenal',to:'Beşiktaş',fee:'€18 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Vedat Muriqi',from:'Mallorca',to:'Fenerbahçe',fee:'€15,5 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Nathan Aké',from:'Manchester City',to:'Fenerbahçe',fee:'€8,17 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Kassoum Ouattara',from:'Monaco',to:'Beşiktaş',fee:'€8 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Alexander Nübel',from:'Bayern Münih',to:'Beşiktaş',fee:'€6,25 M',status:'Resmî işlem',source:'2026–27 Süper Lig transferleri',sourceUrl:'https://tr.wikipedia.org/wiki/2026-27_S%C3%BCper_Lig_transferleri'},
    {name:'Metehan Mimaroğlu',from:'Açıklanmadı',to:'Trabzonspor',fee:'Açıklanmadı',status:'Kulüp kadrosunda',source:'Anadolu Ajansı · 16 Temmuz 2026',sourceUrl:'https://www.aa.com.tr/tr/spor/trabzonspor-teknik-direktoru-fatih-tekke-transferde-son-bir-iki-hamlemiz-daha-olacak/4000657'}
  ],
  talks:[
    {name:'Trabzonspor’un son 1–2 hamlesi',from:'Pozisyon açıklanmadı',to:'Trabzonspor',fee:'Görüşmeler sürüyor',status:'Teknik direktör açıklaması',detail:'Fatih Tekke, yönetimin kadroya bir veya iki takviye için çalışmalarını sürdürdüğünü açıkladı.',source:'Anadolu Ajansı · 16 Temmuz 2026',sourceUrl:'https://www.aa.com.tr/tr/spor/trabzonspor-teknik-direktoru-fatih-tekke-transferde-son-bir-iki-hamlemiz-daha-olacak/4000657'}
  ],
  rumours:[
    {name:'Julio Enciso',from:'Strasbourg',to:'Galatasaray',fee:'Bedel açıklanmadı',status:'Rumour',detail:'Transfermarkt, oyuncuyu Galatasaray’ın genç oyuncu planında izlediği isimlerden biri olarak aktardı; resmî açıklama bulunmuyor.',source:'Transfermarkt · 13 Temmuz 2026',sourceUrl:'https://www.transfermarkt.com.tr/galatasaraydan-genclik-hamlesi-julio-enciso-ve-uc-isim-daha-listede-yer-aliyor/view/news/482838'},
    {name:'Can Uzun',from:'Eintracht Frankfurt',to:'Galatasaray',fee:'Bedel açıklanmadı',status:'Rumour',detail:'29 Temmuz tarihli dış basın iddiası; kulüp açıklaması bulunmuyor.',source:'Fussball Europa · 29 Temmuz 2026',sourceUrl:'https://www.fussballeuropa.com/team/galatasaray/transfer-geruechte'},
    {name:'Jhon Lucumí',from:'Bologna',to:'Galatasaray',fee:'Bedel açıklanmadı',status:'Rumour',detail:'26 Temmuz tarihli dış basın iddiası; resmî transfer değildir.',source:'Fussball Europa · 26 Temmuz 2026',sourceUrl:'https://www.fussballeuropa.com/team/galatasaray/transfer-geruechte'},
    {name:'Mathys Tel',from:'Tottenham',to:'Galatasaray',fee:'Bedel açıklanmadı',status:'Rumour',detail:'18 Temmuz tarihli dış basın iddiası; doğrulama bekliyor.',source:'Fussball Europa · 18 Temmuz 2026',sourceUrl:'https://www.fussballeuropa.com/team/galatasaray/transfer-geruechte'},
    {name:'Bruno Fernandes',from:'Manchester United',to:'Galatasaray',fee:'Bedel açıklanmadı',status:'Rumour',detail:'30 Haziran tarihli dış basın iddiası; resmî açıklama yok.',source:'Fussball Europa · 30 Haziran 2026',sourceUrl:'https://www.fussballeuropa.com/team/galatasaray/transfer-geruechte'},
    {name:'Rafael Leão',from:'Milan',to:'Fenerbahçe',fee:'—',status:'Kulüp yalanladı',detail:'Fenerbahçe oyuncu veya kulübüyle temas kurulmadığını açıkladı.',source:'Fenerbahçe açıklaması · 25 Temmuz 2026',sourceUrl:'https://football-italia.net/official-fenerbahce-deny-offer-milan-leao/'}
  ]
};
/* ===================== CACHE (Supabase'ten yüklenen veri) ===================== */
/* PRODUCTION_STRIP_LEGACY_JS_START */
const MYTHOS_PRODUCTS = {
  Seçki:[
    {name:'Champion Edition – Nova Hobby Box',year:'Galatasaray · 2026',reward:'Sezon Finali Büyük Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201415658509192_.webp',desc:'Şampiyonluk sezonunun yıldızlarını, kırılma anlarını ve kulüp mirasını premium bir kutuda buluşturan sponsor ödülü.',features:['30 kartlık premium kutu','6 numaralı kart garantisi','İmzalı veya Matchworn Patch hit']},
    {name:'Mythos Legends – Mehmet Özdilek',year:'Beşiktaş · Legends 2026',reward:'Aylık Liderlik Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639072019845495612_.webp',desc:'Beşiktaş tarihinin simge isimlerinden Şifo Mehmet’in kariyerini numaralı ve imzalı kartlarla anlatan özel sponsor ödülü.',features:['Her pakette 5 numaralı kart','İmzalı kartlar mevcut','6,4 × 8,9 cm özel baskı']},
    {name:'Trabzonspor Pulse 2025/26',year:'Trabzonspor · Pulse',reward:'Haftalık Taraftar Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201437618030532_.webp',desc:'Bordo-mavili kadroyu modern grafik diliyle sunan, haftanın kazananına ücretsiz verilecek futbolcu kartı paketi.',features:['2025/26 futbolcu koleksiyonu','Modern Pulse tasarım serisi','Resmî Mythos ödül paketi']}
  ],
  Galatasaray:[
    {name:'Champion Edition – Nova Hobby Box',year:'2026 · Nova Hobby Box',reward:'Sezon Finali Büyük Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201415658509192_.webp',features:['6 paket · toplam 30 kart','6 numaralı kart garantisi','1 imzalı veya Matchworn Patch hit']},
    {name:'Pulse Futbolcu Kartları 2025/26',year:'2025/26 · Tek Paket',reward:'Haftalık Taraftar Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201436045954862_.webp',features:['Futbolcu koleksiyon serisi','2025/26 sezon baskısı','Resmî Mythos ödül paketi']},
    {name:'2025/26 Sezon Kartları – Kutu',year:'2026 · Sezon Kartları',reward:'Aylık Liderlik Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201451141428793_.webp',features:['Takım sezon koleksiyonu','Özel baskılı futbolcu kartları','Resmî Mythos ödül kutusu']}
  ],
  Beşiktaş:[
    {name:'Beşiktaş 2022/23 Moments Serisi',year:'2022/23 · Moments',reward:'Haftalık Taraftar Ödülü',image:'https://cdn.mythos.cards/imgs/Image_638255592199308689_.jpg',features:['Her pakette 1 özel an kartı','Numaralı ve imzalı nadir kartlar','Forma parçalı kart ihtimali']},
    {name:'Mythos Legends – Mehmet Özdilek',year:'2026 · Legends',reward:'Sezon Finali Büyük Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639072019845495612_.webp',features:['Her pakette 5 numaralı kart','İmzalı kartlar mevcut','6,4 × 8,9 cm özel baskı']},
    {name:'Hyeon-Gyu Oh Koleksiyon Kartları',year:'2025 · Oyuncu Serisi',reward:'Aylık Liderlik Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201430790402622_.webp',features:['10 kart: 5 Base + 2 Parlak','2 Anime kart','1 dijital imzalı kart']}
  ],
  Trabzonspor:[
    {name:'2025/26 Sezon Kartları – Kutu',year:'2026 · Sezon Kartları',reward:'Aylık Liderlik Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201454914689199_.webp',features:['Kutuda toplam 12 kart','1 parlak kart garantisi','Numaralı kart ihtimali']},
    {name:'Trabzonspor 2025/26 Mythos First',year:'2025/26 · Mythos First',reward:'Haftalık Taraftar Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201397499182163_.webp',features:['7 Base + 3 parlak kart','Toplam 10 kart','Dijital imzalı kart ihtimali']},
    {name:'Pulse Futbolcu Kartları 2025/26',year:'2025/26 · Pulse',reward:'Haftalık Taraftar Ödülü',image:'https://cdn.mythos.cards/imgs/Image_639201437618030532_.webp',features:['Futbolcu koleksiyon serisi','2025/26 sezon baskısı','Resmî Mythos ödül paketi']}
  ]
};
let activeMythosTeam='Seçki';
function renderMythosProducts(){
  const grid=document.getElementById('mythosProductGrid'); if(!grid) return;
  const editorial={Galatasaray:'Şampiyonluk kültürünü, yıldız oyuncuları ve sezonun unutulmaz anlarını koleksiyon tasarımıyla bir araya getiriyor.',Beşiktaş:'Siyah-beyaz mirası, ikonik oyuncuları ve tribün hafızasını özel baskı koleksiyon kartlarına taşıyor.',Trabzonspor:'Bordo-mavili kimliği, genç yetenekleri ve kulübün güçlü futbol hikâyesini modern bir koleksiyonda buluşturuyor.'};
  grid.innerHTML=(MYTHOS_PRODUCTS[activeMythosTeam]||[]).map(p=>`<article class="official-product"><div class="official-product-image"><img src="${p.image}" alt="${p.name}" loading="lazy"></div><div class="official-product-body"><span class="official-product-kicker">${p.year}</span><h3>${p.name}</h3><p class="official-product-desc">${p.desc||editorial[activeMythosTeam]||'Futbol kültürünü özenli baskı ve koleksiyon değeriyle bir araya getiren resmî Mythos sponsor ödülü.'}</p><div class="official-product-reward">${p.reward}</div><ul class="product-features">${p.features.map(f=>`<li>${f}</li>`).join('')}</ul><span class="product-link">Kazanana ücretsiz hediye</span></div></article>`).join('');
  document.querySelectorAll('.product-team-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.team===activeMythosTeam));
}
function selectMythosTeam(team){ activeMythosTeam=team; renderMythosProducts(); }

/* PRODUCTION_STRIP_LEGACY_JS_END */

const PREDICT_REWARD_TIERS = [
  {key:'rookie',name:'Çaylak',min:0,max:9,reward:'Dijital rozet',budget:'Fiziksel ödül yok',image:null},
  {key:'bronze',name:'Bronz',min:10,max:19,reward:'Aylık çekiliş hakkı',budget:'Mythos tek paket havuzu',image:'https://cdn.mythos.cards/imgs/Image_639174871080078636_.webp'},
  {key:'silver',name:'Gümüş',min:20,max:34,reward:'1 Mythos kart paketi',budget:'Aylık Gümüş ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639201437618030532_.webp'},
  {key:'gold',name:'Altın',min:35,max:49,reward:'Pulse / First bundle çekilişi',budget:'Aylık Altın ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639201436045954862_.webp'},
  {key:'diamond',name:'Elmas',min:50,max:64,reward:'Metal kutu çekilişi',budget:'Aylık Elmas ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639174871186017847_.webp'},
  {key:'champion',name:'Şampiyon',min:65,max:null,reward:'Premium kutu final çekilişi',budget:'Aylık stok ve sponsor bütçesiyle sınırlı',image:'https://cdn.mythos.cards/imgs/Image_639201415658509192_.webp'}
];
window.XYZ_PREDICT_REWARD_TIERS=PREDICT_REWARD_TIERS;

let transferCountdownHandle = null;
function updateTransferCountdown(){
  const target=document.getElementById('transferCenterCountdown'); if(!target) return;
  const remaining=new Date('2026-09-05T00:00:00+03:00').getTime()-Date.now();
  if(remaining<=0){ target.innerHTML='<span class="countdown-closed">DÖNEM KAPANDI</span>'; return; }
  const days=Math.floor(remaining/86400000), hours=Math.floor((remaining%86400000)/3600000), minutes=Math.floor((remaining%3600000)/60000), seconds=Math.floor((remaining%60000)/1000);
  target.innerHTML=`<span><b>${days}</b><small>GÜN</small></span><i>:</i><span><b>${String(hours).padStart(2,'0')}</b><small>SAAT</small></span><i>:</i><span><b>${String(minutes).padStart(2,'0')}</b><small>DK</small></span><i>:</i><span><b>${String(seconds).padStart(2,'0')}</b><small>SN</small></span>`;
}
function startTransferCountdown(){
  updateTransferCountdown();
  if(!transferCountdownHandle) transferCountdownHandle=setInterval(updateTransferCountdown,1000);
}

let MATCHES = [];
let ANALYSIS = {};
let PROFILES = {};
let ALL_PREDICTIONS = {};
let ALL_RESULTS = {};
let REWARDS = {};
let STANDINGS = [];
let FOOTBALL_HOME_STANDINGS = {};
let FOOTBALL_HOME_AVAILABILITY = {};
let WEEKLY_STORIES = {};
let currentUser = null;
let tickerHandle = null;
let liveFeedHandle = null; // recursive setTimeout id (setInterval yerine; bkz. scheduleNextLivePoll)
let liveFeedLoading = false;
let liveFeedAbortController = null; // lig degisiminde veya yeni poll basladiginda eski istek iptal edilir
let liveFeedRequestSeq = 0; // gec gelen eski cevabin yeni skoru geri almasini engeller
let liveFeedRequestScope = null;
let liveFeedActiveScope = null;
let liveProviderHealthCheckedAt = 0;
let liveFeedNextRefreshMs = 5000; // sunucunun nextRefreshInSeconds degeriyle guncellenir (adaptif takvim)
let liveFeedVisibilityBound = false;
const LIVE_MATCH_DETAIL_CACHE = new Map(); // fixtureId -> {events, statistics, fetchedAt}
const LIVE_MATCH_DETAIL_TTL_MS = 8000; // /events uc cache TTL degeriyle hizali (bkz worker MATCH_EVENTS_CACHE)
const LIVE_MATCH_DETAIL_PENDING = new Set();
const LIVE_MATCH_DETAIL_CONTROLLERS = new Map();
const LIVE_EXIT_VERIFICATION_PENDING = new Set();
const LIVE_EXIT_VERIFICATION_CONTROLLERS = new Map();
let liveProviderHealthAbortController = null;
const LIVE_FEED_MIN_REFRESH_MS = 5000;
const LIVE_FEED_MAX_REFRESH_MS = 300000;
const LIVE_FEED_HIDDEN_REFRESH_MS = 120000; // sekme arka plandayken hizli polling yerine bu kullanilir
let LIVE_FEED = { matches:[], updatedAt:null, stale:false, staleAgeSeconds:0, degraded:false, reason:null, error:null, loaded:false };
let lastLoadError = null;
let DATA_ERRORS = {};
let activeWeek = 1;
let activeFootballTeam = 'Tümü';
let activeFootballLeague = (()=>{
  const routed=typeof document!=='undefined' ? document.body?.dataset?.footballLeagueLoading : '';
  return SELECTED_COMPETITIONS.some(item=>item.key===routed) ? routed : 'super-lig';
})();
let SERVER_LEADERBOARDS = new Map();
let SERVER_LEADERBOARD_REQUESTS = new Map();
let serverLeaderboardMode = 'unknown';
let legacyLeaderboardRequest = null;
let footballDataLoadSequence = 0;
let seasonFixturesReady = new Set();
const providerSeasonRequests = new Map();
let footballCriticalRequest = null;
let AUTH_SESSION_CACHE = null;
let AUTH_SESSION_READY = false;
let AUTH_CONTEXT_READY = false;

async function getCachedAuthSession(){
  if(AUTH_SESSION_READY) return AUTH_SESSION_CACHE;
  try{
    if(!SUPABASE_READY) await ensureXYZSupabaseClient();
    const authRes=await sb.auth.getSession();
    AUTH_SESSION_CACHE=authRes&&authRes.data?authRes.data.session:null;
  }catch(error){
    console.error('[XYZSkor veri hatası] auth.getSession',error);
    AUTH_SESSION_CACHE=null;
  }
  AUTH_SESSION_READY=true;
  return AUTH_SESSION_CACHE;
}

function toSafeUserObject(authUser){
  if(!authUser) return null;
  return {
    id: authUser.id || null,
    email: authUser.email || null,
    emailVerified: !!authUser.email_confirmed_at
  };
}
function mergeProfileWithSession(profile, sessionUser){
  if(!sessionUser) return null;
  const baseProfile = profile || {};
  return { ...baseProfile, ...toSafeUserObject(sessionUser), id: sessionUser.id || baseProfile.id };
}
async function loadAccountContext(){
  if(accountContextRequest) return accountContextRequest;
  const sequence=accountContextSequence;
  const request=(async()=>{
    await ensureXYZSupabaseClient();
    const session=await getCachedAuthSession();
    if(sequence!==accountContextSequence) return false;
    let profile=null;
    if(session?.user){
      const rows=await moduleQuery(sb.from('profiles').select('*').eq('id',session.user.id),'own_profile');
      if(sequence!==accountContextSequence) return false;
      profile=rows[0]||null;
      if(!profile){
        try{ profile=await ensureOwnProfile(session.user); }
        catch(error){ console.error('[XYZSkor veri hatasÄ±] eksik profil oluÅŸturulamadÄ±',error); }
      }
      if(profile?.id) PROFILES[profile.id]=profile;
      currentUser=mergeProfileWithSession(profile,session.user);
    }else currentUser=null;
    AUTH_CONTEXT_READY=true;
    if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined'){
      window.dispatchEvent(new CustomEvent('xyz:auth-context-ready',{detail:{userId:currentUser?.id||null}}));
    }
    return true;
  })().finally(()=>{ if(accountContextRequest===request) accountContextRequest=null; });
  accountContextRequest=request;
  return request;
}
function refreshAccountContext(){
  accountContextSequence+=1;
  accountContextRequest=null;
  AUTH_SESSION_READY=false;
  AUTH_CONTEXT_READY=false;
  return loadAccountContext();
}
function refreshAuthState(){
  if(authStateTimer){
    clearTimeout(authStateTimer);
  }
  authStateTimer = setTimeout(async () => {
    authStateTimer = null;
    try{
      await loadAccountContext();
    }catch(error){
      console.error('[XYZSkor] auth değişim sonrası oturum senkronizasyonu başarısız:', error);
    }
  }, 100);
}
function bindAuthStateSync(){
  if(!SUPABASE_READY || typeof sb?.auth?.onAuthStateChange !== 'function' || authStateUnsubscribe) return;
  try{
    const { data } = sb.auth.onAuthStateChange((_event, _session) => {
      AUTH_SESSION_CACHE=_session||null;
      AUTH_SESSION_READY=true;
      AUTH_CONTEXT_READY=false;
      accountContextSequence+=1;
      accountContextRequest=null;
      if(_event === 'SIGNED_OUT'){
        currentUser = null;
        if(typeof renderAll === 'function') renderAll();
      }
      refreshAuthState();
    });
    authStateUnsubscribe = data?.subscription?.unsubscribe || null;
  }catch(error){
    console.warn('[XYZSkor] auth state dinleyicisi kurulamadı:', error?.message || error);
  }
}

function getCurrentUser(){ return currentUser; }
function normalizeCompetitionText(value){
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı','i')
    .replaceAll('ü','u')
    .replaceAll('ş','s')
    .replaceAll('ğ','g')
    .replaceAll('ç','c')
    .replaceAll('ö','o');
}
function competitionName(match){
  return match?.competition || match?.tournament || match?.league_name || match?.league || match?.competition_name || competitionLabelBySlug(activeFootballLeague);
}
function competitionSlug(value){
  const raw = normalizeCompetitionText(value);
  if(!raw || raw==='all') return 'all';
  if(raw.includes('champions') || raw.includes('sampiyonlar')) return 'champions-league';
  if(raw.includes('europa') || raw.includes('avrupa')) return 'europa-league';
  if(raw.includes('la liga') || raw.includes('laliga') || raw.includes('spain') || raw.includes('espana')) return 'la-liga';
  if(raw.includes('premier') || raw.includes('england') || raw.includes('ingiltere')) return 'premier-league';
  if(raw.includes('super lig') || raw.includes('süper lig') || raw.includes('trendyol') || raw.includes('turkey') || raw.includes('turkiye')) return 'super-lig';
  return raw.replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'all';
}
function competitionLabelBySlug(slug){
  return (SELECTED_COMPETITIONS.find(item=>item.key===slug) || SELECTED_COMPETITIONS[0]).label;
}
function competitionShortBySlug(slug){
  return (SELECTED_COMPETITIONS.find(item=>item.key===slug) || SELECTED_COMPETITIONS[0]).short;
}
function activeFootballLeagueConfig(){
  return SELECTED_COMPETITIONS.find(item=>item.key===activeFootballLeague) || SELECTED_COMPETITIONS[0];
}
function footballLeagueRequestKey(){
  return activeFootballLeagueConfig().key;
}
function matchInActiveLeague(match){
  return activeFootballLeague==='all' || competitionSlug(competitionName(match))===activeFootballLeague;
}
function normalizeClientFootballStatus(value){
  const status=String(value||'').toLocaleLowerCase('tr-TR').replaceAll('ı','i').replace(/[\s-]+/g,'_');
  if(status.startsWith('canl') || ['live','inplay','in_play','1h','2h','et','p','int'].includes(status)) return 'live';
  if(['devre_arasi','halftime','half_time','ht','bt','break'].includes(status)) return 'halftime';
  if(['bitti','finished','finish','ft','aet','pen','after_penalties','after_extra_time'].includes(status)) return 'finished';
  if(['iptal','cancelled','canceled','canc','cancl'].includes(status)) return 'cancelled';
  if(['ertelendi','postponed','postp','suspended','delayed'].includes(status)) return 'postponed';
  return 'scheduled';
}
function footballStatusIsLive(matchOrStatus){ return ['live','halftime'].includes(normalizeClientFootballStatus(matchOrStatus?.status??matchOrStatus)); }
function footballStatusIsFinished(matchOrStatus){ return normalizeClientFootballStatus(matchOrStatus?.status??matchOrStatus)==='finished'; }
function footballStatusIsUnavailable(matchOrStatus){ return ['cancelled','postponed'].includes(normalizeClientFootballStatus(matchOrStatus?.status??matchOrStatus)); }
function normalizedLiveMatch(liveMatch){
  if(!liveMatch?.id||!liveMatch?.home?.name||!liveMatch?.away?.name) return null;
  const leagueKey=liveMatch.leagueKey||competitionSlug(liveMatch.competition);
  if(!FOOTBALL_HOME_LEAGUES.includes(leagueKey)) return null;
  const homeScore=liveMatch.home.score==null?null:Number(liveMatch.home.score);
  const awayScore=liveMatch.away.score==null?null:Number(liveMatch.away.score);
  return {
    id:String(liveMatch.id),
    ev:String(liveMatch.home.name),
    konuk:String(liveMatch.away.name),
    kickoff:liveMatch.startedAt||new Date().toISOString(),
    status:liveMatch.status==='halftime'?'devre_arasi':liveMatch.status==='finished'?'bitti':'canlı',
    minute:Number.isFinite(Number(liveMatch.minute))?Number(liveMatch.minute):null,
    addedTime:liveMatch.addedTime==null?null:Number(liveMatch.addedTime),
    competition:liveMatch.competition||competitionLabelBySlug(leagueKey),
    league_key:leagueKey,
    home_logo:liveMatch.home.logo||null,
    away_logo:liveMatch.away.logo||null,
    home_team_id:liveMatch.home.id||null,
    away_team_id:liveMatch.away.id||null,
    verified:true,
    result:Number.isFinite(homeScore)&&Number.isFinite(awayScore)?{home:homeScore,away:awayScore}:null,
  };
}
function mergeLiveFeedIntoProviderMatches(matches,requestedLeague){
  const rows=(matches||[]).map(match=>({...match}));
  const indexById=new Map(rows.map((match,index)=>[String(match.id),index]));
  (MATCHES||[]).filter(match=>footballStatusIsLive(match)||match?.livePendingVerification).forEach(current=>{
    const leagueKey=current.league_key||competitionSlug(competitionName(current));
    if(requestedLeague!=='all'&&leagueKey!==requestedLeague) return;
    const id=String(current.id),index=indexById.get(id);
    if(index===undefined){ indexById.set(id,rows.length); rows.push({...current,league_key:leagueKey}); return; }
    rows[index]={...rows[index],status:current.status,minute:current.minute,result:current.result||rows[index].result||null,livePendingVerification:Boolean(current.livePendingVerification),league_key:leagueKey};
  });
  (LIVE_FEED?.matches||[]).forEach(liveMatch=>{
    const normalized=normalizedLiveMatch(liveMatch); if(!normalized) return;
    if(requestedLeague!=='all'&&normalized.league_key!==requestedLeague) return;
    const index=indexById.get(normalized.id);
    if(index===undefined){ indexById.set(normalized.id,rows.length); rows.push(normalized); return; }
    rows[index]={...rows[index],...normalized,result:normalized.result||rows[index].result||null};
  });
  return rows;
}
function matchInActiveTeam(match){
  return activeFootballTeam==='Tümü' || match?.ev===activeFootballTeam || match?.konuk===activeFootballTeam;
}
function isSuperLigScope(){
  return activeFootballLeague==='all' || activeFootballLeague==='super-lig';
}
function isStrictSuperLigScope(){
  return activeFootballLeague==='super-lig';
}
function activeLeagueContext(){
  return LEAGUE_CONTEXT[activeFootballLeague] || LEAGUE_CONTEXT.all;
}

async function ensureSeasonFixtures(){
  const leagueKey = footballLeagueRequestKey();
  if(seasonFixturesReady.has(leagueKey)) return true;
  // The league-scoped Sportmonks worker below is the source of truth. The old
  // Supabase sync function returns an incompatible payload and can hold the UI
  // on stale data before the provider request completes.
  seasonFixturesReady.add(leagueKey);
  return true;
}

async function fetchProviderSeasonBundleOnce(leagueKey, options={}){
  if(!leagueKey || leagueKey==='all') return null;
  const cacheKey = `xyzskor:provider-season:${leagueKey}`;
  try{
    const early=typeof window!=='undefined' ? window.__XYZ_FOOTBALL_SEASON_REQUEST__ : null;
    let payload=null;
    if(early?.league===leagueKey&&early.promise){
      const earlyController=window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__;
      if(options.signal?.aborted) earlyController?.abort?.();
      else options.signal?.addEventListener?.('abort',()=>earlyController?.abort?.(),{once:true});
      payload=await early.promise;
      if(window.__XYZ_FOOTBALL_SEASON_REQUEST__===early) window.__XYZ_FOOTBALL_SEASON_REQUEST__=null;
      if(window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__===earlyController) window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__=null;
      if(options.signal?.aborted) throw new DOMException('Aborted','AbortError');
      if(payload?.league===leagueKey&&Array.isArray(payload.matches)){
        try{ sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),payload})); }catch(_error){}
        return payload;
      }
      // initial-route bu gorunur scope'un tek HTTP istegidir. 503/gecersiz
      // yanit sonrasi ayni sayfa acilisinda ikinci bir browser istegi baslatma.
      return null;
    }
    try{
      const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');
      if(cached&&cached.savedAt&&Date.now()-cached.savedAt<PROVIDER_SEASON_CACHE_MS&&cached.payload?.league===leagueKey&&Array.isArray(cached.payload.matches)) return cached.payload;
    }catch(_error){}
    const requestURL=`${PROVIDER_LIVE_FALLBACK}/season?league=${encodeURIComponent(leagueKey)}`;
    const response=await fetch(requestURL,{headers:{Accept:'application/json'},cache:'no-store',signal:options.signal});
    payload=await response.json().catch(()=>null);
    if(options.signal?.aborted) throw new DOMException('Aborted','AbortError');
    // Retry-After tarayicida uygulanmaz. Edge/provider cache bir sonraki gorunur
    // talepte yeniden denenir; mevcut scope her durumda en fazla bir HTTP yapar.
    if(!response.ok) return null;
    if(!payload || payload.league!==leagueKey || !Array.isArray(payload.matches)) return null;
    try{ sessionStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(),payload})); }catch(_error){}
    return payload;
  }catch(error){
    if(error?.name==='AbortError') return null;
    DATA_ERRORS.provider = error && error.message ? error.message : 'Sportmonks sağlayıcı yedeği kullanılamıyor.';
    return null;
  }
}

function fetchProviderSeasonBundle(leagueKey, options={}){
  if(!leagueKey || leagueKey==='all') return Promise.resolve(null);
  const existing=providerSeasonRequests.get(leagueKey);
  if(existing&&!existing.signal?.aborted) return existing.promise;
  if(existing) providerSeasonRequests.delete(leagueKey);
  const entry={promise:null,signal:options.signal||null};
  const request=fetchProviderSeasonBundleOnce(leagueKey,options).finally(()=>{
    if(providerSeasonRequests.get(leagueKey)===entry) providerSeasonRequests.delete(leagueKey);
  });
  entry.promise=request;
  providerSeasonRequests.set(leagueKey,entry);
  return request;
}

const FOOTBALL_HOME_LEAGUES=['super-lig','premier-league','la-liga','bundesliga','serie-a'];
const FOOTBALL_HOME_CACHE_KEY='xyzskor:football-home:v3';
const FOOTBALL_HOME_CACHE_MS=10*60*1000;
let footballHomeNetworkRequest=null;
function compactFootballHomeBundle(bundles){
  const now=Date.now();
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const matches=[];
  const standingsByLeague={};
  const availability={};
  const selectedResultIds=new Set();
  bundles.forEach((bundle,index)=>{
    const league=FOOTBALL_HOME_LEAGUES[index];
    availability[league]=Boolean(bundle && Array.isArray(bundle.matches));
    standingsByLeague[league]=(bundle?.standings||[]).slice(0,5).map(row=>({...row,league_key:league}));
    const resultIds=new Set((bundle?.results||[]).map(row=>String(row?.match_id||row?.id||'')));
    const rows=(bundle?.matches||[])
      .map(match=>({...match,league_key:league}))
      .filter(match=>Number.isFinite(Date.parse(match.kickoff)))
      .sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff));
    const isVerifiedFinished=match=>Boolean(match?.result)||footballStatusIsFinished(match)||resultIds.has(String(match?.id||match?.match_id||''));
    const todays=rows.filter(match=>{
      if(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(match.kickoff))!==today) return false;
      if(footballStatusIsUnavailable(match)) return false;
      return isVerifiedFinished(match)||footballStatusIsLive(match)||Date.parse(match.kickoff)>=now;
    });
    const upcoming=rows.filter(match=>!footballStatusIsUnavailable(match)&&!isVerifiedFinished(match)&&Date.parse(match.kickoff)>=now).slice(0,3);
    const recent=rows.filter(match=>Date.parse(match.kickoff)<now&&isVerifiedFinished(match)).slice(-2);
    const selected=todays.length ? todays : (upcoming.length ? upcoming : recent);
    selected.forEach(match=>selectedResultIds.add(String(match?.id||match?.match_id||'')));
    matches.push(...selected);
  });
  const results=bundles.flatMap(bundle=>bundle?.results||[]).filter(row=>selectedResultIds.has(String(row?.match_id||row?.id||'')));
  return {league:'all',matches,standings:[],standingsByLeague,availability,results,updatedAt:new Date().toISOString(),source:'Sportmonks · beş lig paralel'};
}
function validFootballHomePayload(payload){
  return Boolean(payload&&payload.league==='all'&&Array.isArray(payload.matches)&&payload.standingsByLeague&&typeof payload.standingsByLeague==='object'&&payload.availability&&typeof payload.availability==='object');
}
function cacheFootballHomePayload(payload){
  try{ if(validFootballHomePayload(payload)) localStorage.setItem(FOOTBALL_HOME_CACHE_KEY,JSON.stringify({savedAt:Date.now(),payload})); }catch(_error){}
  return payload;
}
async function fetchFootballHomeNetwork(options={}){
  if(footballHomeNetworkRequest&&!footballHomeNetworkRequest.__scopeSignal?.aborted) return footballHomeNetworkRequest;
  if(footballHomeNetworkRequest?.__scopeSignal?.aborted) footballHomeNetworkRequest=null;
  const request=(async()=>{
    try{
      const early=typeof window!=='undefined' ? window.__XYZ_FOOTBALL_HOME_REQUEST__ : null;
      let payload=null,responseOk=false;
      if(early){
        const earlyController=window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__;
        if(options.signal?.aborted) earlyController?.abort?.();
        else options.signal?.addEventListener?.('abort',()=>earlyController?.abort?.(),{once:true});
        payload=await early;
        window.__XYZ_FOOTBALL_HOME_REQUEST__=null;
        if(window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__===earlyController) window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__=null;
        if(options.signal?.aborted) throw new DOMException('Aborted','AbortError');
        responseOk=Boolean(payload);
        if(!responseOk) return null;
      }
      if(!responseOk){
        const response=await fetch('/api/football/home',{headers:{Accept:'application/json'},cache:'no-store',signal:options.signal});
        payload=await response.json().catch(()=>null);
        if(options.signal?.aborted) throw new DOMException('Aborted','AbortError');
        responseOk=response.ok;
      }
      if(responseOk&&validFootballHomePayload(payload)) return cacheFootballHomePayload(payload);
    }catch(_error){}
    // Ana futbol vitrini tek bir sunucu kontratidir. Bu uc kullanilamiyorsa
    // istemci bes ligi ayri ayri sorgulayarak kotayi katlamaz.
    return null;
  })().finally(()=>{ if(footballHomeNetworkRequest===request) footballHomeNetworkRequest=null; });
  request.__scopeSignal=options.signal||null;
  footballHomeNetworkRequest=request;
  return request;
}
async function fetchFootballHomeBundle(options={}){
  let cached=null;
  try{ cached=JSON.parse(localStorage.getItem(FOOTBALL_HOME_CACHE_KEY)||'null'); }catch(_error){}
  if(cached?.savedAt&&validFootballHomePayload(cached.payload)){
    if(Date.now()-cached.savedAt<FOOTBALL_HOME_CACHE_MS){
      window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__?.abort?.();
      window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__=null;
      window.__XYZ_FOOTBALL_HOME_REQUEST__=null;
      return cached.payload;
    }
    // Stale-while-revalidate: son dogrulanmis vitrin aninda boyanir; yeni tek
    // endpoint cevabi geldiginde UI kontrollu bir event ile tazelenir.
    const refreshRequest=fetchFootballHomeNetwork(options);
    if(typeof options.onBackgroundRequest==='function') options.onBackgroundRequest(refreshRequest);
    refreshRequest.then(payload=>{
      const stillActive=!options.signal?.aborted&&(typeof options.isActive!=='function'||options.isActive());
      if(stillActive&&typeof window!=='undefined'&&typeof CustomEvent!=='undefined'&&validFootballHomePayload(payload)) window.dispatchEvent(new CustomEvent('xyz:football-home-refreshed',{detail:{payload}}));
    }).catch(()=>{});
    return cached.payload;
  }
  return fetchFootballHomeNetwork(options);
}

let FOOTBALL_WEEKLY_FEATURES={league:null,leaders:null,awards:null,status:'idle',error:null};
let footballWeeklyFeaturesRequest=null;
let footballWeeklyFeaturesController=null;
let footballWeeklyFeaturesSequence=0;
async function loadFootballWeeklyFeatures(leagueKey){
  if(!leagueKey||leagueKey==='all'||document.hidden) return null;
  if(FOOTBALL_WEEKLY_FEATURES.league===leagueKey&&['ready','stale'].includes(FOOTBALL_WEEKLY_FEATURES.status)) return FOOTBALL_WEEKLY_FEATURES;
  if(footballWeeklyFeaturesRequest&&FOOTBALL_WEEKLY_FEATURES.league===leagueKey) return footballWeeklyFeaturesRequest;
  footballWeeklyFeaturesController?.abort();
  footballWeeklyFeaturesController=typeof AbortController!=='undefined'?new AbortController():null;
  const controller=footballWeeklyFeaturesController,sequence=++footballWeeklyFeaturesSequence;
  FOOTBALL_WEEKLY_FEATURES={league:leagueKey,leaders:null,awards:null,status:'loading',error:null};
  if(typeof renderFootballWeeklyFeatures==='function') renderFootballWeeklyFeatures();
  const request=Promise.allSettled([
    fetch(`/api/football/leaders?league=${encodeURIComponent(leagueKey)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal}).then(async response=>({ok:response.ok,payload:await response.json().catch(()=>null)})),
    fetch(`/api/football/weekly-awards?league=${encodeURIComponent(leagueKey)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:controller?.signal}).then(async response=>({ok:response.ok,payload:await response.json().catch(()=>null)})),
  ]).then(results=>{
    if(controller?.signal.aborted||sequence!==footballWeeklyFeaturesSequence||activeFootballLeague!==leagueKey) return null;
    const leaders=results[0].status==='fulfilled'&&results[0].value.ok?results[0].value.payload:null;
    const awards=results[1].status==='fulfilled'&&results[1].value.ok?results[1].value.payload:null;
    const stale=Boolean(leaders?.isStale||awards?.isStale),degraded=Boolean(leaders?.degraded||awards?.degraded);
    const verifiedEmpty=Boolean(leaders?.cacheStatus==='verified-empty'&&!awards?.star&&!awards?.teamOfWeek);
    FOOTBALL_WEEKLY_FEATURES={league:leagueKey,leaders,awards,status:leaders||awards?(degraded?'degraded':stale?'stale':verifiedEmpty?'verified-empty':'ready'):'error',error:leaders||awards?null:'weekly_features_unavailable'};
    if(typeof renderFootballWeeklyFeatures==='function') renderFootballWeeklyFeatures();
    return FOOTBALL_WEEKLY_FEATURES;
  }).catch(error=>{
    if(error?.name==='AbortError'||controller?.signal.aborted) return null;
    FOOTBALL_WEEKLY_FEATURES={league:leagueKey,leaders:null,awards:null,status:'error',error:error?.message||'weekly_features_unavailable'};
    if(typeof renderFootballWeeklyFeatures==='function') renderFootballWeeklyFeatures();
    return null;
  }).finally(()=>{if(footballWeeklyFeaturesRequest===request) footballWeeklyFeaturesRequest=null;});
  footballWeeklyFeaturesRequest=request;
  return request;
}
function abortFootballWeeklyFeatures(){
  footballWeeklyFeaturesController?.abort();
  footballWeeklyFeaturesController=null;
  footballWeeklyFeaturesRequest=null;
  footballWeeklyFeaturesSequence++;
}

let PREDICT_CHALLENGE_MATCHES = [];
let predictChallengeLoading = null;
let predictChallengeReady = false;
let predictChallengeFailures = [];
let predictChallengeScope = null;
let predictChallengeAbortController = null;
async function loadPredictChallengeSelection(){
  const requestedLeague=activeFootballLeague==='all'?'super-lig':footballLeagueRequestKey();
  if(predictChallengeLoading&&predictChallengeScope===requestedLeague) return predictChallengeLoading;
  if(predictChallengeAbortController) predictChallengeAbortController.abort();
  predictChallengeAbortController=typeof AbortController!=='undefined'?new AbortController():null;
  const controller=predictChallengeAbortController;
  predictChallengeScope=requestedLeague;
  const request=(async()=>{
    const bundle=await fetchProviderSeasonBundle(requestedLeague,{
      signal:controller?.signal,
      isActive:()=>predictChallengeScope===requestedLeague&&(typeof document==='undefined'||document.hidden!==true)
    });
    if(controller?.signal.aborted||predictChallengeScope!==requestedLeague) return PREDICT_CHALLENGE_MATCHES;
    predictChallengeFailures=bundle?[]:[requestedLeague];
    const now=Date.now();
    PREDICT_CHALLENGE_MATCHES=(bundle?.matches||[])
      .filter(match=>!footballStatusIsUnavailable(match)&&!footballStatusIsFinished(match)&&!footballStatusIsLive(match))
      .filter(match=>Date.parse(match.kickoff)>now+15*60000)
      .sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff))
      .slice(0,6)
      .map(match=>({...match,hafta:activeWeek,challengeLeague:requestedLeague}));
    PREDICT_CHALLENGE_MATCHES.forEach(match=>{ if(match?.ev&&safeExternalURL(match.home_logo)) TEAM_CRESTS[match.ev]=match.home_logo; if(match?.konuk&&safeExternalURL(match.away_logo)) TEAM_CRESTS[match.konuk]=match.away_logo; });
    predictChallengeReady=true;
    if(typeof renderProgress==='function') renderProgress();
    if(typeof renderLeagueMatches==='function') renderLeagueMatches();
    if(typeof renderWeeklyChallenge==='function') renderWeeklyChallenge();
    return PREDICT_CHALLENGE_MATCHES;
  })().finally(()=>{
    if(predictChallengeLoading===request){
      predictChallengeLoading=null;
      predictChallengeAbortController=null;
    }
  });
  predictChallengeLoading=request;
  return request;
}
function abortPredictChallengeSelection(){
  if(predictChallengeAbortController) predictChallengeAbortController.abort();
  predictChallengeAbortController=null;
  predictChallengeLoading=null;
  predictChallengeScope=null;
}

function selectCurrentWeek(matches){
  if(/^#week\/\d+$/.test(location.hash || '')) return;
  const ordered=[...matches].filter(match=>match.hafta && match.kickoff).sort((a,b)=>new Date(a.kickoff)-new Date(b.kickoff));
  if(!ordered.length) return;
  const next=ordered.find(match=>new Date(match.kickoff).getTime() >= Date.now());
  activeWeek=Number((next || ordered[ordered.length-1]).hafta) || activeWeek;
}

/* ===================== VERİ YÜKLEME ===================== */
async function requireQuery(promise, label){
  const { data, error } = await promise;
  if(error){
    console.error('[XYZSkor veri hatası]', label, error);
    throw new Error(label + ': ' + (error.message || error.code || 'bilinmeyen hata'));
  }
  return data || [];
}
async function moduleQuery(promise, label){
  try{
    const { data, error } = await promise;
    if(error) throw error;
    return data || [];
  }catch(error){
    DATA_ERRORS[label] = error && (error.message || error.code) ? (error.message || error.code) : 'bilinmeyen hata';
    console.warn('[XYZSkor modül verisi]', label, error);
    return [];
  }
}
function cachePredictions(rows){
  ALL_PREDICTIONS = {};
  rows.forEach(p=>{
    if(!ALL_PREDICTIONS[p.match_id]) ALL_PREDICTIONS[p.match_id] = {};
    ALL_PREDICTIONS[p.match_id][p.user_id] = { pick:p.pick, scoreHome:p.score_home, scoreAway:p.score_away, submittedAt:new Date(p.submitted_at).getTime() };
  });
}
function cacheProfiles(rows){
  PROFILES = {};
  rows.forEach(p => PROFILES[p.id] = p);
}

// Predict, futbol ana sayfasinin ortak veri zincirini kullanmaz. Yalniz gorunur
// Predict urunu icin odul metinleri ile oturum sahibinin kendi tahmin ve bu
// tahminlere ait sonuc satirlari hydrate edilir. Bu akisin ayri scope/sequence
// tutmasi, auth hazir olmadan baslayan /predict acilisinda once "misafir" sonra
// "uye" cevabinin birbirini ezmesini de engeller.
let predictOwnedContextRequest = null;
let predictOwnedContextController = null;
let predictOwnedContextSequence = 0;
let predictOwnedContextAppliedScope = null;
let predictOwnedContextObservedAuthScope = null;
let predictOwnedPredictionScope = null;
let predictOwnedContextLifecycleBound = false;

function predictOwnedContextScope(){ return getCurrentUser()?.id || 'guest'; }
function predictProductDemandActive(){
  if(typeof document==='undefined') return true;
  return document.hidden!==true && document.body?.classList?.contains('predict-product-open');
}
function predictOwnedQueryWithSignal(query,signal){
  return signal && query && typeof query.abortSignal==='function' ? query.abortSignal(signal) : query;
}
async function predictOwnedModuleQuery(query,label,signal){
  try{
    const {data,error}=await predictOwnedQueryWithSignal(query,signal);
    if(error) throw error;
    return {ok:true,rows:data||[]};
  }catch(error){
    if(signal?.aborted || error?.name==='AbortError') return {ok:false,aborted:true,rows:[]};
    DATA_ERRORS[label]=error&&(error.message||error.code)?(error.message||error.code):'bilinmeyen hata';
    console.warn('[XYZSkor Predict verisi]',label,error);
    return {ok:false,aborted:false,rows:[]};
  }
}
function applyPredictRewards(rows){
  REWARDS={};
  TEAMS.forEach(team=>{ REWARDS[team]=[{sira:1,aciklama:'—'},{sira:2,aciklama:'—'},{sira:3,aciklama:'—'}]; });
  (rows||[]).forEach(row=>{
    const rank=Number(row?.sira);
    if(REWARDS[row?.team]&&Number.isInteger(rank)&&rank>=1&&rank<=3) REWARDS[row.team][rank-1]={sira:rank,aciklama:row.aciklama||'—'};
  });
}
function renderPredictOwnedContext(){
  if(!predictProductDemandActive()) return;
  if(typeof refreshVisibleAccountViews==='function') refreshVisibleAccountViews();
  else{
    if(typeof renderNav==='function') renderNav();
    if(typeof renderProgress==='function') renderProgress();
    if(typeof renderRewards==='function') renderRewards();
    if(typeof renderProfile==='function'&&getCurrentUser()?.id) renderProfile();
  }
  if(typeof renderLeagueMatches==='function') renderLeagueMatches();
  if(typeof renderTeamBanner==='function') renderTeamBanner();
}
function predictOwnedContextIsCurrent(scope,sequence,signal){
  return !signal?.aborted&&sequence===predictOwnedContextSequence&&scope===predictOwnedContextScope()&&predictProductDemandActive();
}
function abortPredictOwnedContext(){
  predictOwnedContextSequence+=1;
  predictOwnedContextController?.abort?.();
  predictOwnedContextController=null;
  predictOwnedContextRequest=null;
}
function bindPredictOwnedContextLifecycle(){
  if(predictOwnedContextLifecycleBound||typeof document==='undefined') return;
  predictOwnedContextLifecycleBound=true;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden===true) abortPredictOwnedContext();
    else if(predictProductDemandActive()) loadPredictOwnedContext().catch(()=>{});
  });
}
async function loadPredictOwnedContext(options={}){
  bindPredictOwnedContextLifecycle();
  if(!predictProductDemandActive()) return false;
  if(!AUTH_CONTEXT_READY) await loadAccountContext();
  if(!predictProductDemandActive()) return false;

  const scope=predictOwnedContextScope();
  if(predictOwnedPredictionScope!==scope){
    // Bir hesabin RLS ile okunan tahminleri baska hesabin render state'inde bir
    // an bile kalmamali. Kamuya acik sonuc satirlari ise guvenle korunabilir.
    cachePredictions([]);
    predictOwnedPredictionScope=scope;
  }
  if(!options.force&&predictOwnedContextAppliedScope===scope){
    renderPredictOwnedContext();
    return true;
  }
  if(predictOwnedContextRequest?.scope===scope) return predictOwnedContextRequest.promise;

  abortPredictOwnedContext();
  const sequence=++predictOwnedContextSequence;
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const signal=controller?.signal;
  predictOwnedContextController=controller;
  const request=(async()=>{
    await ensureXYZSupabaseClient();
    if(!predictOwnedContextIsCurrent(scope,sequence,signal)) return false;
    const user=getCurrentUser();
    const rewardsQuery=sb.from('rewards').select('team,sira,aciklama,updated_at').order('team').order('sira');
    const predictionsQuery=user?.id
      ? sb.from('predictions').select('match_id,user_id,pick,score_home,score_away,submitted_at').eq('user_id',user.id).order('submitted_at',{ascending:false}).limit(200)
      : Promise.resolve({data:[],error:null});
    const [rewardResult,predictionResult]=await Promise.all([
      predictOwnedModuleQuery(rewardsQuery,'predict_rewards',signal),
      predictOwnedModuleQuery(predictionsQuery,'own_predictions',signal),
    ]);
    if(!predictOwnedContextIsCurrent(scope,sequence,signal)) return false;

    const predictionIds=[...new Set(predictionResult.rows.map(row=>String(row?.match_id||'')).filter(Boolean))];
    const resultResult=predictionResult.ok&&predictionIds.length
      ? await predictOwnedModuleQuery(sb.from('results').select('match_id,home,away,scored_at').in('match_id',predictionIds),'own_prediction_results',signal)
      : {ok:predictionResult.ok,rows:[]};
    if(!predictOwnedContextIsCurrent(scope,sequence,signal)) return false;

    if(rewardResult.ok) applyPredictRewards(rewardResult.rows);
    if(predictionResult.ok) cachePredictions(predictionResult.rows);
    if(resultResult.ok){
      resultResult.rows.forEach(row=>{
        if(!row?.match_id) return;
        ALL_RESULTS[row.match_id]={home:Number(row.home),away:Number(row.away),scoredAt:new Date(row.scored_at||Date.now()).getTime()};
      });
    }
    const complete=rewardResult.ok&&predictionResult.ok&&resultResult.ok;
    predictOwnedContextAppliedScope=complete?scope:null;
    renderPredictOwnedContext();
    return complete;
  })().finally(()=>{
    if(predictOwnedContextRequest?.promise===request) predictOwnedContextRequest=null;
    if(predictOwnedContextController===controller) predictOwnedContextController=null;
  });
  predictOwnedContextRequest={scope,promise:request};
  return request;
}
function handlePredictOwnedAuthContextReady(event){
  const nextScope=event?.detail?.userId||'guest';
  const changed=nextScope!==predictOwnedContextObservedAuthScope;
  predictOwnedContextObservedAuthScope=nextScope;
  if(changed){
    abortPredictOwnedContext();
    predictOwnedContextAppliedScope=null;
    if(predictOwnedPredictionScope!==nextScope){
      cachePredictions([]);
      predictOwnedPredictionScope=nextScope;
    }
  }
  if(!predictProductDemandActive()) return;
  if(changed) loadPredictOwnedContext({force:true}).catch(()=>{});
  else renderPredictOwnedContext();
}
if(typeof window!=='undefined'&&typeof window.addEventListener==='function') window.addEventListener('xyz:auth-context-ready',handlePredictOwnedAuthContextReady);

function leaderboardCacheKey(team, hafta, period){ return `${team}|${hafta}|${period}`; }
async function fetchServerLeaderboard(team, hafta, period){
  if(!SUPABASE_READY) await ensureXYZSupabaseClient();
  const key = leaderboardCacheKey(team, hafta, period);
  if(SERVER_LEADERBOARDS.has(key)) return SERVER_LEADERBOARDS.get(key);
  if(SERVER_LEADERBOARD_REQUESTS.has(key)) return SERVER_LEADERBOARD_REQUESTS.get(key);
  const request=(async()=>{
    const { data, error } = await sb.rpc('get_leaderboard', {
      p_week: hafta,
      p_team: team==='Genel' ? null : team,
      p_period: period,
      p_limit: 100
    });
    if(error) throw error;
    const rows = (data || []).map(row=>({
      uid:row.user_id, username:row.username, team:row.team,
      points:Number(row.points || 0), exact:Number(row.exact_scores || 0), correct:Number(row.correct_results || 0),
      completedAt:row.completed_at ? new Date(row.completed_at).getTime() : 0,
      position:Number(row.position || 0)
    }));
    SERVER_LEADERBOARDS.set(key, rows);
    return rows;
  })().finally(()=>SERVER_LEADERBOARD_REQUESTS.delete(key));
  SERVER_LEADERBOARD_REQUESTS.set(key,request);
  return request;
}
async function primeServerLeaderboards(hafta, requestedTeams=['Genel']){
  if(serverLeaderboardMode==='legacy') return false;
  try{
    const scopes = [...new Set(['Genel', ...(requestedTeams||[])].filter(Boolean))];
    await Promise.all(scopes.flatMap(team=>[
      fetchServerLeaderboard(team, hafta, 'week'),
      fetchServerLeaderboard(team, hafta, 'season')
    ]));
    serverLeaderboardMode = 'server';
    delete DATA_ERRORS.leaderboard;
    return true;
  }catch(error){
    const initialProbe = serverLeaderboardMode==='unknown';
    if(initialProbe) serverLeaderboardMode = 'legacy';
    DATA_ERRORS.leaderboard = error && (error.message || error.code) ? (error.message || error.code) : 'sunucu sıralaması kullanılamıyor';
    console.warn('[XYZSkor liderlik]', initialProbe ? 'Sunucu RPC bulunamadı; geçici eski veri akışı kullanılıyor.' : 'Sunucu sıralaması yenilenemedi; son başarılı veri korunuyor.', error);
    return false;
  }
}

async function loadLegacyLeaderboardData(){
  if(legacyLeaderboardRequest) return legacyLeaderboardRequest;
  legacyLeaderboardRequest=Promise.all([
    moduleQuery(sb.from('profiles').select('*'), 'profiles_legacy'),
    moduleQuery(sb.from('predictions').select('*'), 'predictions_legacy')
  ]).then(([legacyProfiles,legacyPredictions])=>{
    cacheProfiles(legacyProfiles);
    cachePredictions(legacyPredictions);
    if(currentUser && !PROFILES[currentUser.id]) PROFILES[currentUser.id]=currentUser;
    return true;
  }).catch(()=>false).finally(()=>{ legacyLeaderboardRequest=null; });
  return legacyLeaderboardRequest;
}
let COMMON_DATA_CACHE = null;
const COMMON_DATA_CACHE_MS = 5 * 60 * 1000;
function loadCommonData(){
  if(COMMON_DATA_CACHE && Date.now()-COMMON_DATA_CACHE.savedAt < COMMON_DATA_CACHE_MS) return COMMON_DATA_CACHE.promise;
  const promise=Promise.all([
    moduleQuery(sb.from('matches').select('*').order('kickoff'), 'matches'),
    moduleQuery(sb.from('match_analysis').select('*'), 'match_analysis'),
    moduleQuery(sb.from('results').select('*'), 'results'),
    moduleQuery(sb.from('rewards').select('*'), 'rewards'),
    moduleQuery(sb.from('league_standings').select('*').order('points',{ascending:false}), 'league_standings'),
    moduleQuery(sb.from('weekly_stories').select('*'), 'weekly_stories')
  ]).catch(error=>{ COMMON_DATA_CACHE=null; throw error; });
  COMMON_DATA_CACHE={savedAt:Date.now(),promise};
  return promise;
}

// Futbol ekraninin kritik yolu yalnizca lig saglayici paketidir. Hesap,
// oduller ve editoryal Supabase tablolari daha sonra hydrate edilebilir; bu
// sayede kullanici bos iskeleti ortak sorgular bitene kadar izlemek zorunda kalmaz.
function applyFootballCriticalBundle(providerBundle,requestedLeague){
  const providerMatches=mergeLiveFeedIntoProviderMatches(providerBundle?.matches?.length ? providerBundle.matches : [],requestedLeague);
  const providerStandings=providerBundle?.standings?.length ? providerBundle.standings : [];
  const providerResults=providerBundle?.results?.length ? providerBundle.results : [];
  if(requestedLeague==='all'){
    FOOTBALL_HOME_STANDINGS=providerBundle?.standingsByLeague||{};
    FOOTBALL_HOME_AVAILABILITY=providerBundle?.availability||{};
    Object.values(FOOTBALL_HOME_STANDINGS).flat().forEach(row=>{ if(row?.team&&safeExternalURL(row.team_logo)) TEAM_CRESTS[row.team]=row.team_logo; });
  }
  providerStandings.forEach(row=>{ if(row?.team&&safeExternalURL(row.team_logo)) TEAM_CRESTS[row.team]=row.team_logo; });
  providerMatches.forEach(match=>{
    if(match?.ev&&safeExternalURL(match.home_logo)) TEAM_CRESTS[match.ev]=match.home_logo;
    if(match?.konuk&&safeExternalURL(match.away_logo)) TEAM_CRESTS[match.konuk]=match.away_logo;
  });
  MATCHES=providerMatches;
  STANDINGS=providerStandings;
  ALL_RESULTS={};
  providerResults.forEach(row=>{ ALL_RESULTS[row.match_id]={home:row.home,away:row.away,scoredAt:new Date(row.scored_at||Date.now()).getTime()}; });
  providerMatches.forEach(match=>{ if(match?.result&&Number.isFinite(Number(match.result.home))&&Number.isFinite(Number(match.result.away))) ALL_RESULTS[match.id]={home:Number(match.result.home),away:Number(match.result.away),scoredAt:Date.now()}; });
  DATA_FRESHNESS.fromProvider=providerMatches.length>0;
  DATA_FRESHNESS.providerUpdatedAt=providerMatches.length ? (providerBundle?.updatedAt||null) : null;
  DATA_FRESHNESS.providerSource=providerMatches.length ? (providerBundle?.source||providerBundle?.provider||null) : null;
  selectCurrentWeek(MATCHES);
  return true;
}
async function loadFootballCriticalData(){
  const requestedLeague=footballLeagueRequestKey();
  if(footballCriticalRequest?.scope===requestedLeague&&!footballCriticalRequest.controller?.signal?.aborted) return footballCriticalRequest.promise;
  if(footballCriticalRequest?.controller) footballCriticalRequest.controller.abort();
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const loadSequence=++footballDataLoadSequence;
  const backgroundRequests=[];
  DATA_ERRORS={};
  const entry={scope:requestedLeague,controller,promise:null,ownerPromise:null};
  const promise=(async()=>{
    const providerBundle=requestedLeague==='all'
      ? await fetchFootballHomeBundle({signal:controller?.signal,isActive:()=>footballLeagueRequestKey()==='all'&&(typeof document==='undefined'||document.hidden!==true),onBackgroundRequest:request=>backgroundRequests.push(request)})
      : await fetchProviderSeasonBundle(requestedLeague,{signal:controller?.signal,isActive:()=>footballLeagueRequestKey()===requestedLeague&&(typeof document==='undefined'||document.hidden!==true)});
    if(controller?.signal.aborted||loadSequence!==footballDataLoadSequence||requestedLeague!==footballLeagueRequestKey()) return false;
    const applied=applyFootballCriticalBundle(providerBundle,requestedLeague);
    if(applied&&typeof document!=='undefined'&&document.body?.dataset.footballLeagueLoading===requestedLeague){
      delete document.body.dataset.footballLeagueLoading;
    }
    return applied;
  })();
  entry.promise=promise;
  // Stale cache ilk boyamayi hemen tamamlayabilir; fakat arka plan SWR isteginin
  // abort sahibi, o ag promise'i gercekten bitene kadar kaybolmamalidir.
  entry.ownerPromise=promise.then(async result=>{
    if(backgroundRequests.length) await Promise.allSettled(backgroundRequests);
    return result;
  }).finally(()=>{
    if(footballCriticalRequest===entry) footballCriticalRequest=null;
  });
  entry.ownerPromise.catch(()=>{});
  footballCriticalRequest=entry;
  return promise;
}
function abortFootballCriticalData(){
  footballDataLoadSequence+=1;
  footballCriticalRequest?.controller?.abort?.();
  if(typeof window!=='undefined'){
    window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__?.abort?.();
    window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__?.abort?.();
    window.__XYZ_FOOTBALL_HOME_ABORT_CONTROLLER__=null;
    window.__XYZ_FOOTBALL_SEASON_ABORT_CONTROLLER__=null;
    window.__XYZ_FOOTBALL_HOME_REQUEST__=null;
    window.__XYZ_FOOTBALL_SEASON_REQUEST__=null;
  }
}
async function loadAllData(){
  const loadSequence=++footballDataLoadSequence;
  const requestedLeague=footballLeagueRequestKey();
  DATA_ERRORS = {};
  const scopedSuperLig = isStrictSuperLigScope();
  // Lig paketi auth ve ortak Supabase tablolarından bağımsızdır. Bu istekleri
  // seri bekletmek lig geçişine doğrudan 1-2 saniye ekliyordu.
  const providerBundlePromise=requestedLeague==='all' ? fetchFootballHomeBundle() : fetchProviderSeasonBundle(requestedLeague);
  const supabaseClientPromise=ensureXYZSupabaseClient();
  await Promise.all([ensureSeasonFixtures(),supabaseClientPromise]);
  const commonDataPromise=loadCommonData();
  const session = await getCachedAuthSession();
  const ownProfileQuery = session ? sb.from('profiles').select('*').eq('id', session.user.id) : Promise.resolve({data:[],error:null});
  const ownPredictionsQuery = session ? sb.from('predictions').select('*').eq('user_id', session.user.id) : Promise.resolve({data:[],error:null});
  const [commonData, ownProfiles, ownPredictions, providerBundle] = await Promise.all([
    commonDataPromise,
    moduleQuery(ownProfileQuery, 'own_profile'),
    moduleQuery(ownPredictionsQuery, 'own_predictions'),
    providerBundlePromise
  ]);
  if(loadSequence!==footballDataLoadSequence || requestedLeague!==footballLeagueRequestKey()) return false;
  const [matches, analysisRows, results, rewards, standings, stories] = commonData;
  const providerMatches = mergeLiveFeedIntoProviderMatches(providerBundle?.matches?.length ? providerBundle.matches : [],requestedLeague);
  const providerStandings = providerBundle?.standings?.length ? providerBundle.standings : [];
  const providerResults = providerBundle?.results?.length ? providerBundle.results : [];
  if(requestedLeague==='all'){
    FOOTBALL_HOME_STANDINGS=providerBundle?.standingsByLeague||{};
    FOOTBALL_HOME_AVAILABILITY=providerBundle?.availability||{};
    Object.values(FOOTBALL_HOME_STANDINGS).flat().forEach(row=>{ if(row?.team&&safeExternalURL(row.team_logo)) TEAM_CRESTS[row.team]=row.team_logo; });
  }
  providerStandings.forEach(row=>{ if(row?.team && safeExternalURL(row.team_logo)) TEAM_CRESTS[row.team]=row.team_logo; });
  providerMatches.forEach(match=>{
    if(match?.ev && safeExternalURL(match.home_logo)) TEAM_CRESTS[match.ev]=match.home_logo;
    if(match?.konuk && safeExternalURL(match.away_logo)) TEAM_CRESTS[match.konuk]=match.away_logo;
  });
  MATCHES = providerMatches.length ? providerMatches : (scopedSuperLig ? matches : []);
  /* Tazelik etiketi gercek kaynagi yansitsin (bkz. fixtureFreshness). */
  DATA_FRESHNESS.fromProvider = providerMatches.length > 0;
  DATA_FRESHNESS.providerUpdatedAt = providerMatches.length ? (providerBundle?.updatedAt || null) : null;
  DATA_FRESHNESS.providerSource = providerMatches.length ? (providerBundle?.source || providerBundle?.provider || null) : null;
  selectCurrentWeek(MATCHES);
  ANALYSIS = {}; analysisRows.forEach(r => ANALYSIS[r.match_id] = r.data || {});
  cacheProfiles(ownProfiles);
  cachePredictions(ownPredictions);
  ALL_RESULTS = {};
  [...(scopedSuperLig ? results : []), ...providerResults].forEach(r=> ALL_RESULTS[r.match_id] = { home:r.home, away:r.away, scoredAt:new Date(r.scored_at || Date.now()).getTime() });
  REWARDS = {}; TEAMS.forEach(t => REWARDS[t] = [{sira:1,aciklama:'—'},{sira:2,aciklama:'—'},{sira:3,aciklama:'—'}]);
  rewards.forEach(r=>{ if(REWARDS[r.team]) REWARDS[r.team][r.sira-1] = {sira:r.sira, aciklama:r.aciklama}; });
  STANDINGS = providerStandings.length ? providerStandings : (scopedSuperLig ? standings : []);
  WEEKLY_STORIES = {};
  if(scopedSuperLig){
    stories.forEach(s => WEEKLY_STORIES[s.week] = s);
  }
  if(session){
    let profile = PROFILES[session.user.id] || null;
    if(!profile){
      try{
        profile = await ensureOwnProfile(session.user);
        if(profile) PROFILES[profile.id] = profile;
      }catch(e){ console.error('[XYZSkor veri hatası] eksik profil oluşturulamadı', e); }
    }
    currentUser = mergeProfileWithSession(profile, session.user);
  } else currentUser = null;
  AUTH_CONTEXT_READY=true;
  if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined'){
    window.dispatchEvent(new CustomEvent('xyz:auth-context-ready',{detail:{userId:currentUser?.id||null}}));
  }
  // Liderlik verisi futbol sayfasının kritik yolu değildir. Predict/Sıralama
  // görünümü açıldığında yalnız gerekli kapsamlar lazy olarak yüklenir.
  return true;
}

/* ===================== AUTH ===================== */
function authErrTR(error){
  const m = error.message || '';
  if(/email address not authorized/i.test(m)) return 'Bu proje henüz üretim SMTP servisine bağlı değil; doğrulama e-postası yalnız proje ekibi adreslerine gönderilebilir.';
  if(/rate limit|too many requests|email rate limit exceeded/i.test(m)) return 'E-posta gönderim sınırı doldu. Üretim SMTP bağlantısı kurulmadan yeni doğrulama e-postası gönderilemiyor.';
  if(m.includes('already registered') || m.includes('already exists')) return 'Bu e-posta zaten kayıtlı.';
  if(m.includes('Password') || m.includes('password')) return 'Şifre en az 6 karakter olmalı.';
  if(m.includes('duplicate') || m.includes('username')) return 'Bu kullanıcı adı alınmış.';
  return m || 'Bir hata oluştu.';
}
async function registerUser(username, email, pass, team, marketingOptIn=false){
  await ensureXYZSupabaseClient();
  const acceptedAt = new Date().toISOString();
  const { data, error } = await sb.auth.signUp({
    email,
    password: pass,
    options:{
      emailRedirectTo: `${location.origin}/?auth=confirmed`,
      data:{
        username,
        team,
        terms_version:'2026-08-11',
        terms_accepted_at:acceptedAt,
        privacy_notice_version:'2026-08-11',
        marketing_opt_in:Boolean(marketingOptIn),
        marketing_opt_in_at:marketingOptIn ? acceptedAt : null,
      },
    },
  });
  if(error) return { ok:false, err: authErrTR(error) };
  const uid = data.user ? data.user.id : null;
  if(!uid) return { ok:false, err:'Kullanıcı hesabı oluşturulamadı.' };
  if(!data.session) return { ok:true, pending:true, message:'Kayıt alındı. Doğrulama e-postanı ve Spam/Gereksiz klasörünü kontrol et; gelmezse aşağıdaki yeniden gönder düğmesini kullan.' };
  try{ await ensureOwnProfile(data.user); }
  catch(pErr){ return { ok:false, err: authErrTR(pErr) }; }
  return { ok:true };
}
async function resendSignupConfirmation(email){
  await ensureXYZSupabaseClient();
  if(!email) return { ok:false, err:'E-posta adresi gerekli.' };
  const { error } = await sb.auth.resend({
    type:'signup',
    email,
    options:{ emailRedirectTo:`${location.origin}/?auth=confirmed` },
  });
  return error ? { ok:false, err:authErrTR(error) } : { ok:true, message:'Doğrulama e-postası yeniden gönderildi. Spam klasörünü de kontrol et.' };
}
async function ensureOwnProfile(user){
  if(!user) return null;
  const { data: existing, error: readError } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if(readError) throw readError;
  if(existing) return existing;
  const meta = user.user_metadata || {};
  if(!meta.username || !TEAMS.includes(meta.team)) return null;
  const { data: created, error: createError } = await sb.from('profiles').insert({ id:user.id, username:meta.username, team:meta.team }).select().single();
  if(createError) throw createError;
  return created;
}
async function loginUser(email, pass){
  await ensureXYZSupabaseClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error) return { ok:false, err:'E-posta veya şifre hatalı.' };
  try{ await ensureOwnProfile(data.user); }
  catch(e){ await sb.auth.signOut(); return { ok:false, err:'Profil hazırlanamadı: '+authErrTR(e) }; }
  return { ok:true };
}
async function logoutUser(){ await ensureXYZSupabaseClient(); await sb.auth.signOut(); }
async function changeTeam(newTeam){
  await ensureXYZSupabaseClient();
  const u = getCurrentUser();
  if(!u || u.team_changed || !TEAMS.includes(newTeam) || newTeam===u.team) return false;
  const rpc = await sb.rpc('change_team_once', { new_team:newTeam });
  if(!rpc.error) return true;
  if(!String(rpc.error.code || '').startsWith('PGRST')) return false;
  const fallback = await sb.from('profiles').update({ team:newTeam, team_changed:true }).eq('id', u.id);
  return !fallback.error;
}
async function fetchMemberAdminConsole(search=''){
  await ensureXYZSupabaseClient();
  if(!SUPABASE_READY) return { ok:false, rows:[], err:SUPABASE_UNAVAILABLE_MESSAGE };
  const u = getCurrentUser();
  if(!u || !u.is_admin) return { ok:false, rows:[], err:'Bu alan için admin girişi gerekli.' };
  const { data, error } = await sb.rpc('list_member_admin_console', {
    p_search: search ? String(search).trim() : null,
    p_limit: 80
  });
  if(error) return { ok:false, rows:[], err:error.message || 'Üye listesi alınamadı.' };
  return { ok:true, rows:data || [] };
}
async function setMemberAdminRole(userId, isAdmin, editorialRole, active=true){
  await ensureXYZSupabaseClient();
  if(!SUPABASE_READY) return { ok:false, err:SUPABASE_UNAVAILABLE_MESSAGE };
  const u = getCurrentUser();
  if(!u || !u.is_admin) return { ok:false, err:'Bu işlem için admin girişi gerekli.' };
  const { data, error } = await sb.rpc('set_member_admin_role', {
    p_user_id: userId,
    p_is_admin: !!isAdmin,
    p_editorial_role: editorialRole || null,
    p_active: !!active
  });
  if(error) return { ok:false, err:error.message || 'Yetki güncellenemedi.' };
  return { ok:true, row:Array.isArray(data) ? data[0] : data };
}

/* ===================== TAHMİN OKU/YAZ ===================== */
function getPrediction(matchId, uid){ return (ALL_PREDICTIONS[matchId] && ALL_PREDICTIONS[matchId][uid]) || null; }
function getResult(matchId){ return ALL_RESULTS[matchId] || null; }
async function savePrediction(matchId, payload){
  await ensureXYZSupabaseClient();
  const u = getCurrentUser(); if(!u) return { ok:false };
  const match = [...PREDICT_CHALLENGE_MATCHES,...MATCHES].find(m=>m.id===matchId);
  if(!match) return { ok:false, err:'Maç bulunamadı.' };
  if(match.status==='iptal' || match.status==='ertelendi') return { ok:false, err:'Bu maç için tahmin alınmıyor.' };
  if(isLocked(match.kickoff)) return { ok:false, err:'Bu maç için tahmin süresi doldu.' };
  if(!['1','X','2'].includes(payload.pick)) return { ok:false, err:'Geçerli bir maç sonucu seç.' };
  const hasHomeScore = payload.scoreHome != null;
  const hasAwayScore = payload.scoreAway != null;
  if(hasHomeScore !== hasAwayScore) return { ok:false, err:'Skor tahmini için iki takımın skorunu da gir.' };
  if(hasHomeScore && (![payload.scoreHome,payload.scoreAway].every(Number.isInteger) || payload.scoreHome<0 || payload.scoreAway<0 || payload.scoreHome>99 || payload.scoreAway>99)){
    return { ok:false, err:'Skorlar 0 ile 99 arasında tam sayı olmalı.' };
  }
  const submittedAt = new Date();
  const session=await sb.auth.getSession();
  const token=session?.data?.session?.access_token||'';
  const response=await fetch('/api/football/prediction',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({fixture_id:String(match.provider_fixture_id||match.fixture_id||match.id).replace(/^sportmonks:/,''),pick:payload.pick,score_home:payload.scoreHome,score_away:payload.scoreAway,challenge_league:match.challengeLeague||null})});
  const savedPayload=await response.json().catch(()=>({}));
  const error=response.ok?null:{message:savedPayload.message||savedPayload.error||'Tahmin kaydedilemedi.'};
  if(!error){
    if(!ALL_PREDICTIONS[matchId]) ALL_PREDICTIONS[matchId]={};
    ALL_PREDICTIONS[matchId][u.id]={pick:payload.pick,scoreHome:payload.scoreHome,scoreAway:payload.scoreAway,submittedAt:submittedAt.getTime()};
  }
  return { ok: !error, err: error && error.message };
}

/* ===================== ADMIN: SONUÇ / ÖDÜL YAZMA ===================== */
async function setResult(matchId, home, away){
  await ensureXYZSupabaseClient();
  if(!MATCHES.some(m=>m.id===matchId) || ![home,away].every(n=>Number.isInteger(n) && n>=0 && n<=99)) return false;
  const { error } = await sb.from('results').upsert({ match_id: matchId, home, away, scored_at: new Date().toISOString() });
  return !error;
}
async function saveRewardsData(newRewards){
  await ensureXYZSupabaseClient();
  const rows = [];
  TEAMS.forEach(t => newRewards[t].forEach(r => rows.push({ team:t, sira:r.sira, aciklama:r.aciklama })));
  const { error } = await sb.from('rewards').upsert(rows, { onConflict:'team,sira' });
  return !error;
}

/* ===================== PUANLAMA ===================== */
function computeMatchPoints(pred, result){
  if(!pred || !result) return {toplam:0, sonuc:false, kesinSkor:false};
  const actualPick = result.home > result.away ? '1' : result.home < result.away ? '2' : 'X';
  let puan=0, sonuc=false, kesinSkor=false;
  if(pred.pick === actualPick){ puan += 3; sonuc = true; }
  if(pred.scoreHome!=null && pred.scoreAway!=null){
    if(pred.scoreHome===result.home && pred.scoreAway===result.away){ puan += 5; kesinSkor = true; }
    else if(pred.pick !== actualPick){
      const pd = pred.scoreHome - pred.scoreAway, ad = result.home - result.away;
      if(pd === ad) puan += 1;
    }
  }
  return {toplam:puan, sonuc, kesinSkor};
}
function weekMatchIds(hafta){ const challenge=typeof PREDICT_CHALLENGE_MATCHES!=='undefined'?PREDICT_CHALLENGE_MATCHES:[]; const source=challenge.length?challenge:MATCHES; return source.filter(m=>m.hafta===hafta).map(m=>m.id); }
function userStatsForWeek(uid, hafta){
  const ids = weekMatchIds(hafta);
  let toplam=0, sonucSayisi=0, kesinSkorSayisi=0, tahminSayisi=0, sonuclananTahminSayisi=0, tamamlaZaman=0;
  ids.forEach(id=>{
    const p = ALL_PREDICTIONS[id] && ALL_PREDICTIONS[id][uid];
    if(p){ tahminSayisi++; tamamlaZaman = Math.max(tamamlaZaman, p.submittedAt); }
    const r = ALL_RESULTS[id];
    if(p && r){ sonuclananTahminSayisi++; const pts = computeMatchPoints(p, r); toplam += pts.toplam; if(pts.sonuc) sonucSayisi++; if(pts.kesinSkor) kesinSkorSayisi++; }
  });
  if(tahminSayisi === ids.length && ids.length>0) toplam += 2;
  if(ids.length===6 && sonuclananTahminSayisi===6 && sonucSayisi===6) toplam += 25;
  return {toplam, sonucSayisi, kesinSkorSayisi, tahminSayisi, sonuclananTahminSayisi, toplamMac: ids.length, tamamlaZaman};
}
function lifetimeStats(uid){
  const weeks = [...new Set(MATCHES.map(m=>m.hafta))];
  let toplam=0, sonuc=0, kesinSkor=0, tahmin=0, sonuclananTahmin=0, katilimHafta=0, tamamlaZaman=0;
  weeks.forEach(h=>{ const s = userStatsForWeek(uid, h); if(s.tahminSayisi>0) katilimHafta++; toplam+=s.toplam; sonuc+=s.sonucSayisi; kesinSkor+=s.kesinSkorSayisi; tahmin+=s.tahminSayisi; sonuclananTahmin+=s.sonuclananTahminSayisi; tamamlaZaman=Math.max(tamamlaZaman,s.tamamlaZaman); });
  const dogruYuzde = sonuclananTahmin>0 ? Math.round((sonuc/sonuclananTahmin)*100) : 0;
  return {toplam, sonuc, kesinSkor, tahmin, sonuclananTahmin, katilimHafta, dogruYuzde, tamamlaZaman};
}
function leaderboardFor(team, hafta){
  if(serverLeaderboardMode==='server'){
    const weekRows = SERVER_LEADERBOARDS.get(leaderboardCacheKey(team, hafta, 'week')) || [];
    const seasonRows = SERVER_LEADERBOARDS.get(leaderboardCacheKey(team, hafta, 'season')) || [];
    const merged = new Map();
    weekRows.forEach(row=>merged.set(row.uid, {
      username:row.username, team:row.team, uid:row.uid,
      weekPts:row.points, total:0, weekKesinSkor:row.exact, weekSonuc:row.correct,
      kesinSkor:0, sonuc:0, weekTamamlaZaman:row.completedAt, seasonTamamlaZaman:0
    }));
    seasonRows.forEach(row=>{
      const current=merged.get(row.uid) || {username:row.username,team:row.team,uid:row.uid,weekPts:0,weekKesinSkor:0,weekSonuc:0,weekTamamlaZaman:0};
      Object.assign(current,{total:row.points,kesinSkor:row.exact,sonuc:row.correct,seasonTamamlaZaman:row.completedAt});
      merged.set(row.uid,current);
    });
    return [...merged.values()];
  }
  const rows = Object.values(PROFILES).filter(p => team==='Genel' || p.team===team).map(p=>{
    const s = userStatsForWeek(p.id, hafta); const life = lifetimeStats(p.id);
    return {username:p.username, team:p.team, uid:p.id, weekPts:s.toplam, total:life.toplam, weekKesinSkor:s.kesinSkorSayisi, weekSonuc:s.sonucSayisi, kesinSkor:life.kesinSkor, sonuc:life.sonuc, weekTamamlaZaman:s.tamamlaZaman, seasonTamamlaZaman:life.tamamlaZaman};
  });
  return rows;
}
function sortRows(rows, period){
  const key = period==='week' ? 'weekPts' : 'total';
  const exactKey = period==='week' ? 'weekKesinSkor' : 'kesinSkor';
  const resultKey = period==='week' ? 'weekSonuc' : 'sonuc';
  const timeKey = period==='week' ? 'weekTamamlaZaman' : 'seasonTamamlaZaman';
  return [...rows].sort((a,b)=>{
    if(b[key] !== a[key]) return b[key]-a[key];
    if(b[exactKey] !== a[exactKey]) return b[exactKey] - a[exactKey];
    if(b[resultKey] !== a[resultKey]) return b[resultKey] - a[resultKey];
    return (a[timeKey]||Infinity) - (b[timeKey]||Infinity);
  });
}

/* ===================== ROZET / SEVİYE ===================== */
function computeBadges(uid){
  const life = lifetimeStats(uid); const badges = [];
  if(life.tahmin>0) badges.push('İlk Tahmin');
  if(life.kesinSkor>=5) badges.push('Kesin Skor Uzmanı');
  if(life.sonuc>=5) badges.push('5 Doğru Tahmin');
  MATCHES.map(m=>m.hafta).filter((v,i,a)=>a.indexOf(v)===i).forEach(h=>{
    const s = userStatsForWeek(uid, h); if(s.tahminSayisi===s.toplamMac && s.toplamMac>0) badges.push('Haftayı Eksiksiz Tamamladı');
  });
  return [...new Set(badges)];
}
function levelFor(totalPts){ return Math.floor(totalPts/20) + 1; }

bindAuthStateSync();
