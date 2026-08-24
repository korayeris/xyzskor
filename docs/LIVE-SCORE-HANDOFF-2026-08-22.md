# XYZSKOR canlı skor mimarisi — uygulama ve operasyon rehberi

Bu belge, canlı skor mimarisinin uygulanması, işletilmesi ve devralınması için teknik çalışma sözleşmesidir. Mevcut çalışan özelliklerin korunması; kod, migration ve test değişikliklerinin ilgili kontrollerle doğrulanması temel ilkedir.

## Mühendislik ve güvenlik ilkeleri

Değişiklik öncesinde uygulama ve Git geçmişi incelenir; mevcut ve ilgisiz yerel değişiklikler korunur. Secret, token, servis rolü anahtarı veya sağlayıcı kimlik bilgisi kaynak koda, loglara, test çıktısına ya da Git geçmişine yazılmaz. Sahte skor, uydurma olay veya başka ligden ya da branştan fallback veri üretilmez.

Düzeltmeler küçük ve açıklayıcı değişiklik kümelerine ayrılır. İlgili testler her değişiklik kümesi için, bütün QA paketi ise release öncesinde çalıştırılır. Başarısız test atlanmaz, gevşetilmez veya silinmez. Sağlayıcı planının sunmadığı bir alan varmış gibi gösterilmez.

## Mevcut doğrulanmış durum

- Production: `https://xyzskor-tr.korayeris2002.chatgpt.site/`
- Çalışma dalı: `integration/latest-zip-2026-08-17`
- Başlangıç commit'i: `7dbf47159e77bcfc85fded9cc3b36c20fdfa9ae1`
- Futbol kaynağı Sportmonks Football API v3.
- `/api/football/season?league=super-lig` geçerli fikstür ve sonuçları döndürebiliyor.
- `/api/football/live?league=super-lig` yalnız in-play kayıtlarını döndürüyor; istemci yaklaşık 5 saniyede bir sorguluyor, edge cache 5 saniye.
- `/api/football/matchday?fixture=...` zengin ayrıntı isterken Sportmonks rate limit hatasına girebiliyor.
- Son düzeltmeyle temel fikstür varken kota hatası bütün maç kartını “beklemede” ekranına çevirmiyor. Bu geçici dayanıklılık düzeltmesidir; kalıcı canlı veri mimarisi değildir.
- Browser polling var fakat merkezi ve kalıcı live snapshot deposu, scheduled ingest, tekilleştirme kilidi, provider kota bütçesi ve gözlemlenebilirlik eksik.
- Worker hata anında çoğunlukla boş `matches: []` döndürüyor. Edge cache kaybolursa doğrulanmış son canlı skorun kalıcı kopyası yok.
- Canlı skor kartlarındaki güncelleme ana `MATCHES` verisine yalnız sınırlı alanları işliyor; tam skor/state/event birleştirmesi ve maç bittikten sonra kesinleştirme zinciri eksik.

## İncelenecek ana dosyalar

- `worker/index.js`: Sportmonks proxy, normalizasyon, cache ve API route'ları.
- `assets/js/data.js`: global veri durumu ve `LIVE_FEED_CONFIG`.
- `assets/js/live.js`: polling, canlı skor render'ı ve `MATCHES` ile birleştirme.
- `assets/js/matchday-live.js`: tek maç görünümü ve ayrıntı yenileme.
- `assets/js/ui.js`: ana futbol sayfası, ticker, fikstür ve sonuç render zinciri.
- `supabase/migrations/`: kalıcı snapshot/outbox/job tabloları için migration alanı.
- `scripts/test-tools/api_test_harness.mjs`, `scripts/test-worker-hardening.mjs`, `scripts/test-matchday-live.mjs`, `scripts/test-live-details.mjs`: regresyon tabanı.
- `.openai/hosting.json`: mevcut Sites projesi ve project ID'si korunur.

## Ana hedef

