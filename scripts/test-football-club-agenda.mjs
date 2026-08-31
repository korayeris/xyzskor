import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [worker, ui, early, css, agendaScript, agenda, credits, index, build] = await Promise.all([
  readFile(new URL('worker/index.js', root), 'utf8'),
  readFile(new URL('assets/js/ui.js', root), 'utf8'),
  readFile(new URL('assets/js/football-early.js', root), 'utf8'),
  readFile(new URL('assets/css/app-late.css', root), 'utf8'),
  readFile(new URL('assets/js/sports-agenda.js', root), 'utf8'),
  readFile(new URL('assets/data/sports-agenda.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('assets/legal/sports-agenda-image-credits.json', root), 'utf8').then(JSON.parse),
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('scripts/build.mjs', root), 'utf8'),
]);

assert.match(worker, /slice\(-10\)\.reverse\(\)/, 'Futbol ana sayfası lig başına son 10 tamamlanmış maçı taşımalı.');
assert.match(worker, /include:\s*"lineups\.player;lineups\.position;formations;sidelined\.player"/, 'Kulüp profili son maçın yedek ve eksik ilişkisini istemeli.');
assert.match(worker, /bench:\s*fixtureBenchForTeam[\s\S]*absences:\s*fixtureAbsencesForTeam/, 'Kulüp profili yedek ve eksik oyuncuları ayrı alanlarda yayımlamalı.');
assert.match(ui, /Şu anda canlı maç yok\.[\s\S]*Geçmiş maç kaydı bulunamadı\.[\s\S]*Yaklaşan maç henüz açıklanmadı\./, 'Tam futbol görünümü her boş filtre için açık durum vermeli.');
assert.match(early, /Şu anda canlı maç yok\.[\s\S]*Geçmiş maç kaydı bulunamadı\.[\s\S]*Yaklaşan maç henüz açıklanmadı\./, 'Erken futbol görünümü tam görünümle aynı filtre sözleşmesini taşımalı.');
assert.match(ui, /clubAvailabilityHTML[\s\S]*Yedek kulübesi[\s\S]*Cezalılar[\s\S]*Sakat \/ uygun değil/, 'Kulüp arayüzü yedek, cezalı ve sakat/uygun değil panellerini ayırmalı.');
assert.match(css, /\.club-match-squad-layout[\s\S]*aspect-ratio:16\/10[\s\S]*@media\(max-width:620px\)/, 'Saha ve maç kadrosu masaüstü ile mobilde kontrollü geometri kullanmalı.');

for (const sport of ['basketball', 'volleyball', 'ufc', 'motorsports']) {
  const items = agenda.sports?.[sport];
  assert.ok(Array.isArray(items) && items.length >= 2, `${sport} için en az iki manuel gündem kaydı bulunmalı.`);
  for (const item of items) {
    assert.match(item.sourceUrl, /^https:\/\//, `${sport} gündem kaydı HTTPS kaynak taşımalı.`);
    assert.match(item.creditUrl, /^https:\/\//, `${sport} gündem görseli görünür lisans/kredi bağlantısı taşımalı.`);
    assert.ok(item.title && item.summary && item.image && item.imageAlt, `${sport} gündem kaydı başlık, özet ve erişilebilir görsel taşımalı.`);
    await access(new URL(item.image.replace(/^\//, ''), root));
  }
}
for (const sport of ['basketball', 'volleyball']) {
  const images = agenda.sports[sport].map((item) => item.image);
  assert.equal(new Set(images).size, images.length, `${sport} gündem kartları aynı fotoğrafı tekrar kullanmamalı.`);
}
const creditedImages = new Set(credits.images.map((item) => item.file));
for (const items of Object.values(agenda.sports)) {
  for (const item of items) assert.ok(creditedImages.has(item.image), `${item.image} kalıcı lisans manifestinde kayıtlı olmalı.`);
}
assert.ok(Array.isArray(credits.images) && credits.images.length >= 5, 'Gündem görselleri kalıcı lisans manifestinde kayıtlı olmalı.');
assert.match(agendaScript, /let refreshToken = 0[\s\S]*const token = \+\+refreshToken[\s\S]*token !== refreshToken/, 'Eşzamanlı gündem yenilemeleri yalnız son renderı yazabilmeli.');
assert.match(agendaScript, /document\.currentScript[\s\S]*sports-agenda\.json\?v=\$\{encodeURIComponent\(scriptVersion\)\}/, 'Gündem verisi her üretim sürümünde eski tarayıcı önbelleğini aşmalı.');
assert.match(agendaScript, /querySelectorAll\('\[data-sports-agenda\]'\)[\s\S]*existing\.length === 1[\s\S]*forEach\(\(item\) => item\.remove\(\)\)/, 'Branş başına en fazla tek gündem bölümü bırakılmalı.');
assert.match(css, /\.sports-agenda-card\{[^}]*position:relative[^}]*min-height:360px[\s\S]*\.sports-agenda-photo\{[^}]*position:absolute[^}]*inset:0/, 'Gündem kartları bölünmüş küçük görsel yerine tam yüzey fotoğraf kullanmalı.');
assert.match(index, /sports-agenda\.js/, 'Gündem katmanı üretim belgesinde yüklenmeli.');
assert.match(build, /"sports-agenda\.js"/, 'Gündem katmanı fingerprint/minify kapsamına alınmalı.');

console.log('OK  Futbol filtreleri, kulüp maç kadrosu ve lisanslı branş gündemi sözleşmeleri geçti.');
