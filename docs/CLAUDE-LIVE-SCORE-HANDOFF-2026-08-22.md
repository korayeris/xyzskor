# XYZSKOR canlı skor mimarisi — Claude uygulama promptu

Bu belgeyi doğrudan Claude Code'a ver. Yalnız analiz veya öneri üretme: mevcut çalışan özellikleri bozmadan kodu değiştir, migration ve testleri yaz, bütün kontrolleri çalıştır ve atomik commit'lerle teslim et.

## Rol ve çalışma biçimi

Kıdemli backend/platform mühendisi ve test lideri gibi davran. Önce uygulamayı ve Git geçmişini incele. Kullanıcının mevcut değişikliklerini koru. Secret, token, servis rolü anahtarı veya sağlayıcı kimlik bilgisini kaynak koda, loglara, test çıktısına ya da Git geçmişine yazma. Sahte skor, uydurma olay, başka ligden veya başka branştan fallback veri üretme.

Her düzeltmeyi küçük ve açıklayıcı commit'lere ayır. Her commit'ten önce ilgili testleri, finalde bütün QA paketini çalıştır. Başarısız testi atlama, gevşetme veya silme. Sağlayıcı planının gerçekten sunmadığı alanı varmış gibi gösterme.

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
- `.openai/hosting.json`: mevcut Sites projesini ve project ID'yi koru.

## Ana hedef

Canlı maç başladığında kullanıcı sayfayı yenilemeden skor, dakika, devre durumu ve olayları görmeli. Aynı maç için binlerce tarayıcı Sportmonks'a ayrı istek üretmemeli. Sağlayıcı yavaşladığında veya 429/5xx verdiğinde son doğrulanmış snapshot gösterilmeli ve bunun eski olduğu açıkça belirtilmeli. Maç bittikten sonra sonuç kalıcı sezon verisiyle uzlaştırılmalı; puan durumu ve Predict puanlaması yalnız doğrulanmış sonuçtan tetiklenmeli.

## Uygulanacak mimari

### 1. Merkezi ingest ve kalıcı snapshot

Tarayıcıyı sağlayıcı yenilemesinin sahibi olmaktan çıkar. Worker veya Supabase scheduled job, aktif maç pencerelerinde Sportmonks'u kontrollü sorgulasın.

En az şu kalıcı modeli kur:

- `provider_fixtures`: provider, provider_fixture_id, sport, league_key, provider_league_id, season_id, kickoff_utc, home/away provider ID ve canonical state.
- `live_match_snapshots`: fixture_id, sequence/version, status, minute, added_time, home_score, away_score, payload_json, provider_updated_at, fetched_at, expires_at ve checksum.
- `live_match_events`: provider event ID ile unique; fixture, takım, oyuncu, tür, dakika, ek süre, payload ve provider timestamp.
- `provider_sync_runs`: endpoint sınıfı, başlangıç/bitiş, HTTP status, duration, request count, rate-limit bilgisi ve güvenli hata sınıfı.
- Gerekliyse `sync_locks`: aynı lig/fixture için paralel upstream çağrıyı engelleyen kısa süreli lease.

Migration'lar idempotent, RLS açısından güvenli ve rollback/re-apply testine uygun olsun. Public istemci snapshot'ı okuyabilsin; yazma yalnız service role/Worker üzerinden olsun.

### 2. Akıllı yenileme takvimi

- Maça 24 saatten fazla: sezon/fikstür 15–60 dakika.
- 24 saat–60 dakika: 5–15 dakika.
- 60–15 dakika: 60 saniye.
- 15 dakika kala ve maç sürerken: sağlayıcı planı elveriyorsa 5–10 saniye.
- Devre arası: 15 saniye.
- Bitti sinyali sonrası: 15, 60 ve 300 saniyede üç doğrulama; sonra polling'i kapat.
- Ertelendi/iptal/yarıda kaldı: uzun cache ve açık state.

Birden fazla kullanıcı geldiğinde yalnız bir upstream fetch çalışsın. Edge cache, Durable Object, D1/Supabase advisory lock veya mevcut platforma en uygun tekilleştirme yöntemini seç ve gerekçesini belgele. `stale-while-revalidate` ile eski doğrulanmış snapshot'ı kesintisiz sun.

### 3. API sözleşmelerini ayır

Tek pahalı include zincirini her 5 saniyede çağırma:

- `GET /api/football/live?league=...`: yalnız state, dakika, skor ve minimal takım/lig kimliği; hızlı, ucuz, kalıcı snapshot destekli.
- `GET /api/football/matches/:fixtureId/events`: gol/kart/değişiklik; provider event ID ile incremental veya ETag destekli.
- `GET /api/football/matches/:fixtureId/details`: kadro, diziliş, venue, referee, weather; uzun cache.
- `GET /api/football/matches/:fixtureId/statistics`: maç sırasında 30–60 saniye, maç bitince uzun cache.
- Mevcut `/api/football/matchday` geriye uyumluluk adaptörü olabilir fakat içerde bu katmanları birleştirsin.

Her yanıtta en az şu metadata bulunsun:

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

Boş maç listesi ile upstream hatasını aynı şey sayma. `no_live_matches`, `stale_snapshot`, `provider_rate_limited`, `provider_unavailable`, `plan_restricted` ve `not_configured` durumlarını makinece ayrıştırılabilir biçimde döndür.

