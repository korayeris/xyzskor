import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const documentHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../assets/css/app.css', import.meta.url), 'utf8');
const scriptFiles = ['data.js', 'live.js', 'match-center.js', 'ui.js'];
const scriptSources = await Promise.all(scriptFiles.map((file) => readFile(new URL(`../assets/js/${file}`, import.meta.url), 'utf8')));
const appSource = scriptSources.join('\n');
const html = [documentHtml, appCss, appSource].join('\n');
const liveFunction = await readFile(new URL('../supabase/functions/football-live/index.ts', import.meta.url), 'utf8');
const coreMigration = await readFile(new URL('../supabase/migrations/20260802180000_platform_core.sql', import.meta.url), 'utf8');
const leaderboardMigration = await readFile(new URL('../supabase/migrations/20260802181000_server_leaderboard.sql', import.meta.url), 'utf8');
const editorialMigration = await readFile(new URL('../supabase/migrations/20260802182000_editorial_operations.sql', import.meta.url), 'utf8');
const migrationFiles = (await readdir(new URL('../supabase/migrations/', import.meta.url))).filter((file) => file.endsWith('.sql'));
const migrationVersions = migrationFiles.map((file) => file.split('_')[0]);
assert.equal(new Set(migrationVersions).size, migrationVersions.length, 'Supabase migration sürüm numaraları benzersiz olmalı.');
const buildScript = await readFile(new URL('./build.mjs', import.meta.url), 'utf8');
const legalIndex = await readFile(new URL('../legal/index.html', import.meta.url), 'utf8');
const legalConfig = await readFile(new URL('../assets/legal/legal-config.js', import.meta.url), 'utf8');
assert.match(documentHtml, /assets\/css\/app\.css/, 'Harici uygulama stili yüklenmeli.');
assert.match(documentHtml, /legal\/kvkk-aydinlatma\.html/, 'Ana sayfadan KVKK Aydınlatma bağlantısı bulunmalı.');
assert.match(documentHtml, /legal\/cerez-politikasi\.html/, 'Ana sayfadan Çerez Politikası bağlantısı bulunmalı.');
assert.doesNotMatch(documentHtml, /HİSLER DEĞİL, VERİLER KONUŞUR|>YASAL BİLGİLER</, 'Kaldırılan sloganlı alt metin geri gelmemeli.');
assert.doesNotMatch(documentHtml, /assets\/legal\/(?:xyz-legal\.css|consent\.js)/, 'Yasal merkez tasarımı ana sayfanın görünümünü değiştirmemeli.');
assert.match(legalIndex, /Yasal Merkez/, 'Yasal Merkez giriş sayfası bulunmalı.');
assert.match(legalConfig, /Şirket kuruluşundan sonra yayımlanacak/, 'Kuruluş öncesi kurumsal alanlar açıkça beklemede gösterilmeli.');
assert.match(buildScript, /resolve\(root, "legal"\)/, 'Yasal sayfalar production paketine kopyalanmalı.');
assert.doesNotMatch(documentHtml, /<style>[\s\S]*<\/style>/i, 'Uygulama CSS’i index.html içine geri taşınmamalı.');
assert.doesNotMatch(documentHtml, /<script>\s*[\s\S]+?<\/script>/i, 'Uygulama JavaScript’i index.html içine geri taşınmamalı.');
for (const file of scriptFiles) assert.match(documentHtml, new RegExp(`assets/js/${file.replace('.', '\\.')}"`), `${file} sayfaya bağlanmalı.`);
scriptSources.forEach((source, index) => new vm.Script(source, { filename: `assets/js/${scriptFiles[index]}` }));

function functionSource(name) {
  const start = appSource.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} fonksiyonu bulunamadı.`);
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
assert.match(html, /id="footballNewsStream"/i, 'Futbol alanında gerçek içerik akışı bulunmalı.');
assert.match(html, /id="footballTransferStream"/i, 'Futbol alanında kaynaklı transfer modülü bulunmalı.');
assert.match(html, /id="footballStandingsCompact"/i, 'Futbol alanında puan durumu özeti bulunmalı.');
assert.match(html, /id="footballContextNav"[^>]*aria-label="Futbol bölümleri"/i, 'Futbol içinde maç, gündem, transfer ve puan durumu erişimi bulunmalı.');
assert.match(html, /id="footballTeamStrip"/i, 'Futbol alanında gerçek veriden üretilen takım filtresi bulunmalı.');
assert.match(html, /id="portalSponsorBanner"/i, 'Futbol portalında üst sponsor envanteri bulunmalı.');
assert.match(html, /id="portalSponsorRail"/i, 'Futbol portalında sağ sponsor envanteri bulunmalı.');
assert.match(html, /grid-template-columns:340px minmax\(0,1fr\) 290px/i, 'Masaüstü Futbol görünümü üç kolonlu portal düzenini kullanmalı.');
assert.match(html, /prefers-reduced-motion:reduce/i, 'Yeni portal hareket azaltma tercihini desteklemeli.');
assert.match(functionSource('selectFootballTeam'), /renderFootballQuickMatches\(\).*renderFootballNews\(\).*renderFootballTransfers\(\)/s, 'Takım filtresi maç, gündem ve transfer akışını birlikte yenilemeli.');
assert.doesNotMatch(functionSource('renderPortalSponsor'), /\d\s*TL\b|fiyat|satın al/i, 'Portal sponsor alanı fiyat veya satın alma çağrısı üretmemeli.');
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

const crestBlock = html.match(/const TEAM_CRESTS = \{([\s\S]*?)\n\};/);
assert.ok(crestBlock, 'Kulüp arması haritası bulunmalı.');
const crestUrls = crestBlock[1].match(/https:\/\/upload\.wikimedia\.org[^'\"]+/g) || [];
assert.equal(new Set(crestUrls).size, 18, 'Sitedeki 18 kulüp için 18 farklı gerçek arma bulunmalı.');

console.log('XYZSkor kontrolü başarılı.');
