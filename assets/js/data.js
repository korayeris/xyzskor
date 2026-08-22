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
const sb = (() => {
  try{
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    console.warn('[XYZSkor] supabase-js yüklenemedi; hesap özellikleri devre dışı, futbol içeriği çalışmaya devam edecek.');
    return createSupabaseFallbackClient('Hesap servisi kütüphanesi yüklenemedi.');
  }catch(error){
    console.warn('[XYZSkor] Supabase istemcisi kurulamadı:', error?.message || error);
    return createSupabaseFallbackClient('Hesap servisi başlatılamadı.');
  }
})();
/* Diğer katmanlar bu bayrakla Supabase'e bağlı UI'yi gizleyebilir. */
const SUPABASE_READY = !sb.__fallback;

let authStateTimer = null;
let authStateUnsubscribe = null;

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
  refreshMs: 5000
};
const PROVIDER_SEASON_CACHE_MS = 120000;
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
  footballCoverageRequest=(async()=>{
    try{
      const response=await fetch('/api/football/coverage',{headers:{Accept:'application/json'}});
      const payload=await response.json().catch(()=>null);
      if(!response.ok || !Array.isArray(payload?.selected)) throw new Error('coverage_unavailable');
      FOOTBALL_COVERAGE_CACHE={
        leagues:new Map(payload.selected.map(row=>[String(row.league),{available:row.available===true,currentSeasonId:row.currentSeasonId||null,reason:row.reason||null,capabilities:row.capabilities||null}])),
        updatedAt:payload.updatedAt||null,
        expiresAt:Date.now()+FOOTBALL_COVERAGE_CACHE_MS
      };
      return FOOTBALL_COVERAGE_CACHE;
    }catch(_error){
      // Coverage yardimci bir katmandir. 5xx veya ag hatasi lig akisini engellemez.
      footballCoverageRetryAt=Date.now()+FOOTBALL_COVERAGE_FAILURE_BACKOFF_MS;
      return null;
    }finally{ footballCoverageRequest=null; }
  })();
  return footballCoverageRequest;
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
const PREDICT_REWARD_TIERS = [
  {key:'rookie',name:'Çaylak',min:0,max:9,reward:'Dijital rozet',budget:'Fiziksel ödül yok',image:null},
  {key:'bronze',name:'Bronz',min:10,max:19,reward:'Aylık çekiliş hakkı',budget:'Mythos tek paket havuzu',image:'https://cdn.mythos.cards/imgs/Image_639174871080078636_.webp'},
  {key:'silver',name:'Gümüş',min:20,max:34,reward:'1 Mythos kart paketi',budget:'Aylık Gümüş ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639201437618030532_.webp'},
  {key:'gold',name:'Altın',min:35,max:49,reward:'Pulse / First bundle çekilişi',budget:'Aylık Altın ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639201436045954862_.webp'},
  {key:'diamond',name:'Elmas',min:50,max:64,reward:'Metal kutu çekilişi',budget:'Aylık Elmas ödül havuzu',image:'https://cdn.mythos.cards/imgs/Image_639174871186017847_.webp'},
  {key:'champion',name:'Şampiyon',min:65,max:null,reward:'Premium kutu final çekilişi',budget:'Aylık stok ve sponsor bütçesiyle sınırlı',image:'https://cdn.mythos.cards/imgs/Image_639201415658509192_.webp'}
];
function renderMythosProducts(){
  const grid=document.getElementById('mythosProductGrid'); if(!grid) return;
  const editorial={Galatasaray:'Şampiyonluk kültürünü, yıldız oyuncuları ve sezonun unutulmaz anlarını koleksiyon tasarımıyla bir araya getiriyor.',Beşiktaş:'Siyah-beyaz mirası, ikonik oyuncuları ve tribün hafızasını özel baskı koleksiyon kartlarına taşıyor.',Trabzonspor:'Bordo-mavili kimliği, genç yetenekleri ve kulübün güçlü futbol hikâyesini modern bir koleksiyonda buluşturuyor.'};
  grid.innerHTML=(MYTHOS_PRODUCTS[activeMythosTeam]||[]).map(p=>`<article class="official-product"><div class="official-product-image"><img src="${p.image}" alt="${p.name}" loading="lazy"></div><div class="official-product-body"><span class="official-product-kicker">${p.year}</span><h3>${p.name}</h3><p class="official-product-desc">${p.desc||editorial[activeMythosTeam]||'Futbol kültürünü özenli baskı ve koleksiyon değeriyle bir araya getiren resmî Mythos sponsor ödülü.'}</p><div class="official-product-reward">${p.reward}</div><ul class="product-features">${p.features.map(f=>`<li>${f}</li>`).join('')}</ul><span class="product-link">Kazanana ücretsiz hediye</span></div></article>`).join('');
  document.querySelectorAll('.product-team-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.team===activeMythosTeam));
}
function selectMythosTeam(team){ activeMythosTeam=team; renderMythosProducts(); }

/* PRODUCTION_STRIP_LEGACY_JS_END */

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
let WEEKLY_STORIES = {};
let currentUser = null;
let tickerHandle = null;
let liveFeedHandle = null;
let liveFeedLoading = false;
let LIVE_FEED = { matches:[], updatedAt:null, stale:false, error:null, loaded:false };
let lastLoadError = null;
let DATA_ERRORS = {};
let activeWeek = 1;
let activeFootballTeam = 'Tümü';
let activeFootballLeague = (()=>{
  const routed=typeof document!=='undefined' ? document.body?.dataset?.footballLeagueLoading : '';
  return SELECTED_COMPETITIONS.some(item=>item.key===routed) ? routed : 'super-lig';
})();
let SERVER_LEADERBOARDS = new Map();
let serverLeaderboardMode = 'unknown';
let seasonFixturesReady = new Set();

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
function refreshAuthState(){
  if(authStateTimer){
    clearTimeout(authStateTimer);
  }
  authStateTimer = setTimeout(async () => {
    authStateTimer = null;
    try{
      await loadAllData();
      if(typeof renderAll === 'function') renderAll();
    }catch(error){
      console.error('[XYZSkor] auth değişim sonrası oturum senkronizasyonu başarısız:', error);
    }
  }, 100);
}
function bindAuthStateSync(){
  if(!SUPABASE_READY || typeof sb?.auth?.onAuthStateChange !== 'function' || authStateUnsubscribe) return;
  try{
    const { data } = sb.auth.onAuthStateChange((_event, _session) => {
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

async function fetchProviderSeasonBundle(leagueKey){
  if(!leagueKey || leagueKey==='all') return null;
  const cacheKey = `xyzskor:provider-season:${leagueKey}`;
  try{
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if(cached && cached.savedAt && Date.now()-cached.savedAt < PROVIDER_SEASON_CACHE_MS) return cached.payload;
  }catch(_error){}
  try{
    const response = await fetch(`${PROVIDER_LIVE_FALLBACK}/season?league=${encodeURIComponent(leagueKey)}`,{headers:{Accept:'application/json'},cache:'no-store'});
    const payload = await response.json().catch(()=>null);
    if(!response.ok || !payload || payload.league!==leagueKey || !Array.isArray(payload.matches)) return null;
    try{ sessionStorage.setItem(cacheKey, JSON.stringify({savedAt:Date.now(),payload})); }catch(_error){}
    return payload;
  }catch(error){
    DATA_ERRORS.provider = error && error.message ? error.message : 'Sportmonks sağlayıcı yedeği kullanılamıyor.';
    return null;
  }
}

let PREDICT_CHALLENGE_MATCHES = [];
let predictChallengeLoading = null;
let predictChallengeReady = false;
let predictChallengeFailures = [];
async function loadPredictChallengeSelection(){
  if(predictChallengeLoading) return predictChallengeLoading;
  predictChallengeLoading=(async()=>{
    const leagues=['super-lig','premier-league','la-liga'];
    const bundles=await Promise.all(leagues.map(key=>fetchProviderSeasonBundle(key)));
    predictChallengeFailures=leagues.filter((key,index)=>!bundles[index]);
    const now=Date.now();
    PREDICT_CHALLENGE_MATCHES=bundles.flatMap((bundle,index)=>{
      const key=leagues[index];
      return (bundle?.matches||[]).filter(match=>!['iptal','ertelendi','bitti','canlı','devre_arasi'].includes(String(match.status||'').toLocaleLowerCase('tr-TR'))).filter(match=>Date.parse(match.kickoff)>now+15*60000).sort((a,b)=>Date.parse(a.kickoff)-Date.parse(b.kickoff)).slice(0,2).map(match=>({...match,hafta:activeWeek,challengeLeague:key}));
    });
    PREDICT_CHALLENGE_MATCHES.forEach(match=>{ if(match?.ev&&safeExternalURL(match.home_logo)) TEAM_CRESTS[match.ev]=match.home_logo; if(match?.konuk&&safeExternalURL(match.away_logo)) TEAM_CRESTS[match.konuk]=match.away_logo; });
    predictChallengeReady=true;
    if(typeof renderProgress==='function') renderProgress();
    if(typeof renderLeagueMatches==='function') renderLeagueMatches();
    if(typeof renderWeeklyChallenge==='function') renderWeeklyChallenge();
    return PREDICT_CHALLENGE_MATCHES;
  })().finally(()=>{ predictChallengeLoading=null; });
  return predictChallengeLoading;
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
function leaderboardCacheKey(team, hafta, period){ return `${team}|${hafta}|${period}`; }
async function fetchServerLeaderboard(team, hafta, period){
  const key = leaderboardCacheKey(team, hafta, period);
  if(SERVER_LEADERBOARDS.has(key)) return SERVER_LEADERBOARDS.get(key);
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
}
async function primeServerLeaderboards(hafta){
  if(serverLeaderboardMode==='legacy') return false;
  try{
    if(serverLeaderboardMode==='unknown') await fetchServerLeaderboard('Genel', hafta, 'week');
    const scopes = ['Genel', ...TEAMS];
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
async function loadAllData(){
  DATA_ERRORS = {};
  SERVER_LEADERBOARDS = new Map();
  serverLeaderboardMode = 'unknown';
  const scopedSuperLig = isStrictSuperLigScope();
  let session = null;
  try{
    const authRes = await sb.auth.getSession();
    session = authRes && authRes.data ? authRes.data.session : null;
  }catch(e){ console.error('[XYZSkor veri hatası] auth.getSession', e); }
  await ensureSeasonFixtures();
  const ownProfileQuery = session ? sb.from('profiles').select('*').eq('id', session.user.id) : Promise.resolve({data:[],error:null});
  const ownPredictionsQuery = session ? sb.from('predictions').select('*').eq('user_id', session.user.id) : Promise.resolve({data:[],error:null});
  const [matches, analysisRows, ownProfiles, ownPredictions, results, rewards, standings, stories] = await Promise.all([
    moduleQuery(sb.from('matches').select('*').order('kickoff'), 'matches'),
    moduleQuery(sb.from('match_analysis').select('*'), 'match_analysis'),
    moduleQuery(ownProfileQuery, 'own_profile'),
    moduleQuery(ownPredictionsQuery, 'own_predictions'),
    moduleQuery(sb.from('results').select('*'), 'results'),
    moduleQuery(sb.from('rewards').select('*'), 'rewards'),
    moduleQuery(sb.from('league_standings').select('*').order('points',{ascending:false}), 'league_standings'),
    moduleQuery(sb.from('weekly_stories').select('*'), 'weekly_stories')
  ]);
  const providerBundle = await fetchProviderSeasonBundle(activeFootballLeague);
  const providerMatches = providerBundle?.matches?.length ? providerBundle.matches : [];
  const providerStandings = providerBundle?.standings?.length ? providerBundle.standings : [];
  const providerResults = providerBundle?.results?.length ? providerBundle.results : [];
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
  const serverReady = await primeServerLeaderboards(activeWeek);
  if(!serverReady){
    const [legacyProfiles, legacyPredictions] = await Promise.all([
      moduleQuery(sb.from('profiles').select('*'), 'profiles_legacy'),
      moduleQuery(sb.from('predictions').select('*'), 'predictions_legacy')
    ]);
    cacheProfiles(legacyProfiles);
    cachePredictions(legacyPredictions);
    if(currentUser && !PROFILES[currentUser.id]) PROFILES[currentUser.id] = currentUser;
  }
}

/* ===================== AUTH ===================== */
function authErrTR(error){
  const m = error.message || '';
  if(m.includes('already registered') || m.includes('already exists')) return 'Bu e-posta zaten kayıtlı.';
  if(m.includes('Password') || m.includes('password')) return 'Şifre en az 6 karakter olmalı.';
  if(m.includes('duplicate') || m.includes('username')) return 'Bu kullanıcı adı alınmış.';
  return m || 'Bir hata oluştu.';
}
async function registerUser(username, email, pass, team, marketingOptIn=false){
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
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if(error) return { ok:false, err:'E-posta veya şifre hatalı.' };
  try{ await ensureOwnProfile(data.user); }
  catch(e){ await sb.auth.signOut(); return { ok:false, err:'Profil hazırlanamadı: '+authErrTR(e) }; }
  return { ok:true };
}
async function logoutUser(){ await sb.auth.signOut(); }
async function changeTeam(newTeam){
  const u = getCurrentUser();
  if(!u || u.team_changed || !TEAMS.includes(newTeam) || newTeam===u.team) return false;
  const rpc = await sb.rpc('change_team_once', { new_team:newTeam });
  if(!rpc.error) return true;
  if(!String(rpc.error.code || '').startsWith('PGRST')) return false;
  const fallback = await sb.from('profiles').update({ team:newTeam, team_changed:true }).eq('id', u.id);
  return !fallback.error;
}
async function fetchMemberAdminConsole(search=''){
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
  if(!MATCHES.some(m=>m.id===matchId) || ![home,away].every(n=>Number.isInteger(n) && n>=0 && n<=99)) return false;
  const { error } = await sb.from('results').upsert({ match_id: matchId, home, away, scored_at: new Date().toISOString() });
  return !error;
}
async function saveRewardsData(newRewards){
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