### 4. Kota ve hata yönetimi

- Sportmonks 429 yanıtında `Retry-After` ve varsa rate-limit header'larını oku.
- Exponential backoff + jitter uygula; kullanıcı kaynaklı force refresh kota kilidini aşmasın.
- Circuit breaker ekle: art arda belirli sayıda 429/5xx sonrası upstream'i kısa süre açma, snapshot sun.
- Minimal live endpoint zengin `events`, `lineups`, `statistics`, `weatherReport` ve `sidelined` include'larını kullanmasın.
- Ayrıntı include'larını ayrı cache anahtarlarıyla sakla ve maç state'ine uygun TTL ver.
- 401/403'ü retry etme; yapılandırma/plan hatası olarak alarm üret.
- HTML veya beklenmeyen content-type dönerse JSON gibi cache'leme.
- Timeout ve abort kullan; tüm hata cevaplarında güvenli hata kodu üret.

### 5. İstemci canlı güncellemesi

- `setInterval` yerine çakışmayan recursive timeout veya scheduler kullan; önceki istek bitmeden yenisini başlatma.
- `document.hidden` iken hızlı polling'i durdur veya 60 saniyeye düşür; görünür olunca hemen yenile.
- `online/offline`, `AbortController`, timeout ve lig değişiminde eski isteği iptal et.
- Response sırasını version/updatedAt ile doğrula; geç gelen eski cevap yeni skoru geri almasın.
- Aynı fixture ID üzerinden `MATCHES`, üst ticker, maç merkezi ve canlı sayfayı tek canonical store'dan güncelle.
- Skor değişince yalnız ilgili DOM parçalarını güncelle; tüm sayfayı yeniden render etme.
- Kontrollü `aria-live` kullan; yalnız skor/state değişiminde duyur.
- `Canlı`, `Son doğrulama HH:mm:ss`, `Veri X sn eski` ve `Son doğrulanmış skor` ayrımını göster.
- Sayfa yenilemeden tamamlanan maç geçmiş tasarımına geçmeli; yaklaşan ve canlı maç görsel durumları açıkça ayrılmalı.

SSE/WebSocket ancak mevcut Sites/Worker altyapısında güvenilir ve maliyet olarak mantıklıysa ekle. Aksi hâlde merkezi 5 saniyelik snapshot + istemci polling yeterlidir. SSE kullanırsan kopma, resume, last-event-id ve fallback polling testlerini yaz.

### 6. Lig ve branş izolasyonu

- İstemciden gelen `league` sağlayıcı filtre otoritesi olmasın; allowlist ve provider league ID eşlemesini sunucu doğrulasın.
- Her fixture için `sport=football`, canonical `league_key` ve izinli `provider_league_id` şart olsun.
- Süper Lig, Premier League, La Liga, Bundesliga ve Serie A cache/snapshot anahtarları birbirinden ayrı olsun.
- `all` isteği yalnız izinli liglerin birleşimi olsun.
- Basketbol, voleybol, UFC ve motor sporları DOM/API/store katmanında futbol snapshot'ını okuyamasın.
- Yanlış lig/branş fixture enjeksiyonuna karşı negatif testler ekle.

### 7. Sonuç kesinleştirme ve Predict

- `FT/AET/PEN` tek başına ödül veya puanlama tetiklemesin; fixture ID, lig, skor ve provider state yeniden doğrulansın.
- Aynı sonuç birden çok kez gelirse idempotent işlenmeli.
- Sonuç transaction içinde kaydedilmeli; ardından outbox/job ile standings refresh ve Predict scoring tetiklenmeli.
- Paralel worker çalışmasında aynı kullanıcıya/fixture'a çift puan veya çift ödül oluşmamalı.
- VAR/düzeltme sonrası değişen sonuç için audit trail ve kontrollü yeniden hesaplama tasarla.

### 8. Gözlemlenebilirlik

Secret sızdırmadan structured log ve sağlık metrikleri ekle:

- Upstream çağrı sayısı, cache hit/miss ve single-flight bekleyen istek sayısı.
- 2xx/401/403/429/5xx dağılımı.
- Provider latency p50/p95, snapshot yaşı ve son başarılı sync.
- Aktif maç sayısı ve fixture başına son sequence.
- Stale cevap sayısı ve lig bazında veri kapsama oranı.

`/api/health` yalnız yapılandırma ve genel durum versin; token, ham provider hata metni veya hassas URL döndürmesin.

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

Mevcut testleri koru ve finalde çalıştır:

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

PostgreSQL/Supabase değiştiyse migration apply → rollback → re-apply, RLS ve parallel transaction testlerini de çalıştır. `npm run check:legal` hukuki placeholder nedeniyle başarısızsa bunu gizleme; ayrı yayın engeli olarak raporla ve testi silme.

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

## Teslim formatı

Son cevapta kök nedenleri, uygulanan mimariyi, değişen dosya/migration listesini, endpoint ve cache sözleşmelerini, gerçek test sonuçlarını, canlı sağlayıcı üzerinde doğrulanamayan maddeleri, açık riskleri, izleme eşiklerini, commit listesini ve push edilen dalı ver.

İşi “kod hazır” diye bitirme. Canlı maç yoksa fake provider ile tüm state machine'i; canlı maç varsa production endpoint'i secret göstermeden uçtan uca doğrula.