Canlı maç başladığında kullanıcı sayfayı yenilemeden skor, dakika, devre durumu ve olayları görmeli. Aynı maç için binlerce tarayıcı Sportmonks'a ayrı istek üretmemeli. Sağlayıcı yavaşladığında veya 429/5xx verdiğinde son doğrulanmış snapshot gösterilmeli ve bunun eski olduğu açıkça belirtilmeli. Maç bittikten sonra sonuç kalıcı sezon verisiyle uzlaştırılmalı; puan durumu ve Predict puanlaması yalnız doğrulanmış sonuçtan tetiklenmeli.

## Uygulanacak mimari

### 1. Merkezi ingest ve kalıcı snapshot

Sağlayıcı yenilemesinin sahibi tarayıcı değildir. Worker veya Supabase scheduled job, aktif maç pencerelerinde Sportmonks'u kontrollü sorgular.

Kalıcı model en az şu bileşenlerden oluşur:

- `provider_fixtures`: provider, provider_fixture_id, sport, league_key, provider_league_id, season_id, kickoff_utc, home/away provider ID ve canonical state.
- `live_match_snapshots`: fixture_id, sequence/version, status, minute, added_time, home_score, away_score, payload_json, provider_updated_at, fetched_at, expires_at ve checksum.
- `live_match_events`: provider event ID ile unique; fixture, takım, oyuncu, tür, dakika, ek süre, payload ve provider timestamp.
- `provider_sync_runs`: endpoint sınıfı, başlangıç/bitiş, HTTP status, duration, request count, rate-limit bilgisi ve güvenli hata sınıfı.
- Gerekliyse `sync_locks`: aynı lig/fixture için paralel upstream çağrıyı engelleyen kısa süreli lease.

Migration'lar idempotent, RLS açısından güvenli ve rollback/re-apply testine uygundur. Public istemci snapshot'ı okuyabilir; yazma yalnız service role/Worker üzerinden yapılır.

### 2. Akıllı yenileme takvimi

- Maça 24 saatten fazla: sezon/fikstür 15–60 dakika.
- 24 saat–60 dakika: 5–15 dakika.
- 60–15 dakika: 60 saniye.
- 15 dakika kala ve maç sürerken: sağlayıcı planı elveriyorsa 5–10 saniye.
- Devre arası: 15 saniye.
- Bitti sinyali sonrası: 15, 60 ve 300 saniyede üç doğrulama; sonra polling'i kapat.
- Ertelendi/iptal/yarıda kaldı: uzun cache ve açık state.

Birden fazla kullanıcı geldiğinde yalnız bir upstream fetch çalışır. Tekilleştirme, edge cache, Durable Object, D1/Supabase advisory lock veya mevcut platforma uygun eşdeğer bir yöntemle sağlanır ve seçimin gerekçesi mimari kayıtta tutulur. `stale-while-revalidate`, eski doğrulanmış snapshot'ı kesintisiz sunar.

### 3. API sözleşmelerini ayır

Tek pahalı include zincirini her 5 saniyede çağırma:

- `GET /api/football/live?league=...`: yalnız state, dakika, skor ve minimal takım/lig kimliği; hızlı, ucuz, kalıcı snapshot destekli.
- `GET /api/football/matches/:fixtureId/events`: gol/kart/değişiklik; provider event ID ile incremental veya ETag destekli.
- `GET /api/football/matches/:fixtureId/details`: kadro, diziliş, venue, referee, weather; uzun cache.
- `GET /api/football/matches/:fixtureId/statistics`: maç sırasında 30–60 saniye, maç bitince uzun cache.
- Mevcut `/api/football/matchday` geriye uyumluluk adaptörü olabilir fakat içerde bu katmanları birleştirsin.

Her yanıt en az şu metadata'yı içerir:

```json
{
  "provider": "sportmonks",
  "league": "super-lig",
  "updatedAt": "ISO-8601",
  "providerUpdatedAt": null,
  "stale": false,
  "staleAgeSeconds": 0,
  "degraded": false,
  "nextRefreshInSeconds": 5,
  "matches": []
}
```

Boş maç listesi ile upstream hatası farklı durumlardır. `no_live_matches`, `stale_snapshot`, `provider_rate_limited`, `provider_unavailable`, `plan_restricted` ve `not_configured` durumları makinece ayrıştırılabilir biçimde döndürülür.

