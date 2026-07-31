import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const htmlUrl = new URL('../index.html', import.meta.url);
const html = await readFile(htmlUrl, 'utf8');
const liveFunction = await readFile(new URL('../supabase/functions/football-live/index.ts', import.meta.url), 'utf8');
const match = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/i);

if (!match) {
  throw new Error('Uygulama JavaScript bloğu bulunamadı.');
}

new vm.Script(match[1], { filename: 'index.html:inline-script' });

function functionSource(name) {
  const start = match[1].indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} fonksiyonu bulunamadı.`);
  const bodyStart = match[1].indexOf('{', start);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = bodyStart; index < match[1].length; index += 1) {
    const char = match[1][index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    if (char === '}' && --depth === 0) return match[1].slice(start, index + 1);
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

for (const name of ['computeMatchPoints','weekMatchIds','userStatsForWeek','lifetimeStats','sortRows']) {
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

assert.match(html, /sb\.functions\.invoke\(LIVE_FEED_CONFIG\.functionName/, 'Canlı sekme doğrudan sağlayıcıya değil Edge Function katmanına bağlanmalı.');
assert.doesNotMatch(html, /sportscore\.com/i, 'Görünür veya gizli SportScore bağlantısı bulunmamalı.');
assert.match(liveFunction, /apiFootballAdapter/, 'API-Football adaptörü bulunmalı.');
assert.match(liveFunction, /sportmonksAdapter/, 'Sportmonks geçiş adaptörü bulunmalı.');
assert.match(liveFunction, /FOOTBALL_DATA_PROVIDER/, 'Sağlayıcı ortam ayarıyla seçilebilmeli.');
assert.match(html, /XYZSKOR’da satış yapılmaz/i, 'Mythos alanı XYZSKOR’da satış yapılmadığını açıkça belirtmeli.');
assert.match(html, /Mythos Cards yalnızca ödül sponsorudur/i, 'Mythos rolü yalnızca ödül sponsoru olarak tanımlanmalı.');
assert.doesNotMatch(html, /mythos\.cards\/product\//i, 'Mythos ürün satış sayfalarına yönlendirme bulunmamalı.');
assert.doesNotMatch(html, /(?:\d[\d.]*)\s*TL\b/i, 'Sponsor ödüllerinde fiyat gösterilmemeli.');
assert.doesNotMatch(html, /Satın alma işlemi/i, 'Satın alma çağrısı bulunmamalı.');

assert.doesNotMatch(html, /<section class="content-network"/i, 'Kaldırılan yapay editoryal blok geri gelmemeli.');
assert.doesNotMatch(html, /<div class="inline-campaign"/i, 'Kaldırılan yapay koleksiyon şeridi geri gelmemeli.');
assert.match(html, /viewport-fit=cover/i, 'iPhone güvenli alanları için viewport-fit etkin olmalı.');
assert.match(html, /safe-area-inset-bottom/i, 'iOS alt güvenli alanı desteklenmeli.');
assert.match(html, /\.mobile-bottom-nav\{top:auto;/i, 'Mobil alt menü ekranı kaplamamalı.');

const crestBlock = html.match(/const TEAM_CRESTS = \{([\s\S]*?)\n\};/);
assert.ok(crestBlock, 'Kulüp arması haritası bulunmalı.');
const crestUrls = crestBlock[1].match(/https:\/\/upload\.wikimedia\.org[^'\"]+/g) || [];
assert.equal(new Set(crestUrls).size, 18, 'Sitedeki 18 kulüp için 18 farklı gerçek arma bulunmalı.');

console.log('XYZSkor kontrolü başarılı.');
