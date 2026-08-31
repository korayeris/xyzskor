import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [source, css, snapshotText, buildSource, photoCreditsText] = await Promise.all([
  readFile(new URL('assets/js/motorsports.js', root), 'utf8'),
  readFile(new URL('assets/css/motorsports-center.css', root), 'utf8'),
  readFile(new URL('assets/data/motorsports-snapshot.json', root), 'utf8'),
  readFile(new URL('scripts/build.mjs', root), 'utf8'),
  readFile(new URL('assets/legal/motorsports-image-credits.json', root), 'utf8'),
]);
const snapshot = JSON.parse(snapshotText.replace(/^\uFEFF/, ''));
const photoCredits = JSON.parse(photoCreditsText);

assert.match(source, /motorsports-snapshot\.json',\s*\{\s*cache:\s*'no-cache'\s*\}/, 'Snapshot freshness must be revalidated in each browser session.');
assert.match(source, /\.catch\(\(error\)\s*=>\s*\{[\s\S]{0,120}?snapshotPromise\s*=\s*null;[\s\S]{0,80}?throw error;/, 'A failed snapshot request must not lock out later retries.');
assert.match(buildSource, /motorsports-snapshot\.json[\s\S]{0,500}?versionedSnapshotPath[\s\S]{0,300}?buildVersion/, 'Production snapshot URL must carry the content-derived build version.');

assert.match(source, /xms-center-identity[\s\S]*MOTOR SPORLARI[\s\S]*xms-center-data-state/, 'Seri kimliği ve veri durumu korunmalı.');
assert.match(source, /const categories = \[[\s\S]*single-seater[\s\S]*motorcycle[\s\S]*rally[\s\S]*endurance[\s\S]*stock-car/, 'Motor sporları gerçek yarış aileleriyle sınıflandırılmalı.');
assert.match(source, /seriesPickerHTML[\s\S]*SERİLER[\s\S]*data-classification-key="all"[\s\S]*aria-current/, 'Seri rayı Tümü ve doğrudan seçilebilir gerçek seri bağlantıları sunmalı.');
assert.match(source, /data-mark="\$\{escapeHTML\(config\.mark\)\}"[\s\S]*--series-accent:\$\{escapeHTML\(config\.accent\)\}/, 'Her seri gerçek kimliğini ve kendi renk kodunu taşımalı.');
assert.match(source, /data-mark="◉"[\s\S]*data-classification-key="all"|data-classification-key="all"[\s\S]*data-mark="◉"/, 'Tüm seriler kartı ayrı bir yayın işareti taşımalı.');
assert.match(source, /motorsportPhotos[\s\S]*formula-1-cc\.webp[\s\S]*formula-e-cc\.webp[\s\S]*indycar-cc\.webp[\s\S]*motogp-cc\.webp[\s\S]*moto2-cc\.webp[\s\S]*moto3-cc\.webp[\s\S]*rally-cc\.webp[\s\S]*endurance-cc\.webp[\s\S]*stock-car-cc\.webp/, 'Seri atlası yalnız yerel, lisans kaydı bulunan gerçek yarış fotoğraflarını kullanmalı.');
assert.match(source, /moto2:[^\n]*photo:\s*'moto2'[\s\S]*moto3:[^\n]*photo:\s*'moto3'/, 'MotoGP, Moto2 ve Moto3 birbirinden bağımsız fotoğraf anahtarları kullanmalı.');
assert.match(source, /noopener noreferrer license[\s\S]*xms-photo-credits[\s\S]*motorsports-image-credits\.json/, 'Fotoğrafçı, lisans ve kalıcı lisans kaydı kullanıcıya görünür olmalı.');
assert.match(source, /--xms-hero-photo[\s\S]*xms-identity-photo-credit[\s\S]*Fotoğraf:/, 'Seçili seri üst alanı gerçek fotoğraf ve görünür atıf taşımalı.');
assert.match(source, /pickerMeta:\s*'Grand Prix · hibrit'[\s\S]*pickerMeta:\s*'Elektrik · şehir pisti'[\s\S]*pickerMeta:\s*'Toprak · asfalt · kar'[\s\S]*pickerMeta:\s*'24 saat klasiği'/, 'Seri kartları birbirini tekrar etmeyen, disipline özgü kısa açıklamalar taşımalı.');
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
assert.match(css, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)[\s\S]*content:\s*attr\(data-mark\)[\s\S]*var\(--series-photo\)\s+center\s*\/\s*cover/, 'Masaüstü seri atlası büyük, renk kodlu ve gerçek fotoğraflı kartlar kullanmalı.');
assert.match(css, /xms-center-identity[\s\S]*var\(--xms-hero-photo\)[\s\S]*cover no-repeat/, 'Seri kimliği fotoğrafı okunaklı katmanla kaplamalı.');
assert.match(css, /xms-center-mark\.is-wheel[\s\S]*border-radius:\s*50%[\s\S]*conic-gradient/, 'Motor sporları genel kimliği MS harfi yerine kodla çizilmiş teker simgesi kullanmalı.');
assert.match(css, /:focus-visible[\s\S]*outline:/, 'Klavye odağı görünür olmalı.');
assert.match(css, /@media \(max-width:\s*980px\)[\s\S]*grid-template-columns:\s*1fr/, 'Dar ekranda iki kolon tek kolona düşmeli.');
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*animation:\s*none/, 'Hareket azaltma tercihi desteklenmeli.');
assert.match(css, /@media \(forced-colors:\s*active\)/, 'Zorunlu renkler erişilebilirliği desteklenmeli.');
assert.doesNotMatch(`${source}\n${css}`, /motorsport-cinematic-v1|formula-hero-v1|motogp-hero-v1/, 'Motor sporları merkezi yapay görünümlü eski kolajları kullanmamalı.');

assert.equal(photoCredits.assets.length, 9, 'Dokuz özgün fotoğraf türevinin lisans kaydı bulunmalı.');
assert.match(photoCredits.modifications, /cropped to 1280x720[\s\S]*WebP/i, 'Görsel uyarlamaları lisans kaydında açıklanmalı.');
for (const photo of photoCredits.assets) {
  assert.match(photo.source_url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${photo.file}: kaynak birincil Commons dosya sayfası olmalı.`);
  assert.match(photo.license, /^CC BY(?:-SA)? (?:2\.0|4\.0)$/, `${photo.file}: açık Creative Commons lisansı tanımlı olmalı.`);
  assert.match(photo.license_url, /^https:\/\/creativecommons\.org\/licenses\//, `${photo.file}: lisans bağlantısı bulunmalı.`);
  await access(new URL(photo.file.replace(/^\//, ''), root));
}

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