### 4. Kota ve hata yönetimi

- Sportmonks 429 yanıtında `Retry-After` ve varsa rate-limit header'ları okunur.
- Exponential backoff + jitter uygulanır; kullanıcı kaynaklı force refresh kota kilidini aşamaz.
- Circuit breaker, art arda belirli sayıda 429/5xx sonrasında upstream'i kısa süre devre dışı bırakır ve snapshot sunar.
- Minimal live endpoint zengin `events`, `lineups`, `statistics`, `weatherReport` ve `sidelined` include'larını kullanmaz.
- Ayrıntı include'ları ayrı cache anahtarlarında, maç state'ine uygun TTL ile saklanır.
- 401/403 yeniden denenmez; yapılandırma/plan hatası olarak alarm üretilir.
- HTML veya beklenmeyen content-type JSON gibi cache'lenmez.
- Timeout ve abort uygulanır; tüm hata cevaplarında güvenli hata kodu üretilir.

### 5. İstemci canlı güncellemesi

- `setInterval` yerine çakışmayan recursive timeout veya scheduler kullanılır; önceki istek bitmeden yenisi başlatılmaz.
- `document.hidden` iken hızlı polling durur veya 60 saniyeye düşer; sayfa görünür olunca hemen yenilenir.
- `online/offline`, `AbortController`, timeout ve lig değişimi eski isteği iptal eder.
- Response sırası version/updatedAt ile doğrulanır; geç gelen eski cevap yeni skoru geri alamaz.
- Aynı fixture ID üzerindeki `MATCHES`, üst ticker, maç merkezi ve canlı sayfa tek canonical store'dan güncellenir.
- Skor değişince yalnız ilgili DOM parçaları güncellenir; tüm sayfa yeniden render edilmez.
- Kontrollü `aria-live` yalnız skor/state değişiminde duyuru yapar.
- `Canlı`, `Son doğrulama HH:mm:ss`, `Veri X sn eski` ve `Son doğrulanmış skor` ayrımı kullanıcıya gösterilir.
- Sayfa yenilemeden tamamlanan maç geçmiş tasarımına geçmeli; yaklaşan ve canlı maç görsel durumları açıkça ayrılmalı.

SSE/WebSocket yalnız mevcut Sites/Worker altyapısında güvenilir ve maliyet açısından uygunsa kullanılır. Aksi hâlde merkezi 5 saniyelik snapshot + istemci polling yeterlidir. SSE seçeneğinde kopma, resume, last-event-id ve fallback polling testleri zorunludur.

### 6. Lig ve branş izolasyonu

- İstemciden gelen `league` sağlayıcı filtre otoritesi değildir; allowlist ve provider league ID eşlemesini sunucu doğrular.
- Her fixture için `sport=football`, canonical `league_key` ve izinli `provider_league_id` zorunludur.
- Süper Lig, Premier League, La Liga, Bundesliga ve Serie A cache/snapshot anahtarları birbirinden ayrıdır.
- `all` isteği yalnız izinli liglerin birleşimidir.
- Basketbol, voleybol, UFC ve motor sporları DOM/API/store katmanında futbol snapshot'ını okuyamaz.
- Yanlış lig/branş fixture enjeksiyonu negatif testlerle engellenir.

### 7. Sonuç kesinleştirme ve Predict

- `FT/AET/PEN` tek başına ödül veya puanlama tetiklemesin; fixture ID, lig, skor ve provider state yeniden doğrulansın.
- Aynı sonuç birden çok kez gelirse idempotent işlenmeli.
- Sonuç transaction içinde kaydedilmeli; ardından outbox/job ile standings refresh ve Predict scoring tetiklenmeli.
- Paralel worker çalışmasında aynı kullanıcıya/fixture'a çift puan veya çift ödül oluşmamalı.
- VAR/düzeltme sonrası değişen sonuç için audit trail ve kontrollü yeniden hesaplama bulunur.

### 8. Gözlemlenebilirlik

Structured log ve sağlık metrikleri secret sızdırmadan tutulur:

