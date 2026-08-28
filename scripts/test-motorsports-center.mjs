import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [source, css, snapshotText, buildSource] = await Promise.all([
  readFile(new URL('assets/js/motorsports.js', root), 'utf8'),
  readFile(new URL('assets/css/motorsports-center.css', root), 'utf8'),
  readFile(new URL('assets/data/motorsports-snapshot.json', root), 'utf8'),
  readFile(new URL('scripts/build.mjs', root), 'utf8'),
]);
const snapshot = JSON.parse(snapshotText.replace(/^\uFEFF/, ''));

assert.match(source, /motorsports-snapshot\.json',\s*\{\s*cache:\s*'no-cache'\s*\}/, 'Snapshot freshness must be revalidated in each browser session.');
assert.match(source, /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,120}?snapshotPromise\s*=\s*null;[\s\S]{0,80}?throw error;/, 'A failed snapshot request must not lock out later retries.');
assert.match(buildSource, /motorsports-snapshot\.json[\s\S]{0,500}?versionedSnapshotPath[\s\S]{0,300}?buildVersion/, 'Production snapshot URL must carry the content-derived build version.');

assert.match(source, /xms-center-identity[\s\S]*MOTOR SPORLARI[\s\S]*xms-center-data-state/, 'Seri kimliği ve veri durumu korunmalı.');
assert.match(source, /const categories = \[[\s\S]*single-seater[\s\S]*motorcycle[\s\S]*rally[\s\S]*endurance[\s\S]*stock-car/, 'Motor sporları gerçek yarış aileleriyle sınıflandırılmalı.');
assert.match(source, /seriesPickerHTML[\s\S]*SERİLER[\s\S]*data-classification-key="all"[\s\S]*aria-current/, 'Seri rayı Tümü ve doğrudan seçilebilir gerçek seri bağlantıları sunmalı.');
assert.match(source, /data-mark="MS"[\s\S]*data-mark="\$\{escapeHTML\(config\.mark\)\}"[\s\S]*--series-accent/, 'Her seri gerçek kimliğini büyük yayın işareti ve kendi renk koduyla göstermeli.');
assert.match(source, /data-classification-title/, 'Seçili merkez başlığı ortak sınıflandırma hookunu taşımalı.');
assert.match(source, /data-sport-classification',\s*'series'/, 'Seri rayı ortak sınıflandırma hookunu taşımalı.');
assert.match(source, /seriesHref[\s\S]*view[\s\S]*updateRouteQuery[\s\S]*history\[replace \? 'replaceState' : 'pushState'\]/, 'Seri görünümü paylaşılabilir URL sorgusunda korunmalı.');
assert.match(source, /function seriesHref\(slug, view[\s\S]*viewsFor\(slug\)\.some[\s\S]*targetView !== 'overview'/, 'Seri geçişi görünümü yalnız hedef seri destekliyorsa URL’ye taşımalı.');
assert.match(source, /addEventListener\('popstate'[\s\S]*viewFromLocation/, 'Geri ve ileri navigasyonunda seçili görünüm URL ile eşitlenmeli.');
assert.match(source, /role="tablist"[\s\S]*aria-selected[\s\S]*ArrowLeft[\s\S]*ArrowRight/, 'Görünüm sekmeleri klavye ile yönetilebilmeli.');
assert.match(source, /overviewLoadingHTML[\s\S]*xms-center-layout[\s\S]*xms-center-skeleton/, 'İki kolonlu merkez yüklenirken shimmer göstermeli.');
assert.match(source, /xms-center-metrics[\s\S]*SEZON PROGRAMI[\s\S]*YAKLAŞAN[\s\S]*TAMAMLANAN[\s\S]*SIRALAMA/, 'Özet metrikleri gerçek kapsamı ifade etmeli.');
assert.match(source, /rankingGroupsHTML[\s\S]*xms-ranking-table[\s\S]*caption[\s\S]*scope="col"/, 'Sıralama semantik tablo olarak sunulmalı.');
assert.match(source, /normalizeRanking[\s\S]*Array\.isArray\(item\?\.rows\)[\s\S]*data-sport-classification="championship-class"/, 'Alt şampiyona sınıfı rayı yalnız sağlayıcı grup satırlarından üretilmeli.');
assert.match(source, /aria-controls="xmsRankingGroup-[\s\S]*tabindex=[\s\S]*data-xms-ranking-class[\s\S]*data-classification-key/, 'Sağlayıcı sınıf seçicileri ortak hook ve erişilebilir tab ilişkisi taşımalı.');
assert.doesNotMatch(source, /function classSwitchHTML/, 'Statik veya sağlayıcıdan gelmeyen şampiyona sınıf rayı üretilmemeli.');
assert.match(source, /Puan veya pozisyon bulunmadığında katılımcılar sıralamaymış gibi gösterilmez/, 'Eksik sıralama verisi dürüst boş durum göstermeli.');
assert.match(source, /snapshotResource[\s\S]*degraded: true/, 'Dinamik sağlayıcı kesildiğinde yalnız gerçek snapshot kaydı kullanılmalı.');
assert.match(source, /api\(slug, 'events'[\s\S]*api\(slug, rankingResource\(slug\)[\s\S]*api\(slug, 'teams'/, 'Özet takvim, sıralama ve takım kapsamını yalnız seçili seri slugı ile istemeli.');
assert.match(source, /unknownSeriesState[\s\S]*Başka bir serinin verisi bu adrese yerleştirilmedi/, 'Bilinmeyen seri rotası başka seriden veri uydurmadan açıklanmalı.');
assert.match(source, /href="\/ufc\/">UFC/, 'Yedek spor navigasyonunda UFC geçişi korunmalı.');
assert.doesNotMatch(source, /data:image\/svg\+xml|<svg/i, 'Model üretimi inline SVG fallback kullanılmamalı.');
assert.doesNotMatch(source, /Hypercar<\/button>|LMGT3<\/button>|puan:\s*\d|points:\s*\d/i, 'Arayüz sabit sıralama veya sahte sınıf verisi üretmemeli.');

assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1\.65fr\)\s*minmax\(330px,\s*\.85fr\)/, 'Masaüstü iki kolonlu lig merkezi yerleşimi korunmalı.');
assert.match(css, /@keyframes xmsShimmer[\s\S]*xms-center-skeleton-row/, 'Soğuk yüklemede shimmer animasyonu bulunmalı.');
assert.match(css, /animation-delay:\s*calc\(var\(--xms-row-index/, 'Gerçek satırlar kademeli yüklenmeli.');
assert.match(css, /xms-center-series-picker\s*>\s*div[\s\S]*overflow-x:\s*auto[\s\S]*overscroll-behavior-inline:\s*contain/, 'Seri rayı dar ekran ve dokunmatik kullanımda yatay kaydırılabilmeli.');
assert.match(css, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)[\s\S]*content:\s*attr\(data-mark\)[\s\S]*border-top:\s*3px solid var\(--series-accent\)/, 'Masaüstü seri atlası büyük, renk kodlu ve görsel olarak ayırt edilebilir kartlar kullanmalı.');
assert.match(css, /:focus-visible[\s\S]*outline:/, 'Klavye odağı görünür olmalı.');
assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*grid-template-columns:\s*1fr/, 'Dar ekranda iki kolon tek kolona düşmeli.');
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none/, 'Hareket azaltma tercihi desteklenmeli.');
assert.match(css, /@media \(forced-colors:\s*active\)/, 'Zorunlu renkler erişilebilirliği desteklenmeli.');

const snapshotRows = (sport, resource) => {
  const payload = snapshot.sports?.[sport]?.[resource];
  if (Array.isArray(payload)) return payload;
  for (const key of ['data', 'value', 'rows']) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
};

for (const slug of ['formula-1', 'formula-e', 'indycar', 'motogp', 'moto2', 'moto3', 'wrc', 'wec', 'le-mans', 'nascar']) {
  assert.ok(snapshot.sports?.[slug], `${slug}: gerçek snapshot kapsamı bulunmalı.`);
}
assert.ok(snapshotRows('formula-1', 'events').length > 0, 'Formula 1 takvimi gerçek snapshot kaydı içermeli.');
assert.ok(snapshotRows('formula-1', 'standings-drivers').every((row) => row.position != null && row.points != null), 'Formula 1 sıralama satırları sağlayıcı pozisyonu ve puanı içermeli.');
assert.ok(snapshotRows('wec', 'standings').some((group) => Array.isArray(group.rows) && group.rows.length), 'WEC sınıf sıralamaları sağlayıcı gruplarından gelmeli.');

console.log('motorsports center contract: ok');
