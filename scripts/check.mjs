import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const documentHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../assets/css/app.css', import.meta.url), 'utf8');
const scriptFiles = ['data.js', 'analytics.js', 'live.js', 'match-center.js', 'matchday-live.js', 'predict-game.js', 'ui.js', 'chat.js'];
const scriptSources = await Promise.all(scriptFiles.map((file) => readFile(new URL(`../assets/js/${file}`, import.meta.url), 'utf8')));
const dataSource = scriptSources[0];
const appSource = scriptSources.join('\n');
const html = [documentHtml, appCss, appSource].join('\n');
const liveFunction = await readFile(new URL('../supabase/functions/football-live/index.ts', import.meta.url), 'utf8');
const coreMigration = await readFile(new URL('../supabase/migrations/20260802180000_platform_core.sql', import.meta.url), 'utf8');
const leaderboardMigration = await readFile(new URL('../supabase/migrations/20260802181000_server_leaderboard.sql', import.meta.url), 'utf8');
const editorialMigration = await readFile(new URL('../supabase/migrations/20260802182000_editorial_operations.sql', import.meta.url), 'utf8');
const membershipMigration = await readFile(new URL('../supabase/migrations/20260806165000_membership_data_foundation.sql', import.meta.url), 'utf8');
const migrationFiles = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter((file) => file.endsWith('.sql'));
const migrationVersions = migrationFiles.map((file) => file.split('_')[0]);
assert.equal(new Set(migrationVersions).size, migrationVersions.length, 'Supabase migration sürüm numaraları benzersiz olmalı.');
const buildScript = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../worker/index.js', import.meta.url), 'utf8');
const devServerSource = await readFile(new URL('./dev-server.mjs', import.meta.url), 'utf8');
const legalIndex = await readFile(new URL('../legal/index.html', import.meta.url), 'utf8');
const legalConfig = await readFile(new URL('../assets/legal/legal-config.js', import.meta.url), 'utf8');
const legalCss = await readFile(new URL('../assets/legal/xyz-legal.css', import.meta.url), 'utf8');
const legalScript = await readFile(new URL('../assets/legal/legal.js', import.meta.url), 'utf8');
const databaseFoundationDoc = await readFile(new URL('../docs/database-foundation.md', import.meta.url), 'utf8');
const accessInventoryDoc = await readFile(new URL('../docs/access-and-env-inventory.md', import.meta.url), 'utf8');
assert.match(documentHtml, /assets\/css\/app\.css/, 'Harici uygulama stili yüklenmeli.');
assert.match(documentHtml, /legal\/kvkk-aydinlatma\.html/, 'Ana sayfadan KVKK Aydınlatma bağlantısı bulunmalı.');
assert.match(documentHtml, /legal\/cerez-politikasi\.html/, 'Ana sayfadan Çerez Politikası bağlantısı bulunmalı.');
assert.doesNotMatch(documentHtml, /HİSLER DEĞİL, VERİLER KONUŞUR|>YASAL BİLGİLER</, 'Kaldırılan sloganlı alt metin geri gelmemeli.');
assert.doesNotMatch(documentHtml, /assets\/legal\/(?:xyz-legal\.css|consent\.js)/, 'Yasal merkez tasarımı ana sayfanın görünümünü değiştirmemeli.');
assert.match(legalIndex, /Yasal Merkez/, 'Yasal Merkez giriş sayfası bulunmalı.');
assert.match(legalConfig, /Şirket kuruluşundan sonra yayımlanacak/, 'Kuruluş öncesi kurumsal alanlar açıkça beklemede gösterilmeli.');
assert.match(legalCss, /--legal-bg:#171521/, 'Yasal merkez ana portalın gece rengini kullanmalı.');
assert.match(legalCss, /--legal-gold:#c93642/, 'Yasal merkez ana portalın kırmızı vurgu rengini kullanmalı.');
assert.match(legalScript, /legal-brand-mark/, 'Yasal merkez ana sayfadaki marka kilidini kullanmalı.');
assert.match(buildScript, /resolve\(root, "legal"\)/, 'Yasal sayfalar production paketine kopyalanmalı.');
assert.doesNotMatch(documentHtml, /<style>[\s\S]*<\/style>/i, 'Uygulama CSS’i index.html içine geri taşınmamalı.');
assert.doesNotMatch(documentHtml, /<script>\s*[\s\S]+?<\/script>/i, 'Uygulama JavaScript’i index.html içine geri taşınmamalı.');
for (const file of scriptFiles) assert.match(documentHtml, new RegExp(`assets/js/${file.replace('.', '\\.')}"`), `${file} sayfaya bağlanmalı.`);
scriptSources.forEach((source, index) => new vm.Script(source, { filename: `assets/js/${scriptFiles[index]}` }));

// Bir ismin GERCEKTEN calisan tanimini dondurur.
// Neden gerekli: ui.js ayni ismi hem `function ad(` bildirimiyle hem daha sonra
// `ad = function(` yeniden atamasiyla tanimliyor. Tarayicida SON tanim kazanir.
// functionSource ilk eslesmeyi aldigi icin bazi kontroller hic calismayan olu
// kodu dogruluyordu; yani yesil gecen test yanlis guven veriyordu.
function liveFunctionSource(name) {
  const patterns = [`function ${name}(`, `${name} = function(`];
  let start = -1;
  for (const pattern of patterns) {
    let index = appSource.lastIndexOf(pattern);
    if (index > start) start = index;
  }
  if (start < 0) throw new Error(`${name} fonksiyonunun canli tanimi bulunamadi.`);
  return extractBody(name, start);
}

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} fonksiyonu bulunamadı.`);
  return extractBody(name, start);
}

function extractBody(name, start) {
  const bodyStart = appSource.indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    const char = appSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`${name} fonksiyonu tamamlanmamış.`);
}

const testContext = vm.createContext({
  MATCHES: [
    { id:'m1', hafta:1 },
    { id:'m2', hafta:1 }
  ],
  ALL_PREDICTIONS: {
    m1: { u1:{ pick:'1', scoreHome:2, scoreAway:1, submittedAt:100 } },
    m2: { u1:{ pick:'2', scoreHome:null, scoreAway:null, submittedAt:200 } }
  },
  ALL_RESULTS: { m1:{ home:2, away:1 } }
});

for (const name of ['computeMatchPoints','weekMatchIds','userStatsForWeek','lifetimeStats','sortRows','escapeHTML']) {
  new vm.Script(functionSource(name)).runInContext(testContext);
}

const exact = testContext.computeMatchPoints({pick:'1',scoreHome:2,scoreAway:1},{home:2,away:1});
assert.equal(exact.toplam, 8, 'Doğru sonuç + kesin skor 8 puan olmalı.');
const stats = testContext.lifetimeStats('u1');
assert.equal(stats.dogruYuzde, 100, 'Sonuçlanmamış tahmin başarı yüzdesini düşürmemeli.');
const tiedRows = [
  {weekPts:3,total:50,weekKesinSkor:0,weekSonuc:1,kesinSkor:9,sonuc:12,weekTamamlaZaman:10,seasonTamamlaZaman:10},
  {weekPts:3,total:10,weekKesinSkor:1,weekSonuc:1,kesinSkor:1,sonuc:2,weekTamamlaZaman:20,seasonTamamlaZaman:20}
];
assert.equal(testContext.sortRows(tiedRows,'week')[0].weekKesinSkor, 1, 'Haftalık eşitlik haftalık kesin skorla çözülmeli.');
assert.equal(testContext.sortRows(tiedRows,'season')[0].total, 50, 'Sezon sıralaması sezon toplamına göre yapılmalı.');
assert.equal(testContext.escapeHTML('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'Kullanıcı metni HTML olarak çalışmamalı.');

assert.match(html, /sb\.functions\.invoke\(LIVE_FEED_CONFIG\.functionName/, 'Canlı sekme doğrudan sağlayıcıya değil Edge Function katmanına bağlanmalı.');
assert.doesNotMatch(html, /sportscore\.com/i, 'Görünür veya gizli SportScore bağlantısı bulunmamalı.');
assert.match(liveFunction, /apiFootballAdapter/, 'API-Football adaptörü bulunmalı.');
assert.match(liveFunction, /sportmonksAdapter/, 'Sportmonks geçiş adaptörü bulunmalı.');
assert.match(liveFunction, /FOOTBALL_DATA_PROVIDER/, 'Sağlayıcı ortam ayarıyla seçilebilmeli.');
assert.match(liveFunction, /LIVE_CACHE_LIVE_SECONDS/, 'Canlı maç cache süresi ayrı ayarlanmalı.');
assert.match(liveFunction, /ttlForResult/, 'Cache süresi maç durumuna göre hesaplanmalı.');
assert.match(functionSource('loadAllData'), /primeServerLeaderboards/, 'Liderlik verisi önce sunucu tarafı RPC’den alınmalı.');
assert.match(functionSource('fetchServerLeaderboard'), /get_leaderboard/, 'Sunucu tarafı liderlik RPC bağlantısı bulunmalı.');
assert.match(coreMigration, /create table if not exists public\.predictions/i, 'Tahmin tablosunun yeniden kurulabilir şeması bulunmalı.');
assert.match(coreMigration, /predictions_integrity_before_write/i, 'Tahmin kilidi veritabanında uygulanmalı.');
assert.match(coreMigration, /predictions_own_read/i, 'Tahminler yalnız hesap sahibi tarafından okunmalı.');
assert.match(coreMigration, /get_match_prediction_consensus/i, 'Topluluk dağılımı anonim RPC üzerinden sunulmalı.');
assert.match(leaderboardMigration, /create or replace function public\.get_leaderboard/i, 'Puanlama ve liderlik RPC’si bulunmalı.');
assert.match(leaderboardMigration, /security definer/i, 'Liderlik RPC’si RLS arkasında güvenli çalışmalı.');
assert.match(membershipMigration, /create table if not exists public\.legal_documents/i, 'Yasal metinler sürümlü DB tablosunda tutulmalı.');
assert.match(membershipMigration, /create table if not exists public\.user_consents/i, 'Kullanıcı onay kayıtları ayrı tabloda tutulmalı.');
assert.match(membershipMigration, /create table if not exists public\.weekly_games/i, 'Haftalık oyun tanımları DB’de modellemeli.');
assert.match(membershipMigration, /create table if not exists public\.weekly_game_entries/i, 'Haftalık oyun cevapları kullanıcı bazlı ayrı tutulmalı.');
assert.match(membershipMigration, /create table if not exists public\.reward_claims/i, 'Ödül teslimat süreci yalnız kazanan kullanıcılar için ayrı tabloda tutulmalı.');
assert.match(membershipMigration, /create table if not exists public\.account_security_events/i, 'Bot ve fraud sinyalleri için güvenlik olay tablosu bulunmalı.');
assert.match(membershipMigration, /alter table public\.user_consents enable row level security/i, 'Onay kayıtlarında RLS aktif olmalı.');
assert.match(membershipMigration, /create policy user_consents_own_read/i, 'Kullanıcı yalnız kendi onay kaydını okuyabilmeli.');
assert.match(membershipMigration, /create or replace function public\.accept_user_consent/i, 'Onay kaydı kontrollü RPC ile yazılmalı.');
assert.match(membershipMigration, /create or replace function public\.submit_weekly_game_entry/i, 'Haftalık oyun cevabı kilit zamanı kontrol eden RPC ile yazılmalı.');
assert.match(membershipMigration, /create or replace function public\.request_reward_claim/i, 'Ödül talebi kontrollü RPC ile açılmalı.');
assert.match(databaseFoundationDoc, /IP ve user-agent ham veri olarak değil, hash olarak saklanmalıdır/i, 'DB dokümanı KVKK veri minimizasyonu prensibini açıklamalı.');
assert.match(accessInventoryDoc, /Bu dosya gizli değer saklamaz/i, 'Erişim envanteri gizli değer saklamama kuralını açıkça belirtmeli.');
assert.match(accessInventoryDoc, /SUPABASE_SERVICE_ROLE_KEY/i, 'Erişim envanteri server-only Supabase secret adlarını değer yazmadan listelemeli.');
assert.match(accessInventoryDoc, /X_BEARER_TOKEN/i, 'Erişim envanteri X token adını değer yazmadan listelemeli.');
assert.doesNotMatch(editorialMigration, /^\s*rollback\s*;/im, 'Editoryal migration rollback ile bitmemeli.');
assert.match(editorialMigration, /^\s*commit\s*;/im, 'Editoryal migration kalıcı transaction ile bitmeli.');
assert.match(html, /XYZSKOR’da satılmaz/i, 'Mythos alanı XYZSKOR’da satış yapılmadığını açıkça belirtmeli.');
assert.match(html, /Mythos Cards[^<\n]*Ödül Sponsoru/i, 'Mythos rolü yalnızca ödül sponsoru olarak tanımlanmalı.');
assert.doesNotMatch(html, /mythos\.cards\/product\//i, 'Mythos ürün satış sayfalarına yönlendirme bulunmamalı.');
assert.doesNotMatch(html, /(?:\d[\d.]*)\s*TL\b/i, 'Sponsor ödüllerinde fiyat gösterilmemeli.');
assert.doesNotMatch(html, /Satın alma işlemi/i, 'Satın alma çağrısı bulunmamalı.');

assert.doesNotMatch(html, /<section class="content-network"/i, 'Kaldırılan yapay editoryal blok geri gelmemeli.');
assert.doesNotMatch(html, /<div class="inline-campaign"/i, 'Kaldırılan yapay koleksiyon şeridi geri gelmemeli.');
assert.match(html, /viewport-fit=cover/i, 'iPhone güvenli alanları için viewport-fit etkin olmalı.');
assert.match(html, /safe-area-inset-bottom/i, 'iOS alt güvenli alanı desteklenmeli.');
assert.match(html, /id="tabBtnFootball"[^>]*>Futbol</i, 'Futbol ana ürün alanı bulunmalı.');
assert.match(html, /id="tabBtnPredict"[^>]*>Predict</i, 'Predict ana ürün alanı bulunmalı.');
assert.doesNotMatch(html, /id="tabBtn(?:Story|League|Stories|Live)"/i, 'Eski ana navigasyon seçenekleri görünür DOM’da bulunmamalı.');
assert.match(html, /id="accountOverlay"/i, 'Profil ve hesap işlemleri hesap panelinde bulunmalı.');
assert.doesNotMatch(html, /<section class="campaign-hero"/i, 'Büyük sponsor hero ilk görünümde bulunmamalı.');
assert.match(html, /id="footballQuickMatches"/i, 'Futbol alanında kompakt maç merkezi bulunmalı.');
assert.doesNotMatch(html, /id="footballNewsSection"/i, 'Ana sayfadaki Gündem akışı modülü kaldırılmış kalmalı.');
assert.match(html, /id="footballTransferStream"/i, 'Futbol alanında kaynaklı transfer modülü bulunmalı.');
assert.match(html, /id="footballStandingsCompact"/i, 'Futbol alanında puan durumu özeti bulunmalı.');
assert.match(appCss, /#footballOverviewView \.standings-rail\{grid-column:2;grid-row:2\/4\}/i, 'Puan durumu ana sayfada kaldırılan gündem alanının yerini kullanmalı.');
assert.match(appSource, /\{ key:'super-lig'[\s\S]*\{ key:'premier-league'[\s\S]*\{ key:'la-liga'[\s\S]*\{ key:'champions-league'[\s\S]*\{ key:'europa-league'/i, 'Lig seçimi Süper Lig, Premier League, La Liga, UCL ve UEL sırasını korumalı.');
assert.match(functionSource('loadLiveFeed'), /fetch\(`\/api\/football\/live\?league=\$\{encodeURIComponent\(league\)\}`[\s\S]*sb\.functions\.invoke/s, 'Lig bazlı Sportmonks canlı Worker akışı birincil, Supabase fonksiyonu yedek olmalı.');
assert.match(html, /id="footballContextNav"[^>]*aria-label="Futbol bölümleri"/i, 'Futbol içinde maç, gündem, transfer ve puan durumu erişimi bulunmalı.');
assert.match(html, /data-football-route="home"[^>]*>Anasayfa</i, 'Futbol portalının ayrı bir Anasayfa rotası bulunmalı.');
assert.match(html, /id="footballMatchesView"[^>]*hidden/i, 'Maçlar için ana sayfadan ayrı tam detay görünümü bulunmalı.');
assert.match(html, /id="footballNewsView"[^>]*hidden/i, 'Gündem için ana sayfadan ayrı tam detay görünümü bulunmalı.');
assert.match(functionSource('openFootballSection'), /activeFootballSection!==['"]home['"]/, 'Yalnız Anasayfa özet görünümünü kullanmalı; diğer sekmeler ayrı ekran açmalı.');
assert.match(functionSource('renderMatchesHub'), /openMatchCenter/, 'Tam maç akışındaki her kayıt kendi maç merkezini açmalı.');
assert.match(liveFunctionSource('renderNewsHub'), /contextualEditorialEntries|editorialNewsEntries/, 'Tam gündem ekranı kaynaklı editoryal akıştan beslenmeli.');
assert.match(html, /matches-hub-view[^}]*background:linear-gradient\(180deg,#dfe0e2,#d3d5d8/i, 'Maçlar ekranı göz yormayan gri portal yüzeyi kullanmalı.');
assert.match(html, /id="footballTeamStrip"/i, 'Futbol alanında gerçek veriden üretilen takım filtresi bulunmalı.');
assert.match(html, /id="clubSocialSection"/i, 'Resmî kulüp X akışı bulunmalı.');
assert.match(html, /const X_CLUBS = \[/i, 'X akışı yalnız tanımlı resmî kulüp hesaplarını kullanmalı.');
assert.match(functionSource('loadXClubPosts'), /fetch\('\/api\/football\/x-media'/, 'X paylaşımları medya destekli aynı alan adlı sunucu katmanından alınmalı.');
assert.match(functionSource('loadPreseasonPosts'), /fetch\('\/api\/football\/x-preseason'/, 'Hazırlık maçı akışı güncel lig kapsamlı uçtan alınmalı.');
assert.match(appCss, /\.preseason-social-stage\{[^}]*grid-template-columns:1fr!important[^}]*overflow-y:auto/, 'Hazırlık maçı gönderileri tek kolon halinde aşağı doğru akmalı.');
assert.match(appCss, /\.transfer-signal-stream\{[^}]*grid-auto-flow:row[^}]*overflow-y:auto/, 'X sinyal kaynakları okunaklı dikey akış kullanmalı.');
assert.match(functionSource('boot'), /parseAppLocation[\s\S]*activeFootballLeague[\s\S]*await loadAllData\(\)/, 'Doğrudan lig URL’si veri yüklenmeden önce seçilmeli.');
assert.match(dataSource, /payload\.league!==leagueKey/, 'Sportmonks sezon cevabı istenen lig anahtarıyla doğrulanmalı.');
assert.match(dataSource, /const scopedSuperLig = isStrictSuperLigScope\(\)/, 'Süper Lig Supabase fallback verisi diğer liglere ve tüm ligler kapsamına taşınmamalı.');
assert.match(workerSource, /\/transfers\/latest\?include=/, 'Transfer akışı Sportmonks latest ucundan alınmalı.');
assert.match(functionSource('renderClubSocial'), /loadXClubPosts\(\)/, 'Dört resmî kulüp akışı ara ekran olmadan otomatik yüklenmeli.');
assert.match(functionSource('scrollClubSocial'), /getBoundingClientRect\(\)\.width[\s\S]*scrollBy/, 'Büyük X kartları bir kart genişliğinde yatay kaydırılabilmeli.');
assert.match(html, /aria-label="Kulüp akışını sağa kaydır"/, 'X akışında görünür ve erişilebilir yatay kaydırma kontrolü bulunmalı.');
assert.match(appCss, /grid-auto-columns:clamp\(390px,32vw,440px\)[^}]*overflow-x:auto[^}]*scroll-snap-type:x mandatory/, 'Masaüstü X akışı büyük kartlı yatay ray kullanmalı.');
assert.match(workerSource, /env\.X_BEARER_TOKEN/, 'X Bearer Token yalnız sunucu ortamından okunmalı.');
assert.match(workerSource, /s-maxage=86400/, 'X akışı 24 saat sunucu önbelleğinde tutulmalı.');
assert.match(workerSource, /s-maxage=31536000/, 'X kulüp kimlikleri tekrar ücret oluşturmamak için uzun süre önbellekte tutulmalı.');
assert.match(workerSource, /\/2\/users\/by\?usernames=/, 'Dört resmî kulüp tek kullanıcı sorgusuyla çözülmeli.');
assert.match(workerSource, /cost_profile:\s*"daily-capped-safe-mode"/, 'X akışı günlük maliyet kontrollü profili yanıtta belirtmeli.');
assert.match(workerSource, /expansions:\s*"attachments\.media_keys"/, 'X akışı gönderiye bağlı gerçek medyayı expansion ile istemeli.');
assert.match(workerSource, /"media\.fields":\s*"media_key,type,url,preview_image_url,width,height,alt_text"/, 'X medya görselleri, video kapakları ve erişilebilir açıklamaları istemeli.');
assert.match(liveFunctionSource('xPostMediaHTML'), /club-social-media-item[\s\S]*loading="lazy"/, 'X gönderi medyası tembel yüklenen gerçek görsel kartları üretmeli.');
assert.match(appCss, /club-social-card\.has-media \.club-social-copy\{height:82px;min-height:82px/, 'Masaüstü X kartlarında medya başlangıç çizgisi eşitlenmeli.');
assert.match(appCss, /club-social-media\.items-3\{grid-template-columns:minmax\(0,1\.28fr\) minmax\(0,\.72fr\)/, 'Üç görselli X gönderisi dengeli bir ana görsel kompozisyonu kullanmalı.');
assert.match(workerSource, /x_credits_depleted/, 'X kredi bakiyesi bittiğinde açık bir sunucu durumu dönmeli.');
assert.match(workerSource, /function readEdgeCache/, 'X akışı çalışma zamanı önbellek hatasında tamamen çökmemeli.');
assert.match(workerSource, /SOCIAL_STALE_CACHE/, 'X kesintisinde son doğrulanmış akış için uzun süreli yedek önbellek bulunmalı.');
assert.match(workerSource, /xFeedRefreshPromises = new Map/, 'X yenilemeleri lig bazında ayrı istek havuzları kullanmalı.');
assert.match(workerSource, /validLeagueKey\(requestedLeague, \{ xFeed:true \}\)/, 'X akışı yalnız açıkça desteklenen lig anahtarlarını kabul etmeli.');
assert.match(workerSource, /xDailyClubScope\(league\)/, 'X akışı bilinmeyen veya pahalı liglerde güvenli kulüp kapsamı helperını kullanmalı.');
assert.match(workerSource, /max_results:\s*X_PRESEASON_TWEET_LIMIT/, 'Hazırlık maçı taraması sabit güvenli limit üzerinden yapılmalı.');
assert.match(workerSource, /const X_PRESEASON_TWEET_LIMIT = "10"/, 'Hazırlık maçı taraması kredi dostu son 10 gönderiyle sınırlı kalmalı.');
assert.match(workerSource, /findBestPreseasonPost/, 'X hazırlık akışı skor ve sonuç sinyalini önceliklendirmeli.');
assert.match(workerSource, /MATCH_RESULT_KEYWORDS/, 'Hazırlık maçı sonuç ifadeleri ayrı sınıflandırılmalı.');
assert.doesNotMatch(workerSource.match(/const PRESEASON_KEYWORDS = \[[\s\S]*?\];/)?.[0] || '', /play-?off|matchday/i, 'Resmî play-off ve genel maç günü paylaşımları hazırlık maçı sayılmamalı.');
assert.match(workerSource, /new URL\("\/api\/football\/x-preseason-v1"/, 'Yeni X hazırlık sonucu sınıflandırıcısı ayrı cache sürümü kullanmalı.');
assert.match(devServerSource, /startsWith\('\/api\/'\)[\s\S]*proxyApi/, 'Yerel önizleme X ve Sportmonks API rotalarını yayın katmanına iletmeli.');
assert.match(workerSource, /X_TIMEOUT_MS/, 'X sağlayıcı isteği sınırsız süre açık kalmamalı.');
assert.match(workerSource, /\/api\/health/, 'Üretim sağlık kontrolü bulunmalı.');
assert.match(workerSource, /env\.YOUTUBE_API_KEY/, 'YouTube API anahtarı yalnız sunucu ortamından okunmalı.');
assert.match(workerSource, /s-maxage=5400/, 'YouTube aramaları kota dostu sunucu önbelleği kullanmalı.');
assert.match(workerSource, /\/api\/media\/youtube/, 'Doğrulanmış YouTube medya ucu bulunmalı.');
assert.match(workerSource, /env\.SPORTMONKS_API_TOKEN/, 'Sportmonks token yalnız sunucu ortamından okunmalı.');
assert.match(workerSource, /\/api\/football\/club/, 'Kulüp merkezi için Sportmonks sunucu adaptörü bulunmalı.');
assert.match(workerSource, /lineups\.player/, 'Son resmî ilk 11 oyuncu ilişkisi Sportmonks sorgusuna dahil edilmeli.');
assert.match(workerSource, /Number\(row\?\.type_id\) === 11/, 'Yalnız resmî başlangıç oyuncuları ilk 11 olarak kullanılmalı.');
assert.match(html, /id="clubProfilePanel"/, 'Kulüpler alanında ayrıntılı kulüp merkezi bulunmalı.');
assert.match(functionSource('loadClubProfile'), /fetch\(`\/api\/football\/club/, 'Kulüp merkezi aynı alan adlı sunucu adaptörünü kullanmalı.');
assert.match(functionSource('clubLineupHTML'), /İsim uydurulmuyor/, 'Sağlayıcı verisi yokken oyuncu ismi uydurulmamalı.');
assert.match(functionSource('clubDirectionsURL'), /google\.com\/maps\/dir/, 'Stadyum kartı yol tarifi bağlantısı üretmeli.');
assert.match(appSource, /CLUB_INTELLIGENCE_2026_27/, 'Kulüp değeri ve teknik direktör referans verisi bulunmalı.');
assert.match(html, /id="editorialDesk"/, 'Ana sayfada profesyonel haber merkezi bulunmalı.');
assert.match(html, /id="youtubeMediaGrid"/, 'Ana sayfada YouTube canlı ve program paneli bulunmalı.');
assert.match(liveFunctionSource('renderEditorialNews'), /contextualEditorialEntries|editorialNewsEntries/, 'Haber merkezi yayımlanmış ve kaynaklı kayıtlardan beslenmeli.');
assert.match(liveFunctionSource('renderEditorialNews'), /editorial-portrait-shell/, 'Haber merkezi oyuncu görsellerini kesmeden dairesel portre içinde göstermeli.');
assert.match(liveFunctionSource('renderEditorialNews'), /editorialMatchVisualHTML/, 'Görseli olmayan açılış maçı haberi gerçek maç eşleşmesiyle görselleştirilmeli.');
assert.match(functionSource('editorialMatchVisualHTML'), /crestHTML\(match\.ev,'lg'\).*crestHTML\(match\.konuk,'lg'\)/s, 'Açılış maçı görseli iki gerçek takım armasını kullanmalı.');
assert.match(functionSource('renderClubProfile'), /club-coach-portrait/, 'Teknik direktör görseli profesyonel portre çerçevesinde gösterilmeli.');
assert.match(appCss, /ELITE GRAPHITE FOOTBALL SYSTEM/, 'Futbol ürünü tek bir elit grafit tasarım sistemi kullanmalı.');
assert.match(appCss, /club-coach-portrait\{[^}]*overflow:hidden[^}]*border-radius:50%/s, 'Teknik direktör fotoğrafı kesilmeyen dairesel portre çerçevesinde tutulmalı.');
assert.match(appCss, /editorial-match-visual\{[^}]*grid-template-columns/s, 'Açılış maçı için iki kulüplü görsel kompozisyon bulunmalı.');
assert.doesNotMatch(liveFunctionSource('renderEditorialNews'), /EDITORIAL_NEWS_CACHE\.slice\(0,3\).*filter\(item=>item\.image\)/s, 'Manşet haberi başka haberlerin ilgisiz oyuncu görsellerini ödünç almamalı.');
assert.match(functionSource('editorialNewsEntries'), /imageType:editorialPhoto\?'photo':playerPortrait\?'portrait':'none'/, 'Editoryal fotoğraf ile oyuncu portresi ayrıştırılmalı.');
assert.match(functionSource('renderYouTubeMedia'), /\/api\/media\/youtube/, 'YouTube paneli sunucu adaptörünü kullanmalı.');
assert.match(appSource, /let xClubPostsRequest=null/, 'Tarayıcı aynı X akışını eşzamanlı olarak tekrar sorgulamamalı.');
assert.doesNotMatch(appSource, /platform\.(?:x|twitter)\.com\/widgets\.js/, 'Tarayıcı engeline açık X widget betiği kullanılmamalı.');
assert.doesNotMatch(html, /Akışı göster/i, 'X akışında gereksiz izin düğmesi bulunmamalı.');
assert.match(html, /class="predict-leaderboard-slot"/i, 'Tek Predict duyuru bannerı ana akış üstünde bulunmalı.');
assert.doesNotMatch(html, /id="portalSponsorBanner"/i, 'Futbol portalında tekrar eden ikinci Predict bannerı bulunmamalı.');
assert.match(html, /id="portalSponsorRail"/i, 'Futbol portalında sağ sponsor envanteri bulunmalı.');
assert.match(documentHtml, /id="clubSocialTitle">Kulüp Gündemi</, 'Kulüp sosyal alanı ürünleşmiş gündem adı kullanmalı.');
assert.match(documentHtml, /<h2>Süper Lig Maç Merkezi<\/h2>/, 'Canlı panel Süper Lig maç merkezi başlığı kullanmalı.');
assert.match(html, /grid-template-columns:340px minmax\(0,1fr\) 290px/i, 'Masaüstü Futbol görünümü üç kolonlu portal düzenini kullanmalı.');
assert.match(html, /prefers-reduced-motion:reduce/i, 'Yeni portal hareket azaltma tercihini desteklemeli.');
assert.match(functionSource('selectFootballTeam'), /renderFootballQuickMatches\(\).*renderFootballNews\(\).*renderFootballTransfers\(\)/s, 'Takım filtresi maç, gündem ve transfer akışını birlikte yenilemeli.');
assert.doesNotMatch(liveFunctionSource('renderPortalSponsor'), /\d\s*TL\b|fiyat|satın al/i, 'Portal sponsor alanı fiyat veya satın alma çağrısı üretmemeli.');
assert.match(functionSource('loadAllData'), /moduleQuery\(/, 'Bir modül hatası bütün Futbol ekranını durdurmamalı.');
assert.doesNotMatch(functionSource('renderAll'), /renderMarketPulse|renderMythosProducts|startTransferCountdown/, 'Yerel transfer ve sponsor örnekleri production render zincirine girmemeli.');
assert.match(functionSource('matchStatusLabel'), /Durum doğrulanıyor/, 'Saat tahmini doğrulanmış canlı etiketi üretmemeli.');
assert.doesNotMatch(functionSource('matchStatusLabel'), /kt \+ 130\*60000\) return 'Canlı'/, 'Canlı etiketi yalnız açık durum kaydından gelmeli.');
assert.match(html, /id="mcTabs" role="tablist"/i, 'Maç detayı alt bölümleri erişilebilir tablist olmalı.');
assert.match(html, /id="mc-tab-absences"[^>]*role="tab"/i, 'Eksikler maç detayının alt bölümü olmalı.');
assert.match(html, /id="mc-tab-news"[^>]*role="tab"/i, 'İlgili haberler maç detayının alt bölümü olmalı.');
assert.match(functionSource('ensureMcData'), /mcQuery\(/, 'Bir maç detayı sorgusu diğer detay modüllerini durdurmamalı.');
assert.match(functionSource('closeMatchCenter'), /history\.back\(\)/, 'Maç detayından dönüş tarayıcı geçmişini korumalı.');
assert.match(functionSource('renderMcCommunity'), /bireysel tahminleri gösterilmez/, 'Diğer kullanıcıların bireysel tahmin gizliliği korunmalı.');
assert.doesNotMatch(functionSource('renderMcCommunity'), /PROFILES|Object\.values\(ALL_PREDICTIONS/, 'Topluluk görünümü bireysel tahmin listesi oluşturmamalı.');
assert.match(html, /class="predict-overview" id="progressPanel"/i, 'Predict ilk görünümünde haftalık özet bulunmalı.');
assert.match(html, /class="predict-summary-grid"/i, 'Predict ilerleme metrikleri kompakt özet içinde olmalı.');
assert.match(html, /class="predict-match"/i, 'Tahmin maçları kompakt satır yapısında olmalı.');
assert.doesNotMatch(html, /aria-label="XYZSkor matematik formülleri"/i, 'Predict ilk görünümü formül paneliyle başlamamalı.');
assert.match(functionSource('submitPrediction'), /Kaydediliyor/, 'Tahmin kaydı kaydediliyor durumunu göstermeli.');
assert.match(functionSource('submitPrediction'), /Kaydetme başarısız/, 'Tahmin kayıt hatası görünür olmalı.');
assert.doesNotMatch(functionSource('submitPrediction'), /alert\(/, 'Tahmin geri bildirimi tarayıcı alert kutusuna bağlı olmamalı.');
assert.match(functionSource('predictionActionHTML'), /aria-live="polite"/, 'Tahmin kaydı sonucu erişilebilir canlı bölgede duyurulmalı.');
assert.match(functionSource('renderAccountContent'), /Tahmin geçmişi/, 'Hesap paneli tahmin geçmişini içermeli.');
assert.match(functionSource('renderAccountContent'), /Bildirim tercihleri/, 'Bildirim tercihleri hesap panelinde kalmalı.');
assert.match(functionSource('renderAccountContent'), /Takip edilenler/, 'Takip edilen takım ve futbolcular hesap panelinde kalmalı.');
assert.match(functionSource('renderAccountContent'), /u\.is_admin\?/, 'Yönetim bağlantısı yalnız admin kullanıcı için oluşturulmalı.');
assert.doesNotMatch(functionSource('renderAccountContent'), /id="accountProfile"/, 'Profil üçüncü bir alana yönlendirilmemeli; hesap panelinde tamamlanmalı.');
assert.match(html, /account-drawer[^}]*100dvh/i, 'Hesap paneli mobil görünüm yüksekliğine uymalı.');
assert.match(html, /accountOverlay[^\n]*aria-hidden="true"/i, 'Kapalı hesap paneli erişilebilirlik ağacından gizlenmeli.');
assert.match(html, /id="newsOverlay"[^>]*aria-hidden="true"/i, 'Haber detayı erişilebilir modal olarak bulunmalı.');
assert.match(functionSource('openNewsDetail'), /story\.is_published/, 'Haber detayı yalnız yayımlanmış editoryal kaydı açmalı.');
assert.match(functionSource('safeExternalURL'), /https:.*http:/s, 'Dış kaynak bağlantıları yalnız HTTP ve HTTPS protokollerini kabul etmeli.');
assert.match(functionSource('openNewsDetail'), /noopener noreferrer/, 'Dış kaynak bağlantısı opener erişimini engellemeli.');
assert.match(functionSource('storyConfidence'), /Çelişkili/, 'Çelişkili haber güven seviyesi açıkça desteklenmeli.');
assert.match(functionSource('storyIdentityHTML'), /card\.player.*card\.related_player/, 'Gündem kimliği yalnız gerçek oyuncu alanından hazırlanmalı.');
assert.doesNotMatch(functionSource('submitPrediction'), /loadAllData\(/, 'Tek tahmin kaydı bütün veri setini yeniden çekmemeli.');
assert.match(functionSource('savePrediction'), /ALL_PREDICTIONS\[matchId\]\[u\.id\]/, 'Başarılı tahmin sunucu yanıtından sonra yerel cache’e yazılmalı.');
assert.match(html, /content-visibility:auto/, 'Ekran dışı ağır bölümler render maliyetini ertelemeli.');
assert.match(html, /id="authClose"/, 'Auth penceresinde mobilde erişilebilir kapatma düğmesi olmalı.');
assert.match(functionSource('openAuth'), /authClose.*focus/, 'Auth açıldığında odak pencere içine taşınmalı.');
assert.match(functionSource('renderTicker'), /escapeHTML\(m\.ev\).*escapeHTML\(m\.konuk\)/s, 'Fikstür takım adları ticker HTML’ine kaçışla yazılmalı.');
assert.match(buildScript, /PRODUCTION_STRIP_LEGACY_HTML_START/, 'Production build gizli prototip HTML’ini ayıklamalı.');
assert.match(buildScript, /PRODUCTION_STRIP_LEGACY_JS_START/, 'Production build örnek market verisini ayıklamalı.');
assert.match(buildScript, /createHash\("sha256"\)/, 'Production HTML değişen CSS ve JavaScript varlıklarını otomatik sürümlemeli.');

const originalFetch = globalThis.fetch;
const originalCaches = globalThis.caches;
const socialCache = new Map();
const upstreamCalls = [];
const pendingCacheWrites = [];
let xCreditsDepleted = false;
try {
  globalThis.caches = {
    default: {
      async match(request) { return socialCache.get(request.url)?.clone() || null; },
      async put(request, response) { socialCache.set(request.url, response.clone()); },
    },
  };
  globalThis.fetch = async (input) => {
    const url = String(input);
    upstreamCalls.push(url);
    if (url.includes('api.sportmonks.com/v3/football/teams/search/')) {
      return Response.json({ data:[{ id:141, name:'Galatasaray', image_path:'https://img.sportmonks.test/galatasaray.png', venue:{ id:1, name:'RAMS Park', city_name:'İstanbul', capacity:53798 }, coaches:[{ id:2, display_name:'Okan Buruk', image_path:'https://img.sportmonks.test/okan-buruk.png', nationality:{ name:'Türkiye' } }] }] });
    }
    if (url.includes('/squads/teams/141/extended')) {
      return Response.json({ data:[{ id:3, display_name:'Test Oyuncusu', in_squad:true, jersey_number:10, detailedPosition:{ name:'Orta Saha' } }] });
    }
    if (url.includes('/fixtures/between/')) {
      return Response.json({ data:[{ id:900, name:'Galatasaray - Test', starting_at:'2026-07-01 18:00:00', lineups:Array.from({length:11},(_,index)=>({ team_id:141, type_id:11, formation_field:index+1, player_id:index+1, player_name:`Oyuncu ${index+1}`, jersey_number:index+1, player:{ image_path:'https://img.sportmonks.test/player.png' }, position:{ name:index?'Oyuncu':'Kaleci' } })), formations:[{ participant_id:141, formation:'4-2-3-1' }] }] });
    }
    if (url.includes('googleapis.com/youtube/v3/search')) {
      const channelId = new URL(url).searchParams.get('channelId') || 'unknown';
      return Response.json({ items:[{ id:{videoId:`video-${channelId.slice(-6)}`}, snippet:{title:`Program ${channelId.slice(-4)}`,channelTitle:'Doğrulanmış Kanal',publishedAt:'2026-08-03T09:00:00Z',liveBroadcastContent:'none',thumbnails:{high:{url:'https://img.youtube.test/video.jpg'}}} }] });
    }
    if (url.includes('googleapis.com/youtube/v3/videos')) {
      const ids=(new URL(url).searchParams.get('id')||'').split(',').filter(Boolean);
      return Response.json({items:ids.map(id=>({id,snippet:{title:`Program ${id}`,channelTitle:'Doğrulanmış Kanal',publishedAt:'2026-08-03T09:00:00Z',liveBroadcastContent:'none',thumbnails:{high:{url:'https://img.youtube.test/video.jpg'}}},contentDetails:{duration:'PT12M5S'}}))});
    }
    if (xCreditsDepleted) return Response.json({ error:'credits_depleted' }, { status:402 });
    if (url.includes('/2/users/by?')) {
      return Response.json({ data: [
        { id:'1', username:'GalatasaraySK', profile_image_url:'https://img.example/gs.jpg' },
        { id:'2', username:'Fenerbahce', profile_image_url:'https://img.example/fb.jpg' },
        { id:'3', username:'Besiktas', profile_image_url:'https://img.example/bjk.jpg' },
        { id:'4', username:'Trabzonspor', profile_image_url:'https://img.example/ts.jpg' },
      ] });
    }
    const id = url.match(/\/2\/users\/(\d+)\/tweets/)?.[1];
    if (id) return Response.json({ data:[{ id:`post-${id}`, text:`Kulüp paylaşımı ${id}`, created_at:'2026-08-03T08:00:00Z', public_metrics:{like_count:10}, attachments:{media_keys:[`3_media-${id}`]} }], includes:{media:[{media_key:`3_media-${id}`,type:'photo',url:`https://pbs.twimg.com/media/club-${id}.jpg`,width:1600,height:900,alt_text:`Kulüp görseli ${id}`}] } });
    return Response.json({ error:'unexpected_request' }, { status:500 });
  };
  const worker = (await import(new URL(`../worker/index.js?check=${Date.now()}`, import.meta.url))).default;
  const healthResponse = await worker.fetch(new Request('https://xyzskor.test/api/health'), { X_BEARER_TOKEN:'test-token', YOUTUBE_API_KEY:'youtube-test-key', SPORTMONKS_API_TOKEN:'sportmonks-test-token' }, { waitUntil() {} });
  const healthPayload = await healthResponse.json();
  assert.equal(healthResponse.status, 200, 'Üretim sağlık kontrolü başarılı yanıt vermeli.');
  assert.equal(healthPayload.checks.x_feed, 'configured', 'Sağlık kontrolü X secret değerini göstermeden yapılandırma durumunu vermeli.');
  assert.equal(healthPayload.checks.youtube_media, 'configured', 'Sağlık kontrolü YouTube secret değerini göstermeden yapılandırma durumunu vermeli.');
  assert.equal(healthPayload.checks.sportmonks_clubs, 'configured', 'Sağlık kontrolü Sportmonks secret değerini göstermeden yapılandırma durumunu vermeli.');
  assert.doesNotMatch(JSON.stringify(healthPayload), /test-token/, 'Sağlık kontrolü secret değerini sızdırmamalı.');
  const missingToken = await worker.fetch(new Request('https://xyzskor.test/api/social/x-media-v2'), {}, { waitUntil() {} });
  assert.equal(missingToken.status, 503, 'X secret yokken sunucu açık bir yapılandırma hatası dönmeli.');
  const missingSportmonksToken = await worker.fetch(new Request('https://xyzskor.test/api/football/club?team=Galatasaray'), {}, { waitUntil() {} });
  assert.equal(missingSportmonksToken.status, 503, 'Sportmonks secret yokken kulüp merkezi açık bir yapılandırma hatası dönmeli.');
  const context = { waitUntil(promise) { pendingCacheWrites.push(promise); } };
  const clubProfile = await worker.fetch(new Request('https://xyzskor.test/api/football/club?team=Galatasaray'), { SPORTMONKS_API_TOKEN:'sportmonks-test-token' }, context);
  const clubPayload = await clubProfile.json();
  await Promise.all(pendingCacheWrites);
  assert.equal(clubProfile.status, 200, 'Sportmonks kulüp adaptörü başarılı JSON dönmeli.');
  assert.equal(clubPayload.lineup.length, 11, 'Son resmî maçtan on bir başlangıç oyuncusu dönmeli.');
  assert.equal(clubPayload.formation, '4-2-3-1', 'Son resmî maç dizilişi dönmeli.');
  assert.equal(clubPayload.squad.length, 1, 'Sportmonks kadro kayıtları kulüp profiline eklenmeli.');
  const sportmonksCallsAfterFirst = upstreamCalls.filter(url=>url.includes('api.sportmonks.com/')).length;
  const cachedClubProfile = await worker.fetch(new Request('https://xyzskor.test/api/football/club?team=Galatasaray'), { SPORTMONKS_API_TOKEN:'sportmonks-test-token' }, context);
  assert.equal(cachedClubProfile.status, 200, 'Önbellekteki Sportmonks kulüp profili kullanılabilmeli.');
  assert.equal(upstreamCalls.filter(url=>url.includes('api.sportmonks.com/')).length, sportmonksCallsAfterFirst, 'Tekrarlanan kulüp isteği Sportmonks kotasını yeniden tüketmemeli.');
  const firstFeed = await worker.fetch(new Request('https://xyzskor.test/api/social/x-media-v2'), { X_BEARER_TOKEN:'test-token' }, context);
  const firstPayload = await firstFeed.json();
  await Promise.all(pendingCacheWrites);
  assert.equal(firstFeed.status, 200, 'X sunucu adaptörü başarılı JSON dönmeli.');
  assert.equal(firstPayload.clubs.length, 4, 'X sunucu adaptörü dört kulübü birlikte dönmeli.');
  assert.equal(firstPayload.cost_profile, 'daily-capped-safe-mode', 'X sunucu adaptörü güvenli günlük maliyet profilini dönmeli.');
  assert.equal(firstPayload.clubs[0].post.media[0].url, 'https://pbs.twimg.com/media/club-1.jpg', 'X gönderisinin gerçek görseli istemciye güvenli veri olarak dönmeli.');
  const xCallsAfterFirst = upstreamCalls.filter(url=>url.includes('api.x.com/2/')).length;
  assert.equal(xCallsAfterFirst, 5, 'Günlük X yenilemesi bir kullanıcı ve dört paylaşım sorgusu yapmalı.');
  const cachedFeed = await worker.fetch(new Request('https://xyzskor.test/api/social/x-media-v2'), { X_BEARER_TOKEN:'test-token' }, context);
  assert.equal(cachedFeed.status, 200, 'Önbellekteki X akışı kullanılabilmeli.');
  assert.equal(upstreamCalls.filter(url=>url.includes('api.x.com/2/')).length, xCallsAfterFirst, 'İkinci istek 24 saatlik önbelleği aşmamalı.');
  socialCache.delete('https://xyzskor.test/api/football/x-media-v2');
  const nextDayFeed = await worker.fetch(new Request('https://xyzskor.test/api/social/x-media-v2'), { X_BEARER_TOKEN:'test-token' }, context);
  await Promise.all(pendingCacheWrites);
  assert.equal(nextDayFeed.status, 200, 'Sonraki gün X akışı yeniden oluşturulabilmeli.');
  assert.equal(upstreamCalls.filter(url=>url.includes('api.x.com/2/')).length, 9, 'Sonraki gün yalnız dört paylaşım sorgusu yapılmalı; kulüp kimlikleri tekrar okunmamalı.');
  socialCache.delete('https://xyzskor.test/api/football/x-media-v2');
  xCreditsDepleted = true;
  const staleFeed = await worker.fetch(new Request('https://xyzskor.test/api/social/x-media-v2'), { X_BEARER_TOKEN:'test-token' }, context);
  assert.equal(staleFeed.status, 200, 'X kesintisinde son doğrulanmış akış kullanılmalı.');
  assert.equal(staleFeed.headers.get('X-Data-Stale'), 'true', 'Yedek akış açıkça eski veri olarak işaretlenmeli.');
  const missingYouTubeKey = await worker.fetch(new Request('https://xyzskor.test/api/media/youtube'), {}, context);
  assert.equal(missingYouTubeKey.status, 503, 'YouTube anahtarı yokken kanal rehberine geçiş için açık durum dönmeli.');
  const youtubeFeed = await worker.fetch(new Request('https://xyzskor.test/api/media/youtube'), { YOUTUBE_API_KEY:'youtube-test-key' }, context);
  const youtubePayload = await youtubeFeed.json();
  await Promise.all(pendingCacheWrites);
  assert.equal(youtubeFeed.status, 200, 'YouTube medya adaptörü başarılı JSON dönmeli.');
  assert.equal(youtubePayload.items.length, 4, 'Dört doğrulanmış kanalın en yeni programı dönmeli.');
  const youtubeCallsAfterFirst = upstreamCalls.filter(url=>url.includes('googleapis.com/youtube/v3/')).length;
  assert.equal(youtubeCallsAfterFirst, 5, 'YouTube yenilemesi dört kanal araması ve tek toplu video detay sorgusu kullanmalı.');
  const cachedYouTubeFeed = await worker.fetch(new Request('https://xyzskor.test/api/media/youtube'), { YOUTUBE_API_KEY:'youtube-test-key' }, context);
  assert.equal(cachedYouTubeFeed.status, 200, 'Önbellekteki YouTube akışı kullanılabilmeli.');
  assert.equal(upstreamCalls.filter(url=>url.includes('googleapis.com/youtube/v3/')).length, youtubeCallsAfterFirst, 'Tekrarlanan YouTube isteği kotayı yeniden tüketmemeli.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalCaches === undefined) delete globalThis.caches;
  else globalThis.caches = originalCaches;
}

const crestBlock = html.match(/const TEAM_CRESTS = \{([\s\S]*?)\n\};/);
assert.ok(crestBlock, 'Kulüp arması haritası bulunmalı.');
const crestUrls = crestBlock[1].match(/https:\/\/upload\.wikimedia\.org[^'\"]+/g) || [];
assert.equal(new Set(crestUrls).size, 18, 'Sitedeki 18 kulüp için 18 farklı gerçek arma bulunmalı.');

// Prototip sohbet regresyonu.
// Gecmis olay: side-chat-prototype blogu uc adet uydurma uye mesaji tasiyordu ve
// PRODUCTION_STRIP isaretlerinin DISINDA kaldigi icin production paketine giriyordu.
// Mesajlardan biri "banko skor" ifadesini kullaniyordu; site "bahis yoktur" taahhudu
// verdigi icin bu hem urun sozunu hem 7258 sayili kanun sinirini zorluyordu.
// Kaynak dosyaya bakmak yeterli DEGIL: blok gelistirmede kalabilir, onemli olan
// strip sonrasi ciktinin temiz olmasi. Bu yuzden build.mjs ile ayni donusum
// burada da uygulanip sonuc uzerinde kontrol edilir.
const strippedProductionHtml = documentHtml
  .replace(/\s*<!-- PRODUCTION_STRIP_LEGACY_HTML_START -->[\s\S]*?<!-- PRODUCTION_STRIP_LEGACY_HTML_END -->\s*/g, '\n');
assert.doesNotMatch(strippedProductionHtml, /banko skor/i, 'Bahis dili iceren ornek sohbet mesaji production HTML’ine girmemeli.');
assert.doesNotMatch(strippedProductionHtml, /XYZ Bot/, 'Sahte bot mesaji production HTML’ine girmemeli.');
assert.doesNotMatch(strippedProductionHtml, /side-chat-prototype/, 'Sohbet prototipi production paketinden tamamen cikarilmali.');
assert.doesNotMatch(strippedProductionHtml, /Supabase baglantisi hazirlanacak|Supabase bağlantısı hazırlanacak/, 'Ic gelistirme durumu kullaniciya gosterilmemeli.');
// Prototip gelistirmede kalsa bile sahte uye mesaji tohumlanmamali.
const prototypeBlock = documentHtml.match(/<div class="side-chat-feed"[\s\S]*?<\/div>/);
if (prototypeBlock) {
  const seededAuthors = prototypeBlock[0].match(/<b>[^<]+<\/b>/g) || [];
  assert.equal(seededAuthors.length, 0, 'Sohbet prototipine ornek kullanici mesaji tohumlanmamali.');
}

// Tazelik etiketi regresyonu.
// Gecmis olay: VERIFIED.kontrol elle yazilmis bir tarih stringiydi ('31 Temmuz 2026')
// ve kullaniciya "Son kontrol" guven etiketi olarak gosteriliyordu. Tarih eskidiginde
// arayuz bunu fark etmiyor, guven bileseni guven kiriyordu.
const dataFreshnessSource = dataSource;
assert.match(dataFreshnessSource, /manualCheck:\s*'\d{4}-\d{2}-\d{2}'/, 'Elle kontrol tarihi ISO formatinda tutulmali (yasi hesaplanabilsin).');
assert.doesNotMatch(dataFreshnessSource, /kontrol:\s*'\d{1,2}\s+\p{L}+\s+\d{4}'/u, 'Elle yazilmis Turkce tarih stringi guven etiketi olarak kullanilmamali.');
assert.match(dataFreshnessSource, /function fixtureFreshness\(/, 'Tazelik etiketi tek bir yardimci uzerinden uretilmeli.');
assert.match(dataFreshnessSource, /DATA_FRESHNESS\.providerUpdatedAt\s*=/, 'Saglayici yanitinin gercek updatedAt degeri kaydedilmeli.');
const liveSource = scriptSources[scriptFiles.indexOf('live.js')];
const matchCenterSource = scriptSources[scriptFiles.indexOf('match-center.js')];
for (const [label, source] of [['live.js', liveSource], ['match-center.js', matchCenterSource]]) {
  assert.doesNotMatch(source, /VERIFIED\.kontrol/, `${label} artik sabit kontrol tarihini kullanmamali.`);
  assert.match(source, /fixtureFreshness\(\)/, `${label} tazelik etiketini yardimci uzerinden almali.`);
}
assert.match(appCss, /v171/, 'Bayat veri gostergesi icin CSS katmani bulunmali.');

assert.match(liveSource, /function renderLiveDetails\([\s\S]*?renderLiveEvents\(details\)[\s\S]*?renderLiveStats\(details,homeName,awayName\)/, 'Canli kart saglayici olay ve istatistiklerini islemeli.');
assert.match(liveSource, /function renderLiveEvents\([\s\S]*?escapeLiveHTML\(/, 'Canli olay provider alanlari escape edilmeli.');
assert.match(liveSource, /function renderLiveStats\([\s\S]*?escapeLiveHTML\(/, 'Canli istatistik provider alanlari escape edilmeli.');
assert.match(liveSource, /function renderLiveFeed\([\s\S]*?renderLiveDetails\(match\)/, 'Canli detaylar her canli mac kartina baglanmali.');

// Ana mac merkezi fixture/date/takim fallback'i tasimamali. Gercek secim
// davranisi scripts/test-matchday-live.mjs ile ayrica calistirilir.
const matchdayLiveSource = scriptSources[scriptFiles.indexOf('matchday-live.js')];
assert.doesNotMatch(matchdayLiveSource, /DEFAULT_FIXTURE_ID|2026-08-14|19746648|Çorum FK|ÇFK/, 'Mac merkezi gecmis fixture veya takim fallbacklerine sabitlenmemeli.');
assert.match(matchdayLiveSource, /\/api\/football\/season\?league=super-lig/, 'Parametre yokken fixture sezon verisinden cozulmeli.');
assert.match(matchdayLiveSource, /toLocaleUpperCase\("tr-TR"\)/, 'Takim kisaltmalari Turkce buyuk harf kuraliyla uretilmeli.');
assert.match(documentHtml, /<h2 id="matchdayTitle"><\/h2><p>Maç bilgisi yükleniyor<\/p>/, 'Kaynak HTML yalnizca notr mac placeholderi icermeli.');

// Mukerrer top-level fonksiyon bildirimi bekcisi.
// Gecmis olay: ui.js icinde 7 fonksiyon iki kez tanimliydi. Tarayicida son tanim
// kazandigi icin ilk tanimi duzenlemek hicbir sey yapmiyordu ve bu sessiz bir
// zaman kaybi kaynagiydi. Ayrica check.mjs ilk tanimi test ettiginden bazi
// kontroller olu kodu dogruluyordu.
for (const [label, source] of scriptFiles.map((file, index) => [file, scriptSources[index]])) {
  const declared = [...source.matchAll(/^function ([A-Za-z_$][\w$]*)\(/gm)].map((match) => match[1]);
  const seen = new Set();
  const duplicated = [...new Set(declared.filter((name) => seen.has(name) || (seen.add(name) && false)))];
  assert.deepEqual(duplicated, [], `${label} icinde ayni fonksiyon birden fazla kez tanimlanmamali: ${duplicated.join(', ')}`);
}

// README ile gercek navigasyon tutarliligi.
// Gecmis olay: README 8 ana brans listeliyordu (Basketbol, Voleybol, Motor
// Sporlari, UFC, Amerikan Futbolu...), index.html'de ise yalnizca 2 sekme vardi.
// Brans dosyalari depoda mevcut ama bekledikleri DOM konteynerleri olmadigi icin
// atil durumda. Bu tutarsizlik devir teslimde yanlis beklenti yaratiyordu.
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const mainTabCount = (documentHtml.match(/class="maintab/g) || []).length;
assert.equal(mainTabCount, 2, 'Ana sekme sayisi degistiyse README navigasyon bolumu de guncellenmeli.');
assert.match(readme, /^### Yayında olmayan branşlar$/m, 'README yayinda olmayan bransları ayri bir bolumde acikca isaretlemeli.');
for (const container of ['multiSportHub', 'xmsData', 'ufcHub', 'sportBranches']) {
  const present = documentHtml.includes(`id="${container}"`);
  assert.equal(present, false, `${container} index.html'e eklendiyse README ve switchMainTab kapsami da guncellenmeli.`);
}

console.log('XYZSkor kontrolü başarılı.');