- Upstream çağrı sayısı, cache hit/miss ve single-flight bekleyen istek sayısı.
- 2xx/401/403/429/5xx dağılımı.
- Provider latency p50/p95, snapshot yaşı ve son başarılı sync.
- Aktif maç sayısı ve fixture başına son sequence.
- Stale cevap sayısı ve lig bazında veri kapsama oranı.

`/api/health` yalnız yapılandırma ve genel durum verir; token, ham provider hata metni veya hassas URL döndürmez.

## Zorunlu otomatik testler

1. Canlı maç yok: 200 + `no_live_matches`, hata değil.
2. Tek canlı maç: skor/dakika/state doğru normalize edilir.
3. Lig dışı fixture filtrelenir.
4. Başka branş verisi futbol cevabına giremez ve tersi.
5. 20 paralel istemci en fazla bir upstream çağrı üretir.
6. 429 + geçerli snapshot: 200 stale snapshot ve doğru metadata.
7. 429 + snapshot yok: açık 503/429; sahte boş başarı yok.
8. 500, timeout, HTML response ve bozuk JSON senaryoları.
9. Geç gelen eski cevap yeni skoru geri alamaz.
10. Sayfa gizlenince polling yavaşlar, görünür olunca hemen yenilenir.
11. Lig değişiminde eski request abort edilir ve veri sızmaz.
12. Skor 0–0 değerleri `null` sanılmaz.
13. Devre arası, uzatma, penaltılar, ertelenme, iptal ve yarıda kalma state'leri.
14. Maç sonu üç doğrulama ve polling'in kapanması.
15. Event deduplication: aynı gol iki kez görünmez.
16. Edge cache kaybında kalıcı snapshot çalışır.
17. Predict sonuçlandırması idempotent ve paralel güvenli.
18. 320/375/390/768/1440 görsel kontrollerinde ticker ve kartlar kaymaz.
19. Fake clock ile maç öncesi → canlı → devre → bitti geçişi.
20. API yanıtında token, internal stack veya hassas provider mesajı bulunmaz.

Release doğrulamasında mevcut testler korunur ve aşağıdaki komutlar çalıştırılır:

```powershell
npm run check
npm run qa:api
npm run qa:hardening
npm run qa:matchday
npm run qa:live-details
npm run qa:football-predictions
npm run qa:responsive
npm run qa:responsive:nodata
npm run build
```

PostgreSQL/Supabase değişikliklerinde migration apply → rollback → re-apply, RLS ve paralel transaction testleri de zorunludur. `npm run check:legal` hukuki placeholder nedeniyle başarısızsa bu durum ayrı bir yayın engeli olarak kaydedilir; test kaldırılmaz veya sonucu gizlenmez.

## Kabul kriterleri

- Gerçek bir in-play fixture üzerinde sayfa yenilenmeden skor/state güncelleniyor.
- 100 eşzamanlı tarayıcı sağlayıcıya 100 ayrı istek üretmiyor.
- 429/5xx sırasında son doğrulanmış skor kaybolmuyor ve stale etiketi doğru.
- Provider verisi olmadan canlı skor veya olay uydurulmuyor.
- Her lig ve branş kesin izole.
- Maç bittikten sonra polling duruyor, sonuç doğrulanıyor ve idempotent işleniyor.
- Sonsuz “beklemede” yok; gerçek durum açıklanıyor.
- Zorunlu testler ve build yeşil.
- README; mimari, kurulum, env, endpoint sözleşmesi, cache/polling tablosu, hata durumları, test komutları, deployment ve operasyon runbook'u ile güncel.

## Release kanıtı

Release kaydı; kök nedenleri, uygulanan mimariyi, değişen dosya ve migration listesini, endpoint ve cache sözleşmelerini, gerçek test sonuçlarını, canlı sağlayıcı üzerinde doğrulanamayan maddeleri, açık riskleri, izleme eşiklerini, commit listesini ve yayımlanan dalı içerir.

Canlı maç bulunmadığı dönemlerde bütün durum makinesi kontrollü sağlayıcı fixture'larıyla doğrulanır. Canlı maç bulunduğunda production endpoint'i, hiçbir secret açığa çıkarılmadan uçtan uca gözlemlenir.
