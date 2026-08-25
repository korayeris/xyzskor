# XYZSKOR

## Canlı skor mimarisi (2026-08-24 durumu)

`docs/LIVE-SCORE-HANDOFF-2026-08-22.md` uygulama rehberi doğrultusunda merkezi
ingest, kalıcı snapshot, single-flight kilit, circuit breaker, ayrıştırılmış
API sözleşmeleri ve şema-güvenli sonuç kesinleştirmesi artık kodda mevcut ve
gerçek testlerle doğrulandı (bkz. [Test ve build sonuçları](#test-ve-build-sonuçları)).

Sportmonks Playground üzerinde skor, fikstür, kadro ve istatistik alanları
doğrulandı; ancak gerçek bir in-play maç başlangıçtan bitişe kadar izlenmedi.
Tek fikstüre özel kurtarma verisi kaldırıldı;
aynı snapshot, kilit ve kota koruması artık seçili liglerdeki her fikstür için
fikstür kimliği üzerinden çalışır.

### Olay kaydı: Maç merkezinde veri neden kayboluyordu?

#### Kullanıcıya görünen hata

Fenerbahçe - Konyaspor maçı oynanırken skor sağlayıcıda `4-1` olmasına rağmen
maç merkezi bir süre `- : -`, `Veri bekleniyor`, sıfır olay, sıfır istatistik
ve boş kadro gösterebiliyordu. Sonradan aynı maç için elle eklenen kurtarma
kaydı görüntüyü düzeltmişti; fakat bu çözüm yalnızca `19746639` numaralı
fikstürü tanıyordu. Başka bir maç açıldığında sistem yeniden boş kalıyordu.

#### Kök nedenler

1. **Kurtarma verisi tek maça sabitlenmişti.** Worker içinde fikstür numarasını
   kontrol eden ve sadece o karşılaşmaya kadro/olay/istatistik döndüren statik
   bir arşiv bulunuyordu. Bu, veri mimarisi değil olay anına özel yamaydı.
2. **Zengin maç verisi kalıcı cache okunmadan sağlayıcıdan isteniyordu.** Her
   sayfa/sekme yenilemesi kadro, diziliş, olay ve istatistik içeren pahalı
   Sportmonks çağrısını yeniden yapabiliyordu. Edge cache processler arasında
   kalıcılık garantisi vermediği için trafik arttığında kota hızla tükeniyordu.
3. **429 veya sağlayıcı kesintisinde genel geri dönüş yoktu.** İlgili maç için
   daha önce doğrulanmış kalıcı kayıt bulunamazsa API `matchday_fetch_failed`
   dönüyor, istemci de gerçekte oynanan maçı boş ekran gibi gösteriyordu.
4. **Sezon fikstürleri maç hazırlama havuzuna yazılmıyordu.** Sistem yaklaşan
   karşılaşmaları topluca bilmiyor; ayrıntı verisini ancak kullanıcı o maçı
   açtıktan sonra istemeye çalışıyordu.
5. **İstemci sabit aralıkla sorguluyordu.** Bitmiş, günler sonra oynanacak ve
   canlı maç aynı sıklıkla yenilenebildiği için gereksiz çağrılar gerçek canlı
   maçların kotasını tüketiyordu.

#### Kalıcı çözüm

- Statik `19746639` kurtarma arşivi ve eski matchday handler'ı tamamen
  kaldırıldı. Kodda takım adına veya belirli fikstür numarasına bağlı üretim
  fallback'i bulunmuyor.
- Her karşılaşma `sportmonks:<fixtureId>` anahtarıyla bağımsız işleniyor.
  Başarılı skor, olay, istatistik, kadro ve diziliş cevabının tamamı
  `live_match_snapshots.payload.matchday` altında saklanıyor.
- API önce kalıcı snapshot'ı okuyor. Snapshot maçın durumuna göre hâlâ tazeyse
  Sportmonks'a gitmeden onu döndürüyor. Taze değilse maç kimliğine özel
  `matchday:<fixtureId>` kilidi alıp yalnızca tek upstream çağrısına izin
  veriyor.
- Sağlayıcı `429`, `5xx`, timeout veya geçersiz içerik döndürürse son
  doğrulanmış snapshot `stale:true`, `staleAgeSeconds` ve makinece okunabilir
  `reason` alanıyla sunuluyor. Daha önce hiç doğrulanmış veri yoksa boş bir
  `200` cevabı uydurulmuyor; açık hata dönüyor.
- Sezon cevaplarındaki bütün maçlar `provider_fixtures` tablosuna yazılıyor.
  Böylece aynı mekanizma Süper Lig, Premier League, La Liga, Bundesliga ve
  Serie A kapsamındaki her fikstüre uygulanıyor. Zamanlanmış hazırlama bu
  kataloğu kullanıyor; doğrudan maç isteği de zamanlayıcıdan bağımsız olarak
  aynı güvenli senkronizasyon yolundan geçiyor.
- Yenileme süresi sunucu tarafından belirleniyor: canlı pencere 10 saniye,
  maç yaklaştıkça 60 saniye/5 dakika, uzak maçlarda 15 dakika–6 saat ve bitmiş
  maçlarda 7 gün. İstemci `nextRefreshInSeconds` değerine uyar.
- Resmî kadro veya diziliş sağlayıcı tarafından henüz yayımlanmadıysa oyuncu
  uydurulmuyor. Arayüz açıkça `Resmî kadro henüz açıklanmadı` mesajını gösterir;
  bu durum API arızasıyla karıştırılmaz.

#### Tekrarını engelleyen kontroller

`scripts/test-matchday-snapshots.mjs` dört genel fikstür senaryosunu doğrular:
taze snapshot'ta sıfır provider çağrısı, 429 sırasında kadronun korunması,
başarılı yeni maç cevabının kalıcılaştırılması ve eşzamanlı kilitte aynı
snapshot'ın sunulması. `scripts/check.mjs` ayrıca üretim Worker'ında
`19746639` veya tek maça özel kurtarma fonksiyonu yeniden görülürse build'i
başarısız yapar. Lig izolasyonu ve sahte boş başarı yasağı da canlı mimari ve
hardening paketlerinde ayrı regresyon testleridir.

### Sayfa kapsamlı hızlı yükleme

Lig değişimi bütün uygulamanın yeniden yüklenmesi değildir. Yalnız seçili lig
sezon paketi başlar; coverage kontrolü kullanıcı açıkça istemedikçe kritik yola
girmez. Geç gelen eski lig cevabı artan istek sırası ile yeni ekranın üzerine
yazamaz. Futbol ekranı Predict liderlik,
profiller ve bütün kullanıcı tahminlerini beklemez. Liderlik RPC'leri yalnız
Predict/Sıralama görünür olduğunda `Genel`, seçili takım ve oturum sahibinin
takımı için çağrılır; aynı kapsamın eşzamanlı istekleri tek promise üzerinde
birleştirilir. X, YouTube ve Instagram modülleri de ilgili bölüm ekrana 600 px
yaklaştığında yüklenir. Lig sezon paketi aynı tarayıcı sekmesinde 10 dakika
paylaşılır; canlı skor doğruluğu ayrı canlı endpoint ve maç snapshot'larıyla
korunur.

[Canlı skor uygulama ve operasyon rehberi](docs/LIVE-SCORE-HANDOFF-2026-08-22.md)

XYZSKOR; koyu, teknik ve mobil uyumlu bir yayın deneyiminde canlı futbol
skorları, ücretsiz tahmin yarışması ve doğrulanmış sağlayıcı kapsamındaki çoklu
spor merkezlerini sunan bir platformdur.

Canlı site: <https://xyzskor-tr.korayeris2002.chatgpt.site>

## Ürün kapsamı

Ana navigasyon:

1. Futbol
2. Basketbol
3. Voleybol
4. Motor Sporları
5. UFC
6. Predict

Branş kabukları `sport-branches.js` tarafından oluşturulur. Çoklu spor sayfaları
yalnızca kendi sağlayıcı verisini gösterir; veri bulunmazsa başka branştan fallback
üretmek yerine açık bir “program bekleniyor” durumu yayınlar.

Temel özellikler (yayında):

- Canlı futbol skoru, dakika, olay, kadro ve maç istatistikleri
- Fikstür, sonuç, puan durumu, takım ve sporcu profilleri
- Resmî sosyal medya ve video akışları
- Ücretsiz Predict yarışması, puanlama ve ödül talepleri
- Üye, admin ve editoryal yetkilendirme
- Mobil ve masaüstü için ortak responsive tasarım

Branş merkezleri:

- Formula 1, Formula E, IndyCar, MotoGP, WRC, WEC, Le Mans ve NASCAR
- UFC etkinlikleri, dövüş kartları, dövüşçü profilleri ve sıralamalar
- Basketbol ve voleybol için branşa izole maç, lig ve takım görünümleri

XYZSKOR bahis sitesi değildir. Oranlar yalnızca ücretsiz Predict oyununun istatistiksel girdisi ve karşılaştırma verisi olarak kullanılabilir. Para yatırma, kupon, bahis oynama veya ödeme akışı bulunmaz.

## Teknoloji

- Vanilla JavaScript ve CSS
- Cloudflare uyumlu Worker
- Supabase Auth, PostgreSQL, RLS ve RPC
- OpenAI Sites production dağıtımı
- Esbuild tabanlı production paketi

## Dizin yapısı

| Yol | Açıklama |
| --- | --- |
| `index.html` | Ana erişilebilir HTML kabuğu |
| `assets/css/app.css` | Ortak tasarım temelleri ve çekirdek responsive düzen |
| `assets/css/football-hub.css` | Kanonik futbol kökü ve beş tek-lig genel bakışı için rota kapsamlı stil katmanı |
| `assets/css/app-late.css` | Fixture, lig alt rotaları, eski modüller ve sohbet için isteğe bağlı geç stil katmanı |
| `assets/js/style-loader.js` | Kanonik rota tespiti, futbol stil hazır bariyeri ve tekilleştirilmiş geç CSS yükleyicisi |
| `assets/js/initial-route.js` | HTML gövdesinin başında rota sınıflarını kurar ve ilk home/season isteğini başlatır |
| `assets/js/football-early.js` | Kök futbol cache/ağ cevabını güvenli DOM API'leriyle erken çizen aggregate renderer |
| `assets/js/data.js` | Veri, Supabase ve sağlayıcı adaptörleri |
| `assets/js/live.js` | Canlı skor ve navigasyon akışı |
| `assets/js/ui.js` | Futbolun çekirdek render ve veri devralma zinciri |
| `assets/js/app-boot.js` | Zorunlu uygulama boot'u ve isteğe bağlı UI eklentilerinin yükleme sınırı |
| `assets/js/ui-extras.js` | Lig alt ekranları ve yan araçlar için kanonik ilk boyamadan ayrılmış eklentiler |
| `assets/js/multisport.js` | Çoklu spor branşları |
| `assets/js/motorsports.js` | Motor sporları sayfaları |
| `assets/js/ufc-hub.js` | UFC merkezi |
| `worker/index.js` | API proxy, cache, normalizasyon ve statik yayın |
| `supabase/` | Migration ve Edge Function kaynakları |
| `supabase/migrations/20260822200000_live_match_infrastructure.sql` | Canlı skor kalıcı snapshot/event/sync şeması |
| `scripts/` | Geliştirme, build ve QA araçları |
| `scripts/test-live-architecture.mjs` | Canlı skor mimarisi regresyon paketi (`npm run qa:live-architecture`) |
| `docs/API-PLANI.md` | Ayrıntılı sağlayıcı, kota ve otomasyon planı |
| `legal/` | Hukuki ve lisans notları |

## Yerel çalıştırma

Gereksinimler:

- Node.js 20 veya üzeri
- npm

```powershell
npm install
npm run dev
```

Ardından `http://127.0.0.1:4173` adresini açın.

Node/npm PATH üzerinde değilse:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

## Production build

```powershell
npm run build
```

Çıktı `dist/` dizinine yazılır. `dist/`, `node_modules/`, loglar ve yayın arşivleri Git'e gönderilmez.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve yalnızca kullandığınız sağlayıcıları doldurun. Production secret'ları Sites/Supabase kontrol panelinde tutulmalıdır.

| Değişken | Amaç |
| --- | --- |
| `SPORTMONKS_API_TOKEN` | Futbol fikstürü, canlı skor ve istatistikler |
| `API_SPORTS_KEY` | Basketbol ve voleybol |
| `CITO_API_KEY` | UFC etkinlik, dövüşçü, sıralama ve istatistik verileri |
| `OCBLACKTOP_API_KEY` | Motor sporları takvim ve sonuç verileri |
| `X_BEARER_TOKEN` | Maliyet kontrollü resmî X akışı |
| `YOUTUBE_API_KEY` | Resmî video ve kapak görselleri |
| `INSTAGRAM_ACCESS_TOKEN` | İzinli Instagram Graph API erişimi |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Bağlı Business/Creator hesap kimliği |
| `SUPABASE_URL` | Supabase proje adresi |
| `SUPABASE_ANON_KEY` | İstemciye açık anonim anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca sunucuda kullanılan yetkili anahtar |

Secret, token, servis rolü anahtarı veya şifre hiçbir zaman kaynak koda, README'ye, `.openai/hosting.json` dosyasına ya da Git geçmişine yazılmaz.

`SUPABASE_SERVICE_ROLE_KEY` tanımlı değilse canlı skor mimarisi (single-flight
kilit, kalıcı snapshot, circuit breaker) fail-open çalışır: tekilleştirme ve
kalıcılık devre dışı kalır ama `/api/football/live` sağlayıcıya doğrudan gider
ve normal şekilde yanıt verir (yerel geliştirme için kullanışlıdır, production
için `SUPABASE_SERVICE_ROLE_KEY` zorunludur).

## Canlı veri sözleşmesi

Futbolun kaynak otoritesi Sportmonks'tur. Arayüz sahte skor veya tahmini olay üretmez.

### Mimari özet

- **Merkezi tekilleştirme:** `/api/football/live` çağrıldığında Worker önce
  Supabase'teki `sync_locks` tablosu üzerinden (`try_acquire_sync_lock` RPC'si)
  kısa süreli bir kilit almayı dener. Kilit alınamazsa (başka bir istek zaten
  upstream'e gitmektedir) Sportmonks'a hiç gidilmez; en son kalıcı snapshot
  sunulur. Bu yöntem, platformun (OpenAI Sites) gerçek Cloudflare Cache
  API/Durable Object garantisi taşıyıp taşımadığı doğrulanamadığı için tercih
  edildi — edge cache yalnızca ek bir hızlandırma katmanı, doğruluk için asla
  tek başına güvenilmez.
- **Kalıcı snapshot:** Her başarılı çekim `live_match_snapshots` tablosuna
  yazılır. Upstream 429/5xx/timeout/geçersiz içerik döndürdüğünde bu tablo
  "son doğrulanmış skor" olarak `stale:true` ve `staleAgeSeconds` ile sunulur;
  boş `matches:[]` asla sahte başarı olarak maskelenmez.
- **Circuit breaker:** `provider_sync_runs` tablosundaki son çağrılar art arda
  başarısızsa (varsayılan: 3 çağrı, 20 saniye pencere) upstream'e hiç
  gidilmez; doğrudan kalıcı snapshot veya açık hata döner.
- **Minimal include:** `/api/football/live` yalnızca `participants;scores;
  league;state` ister. Kadro, olay, istatistik ve hava durumu gibi pahalı
  alanlar bu 5–60 saniyelik hot path'e hiç girmez; ayrı uçlardan (aşağıda)
  kendi cache süreleriyle çekilir.
- **Lig/branş izolasyonu:** İstemciden gelen `league` değeri yalnızca bir
  anahtar seçimidir; gerçek filtre sunucudaki `SELECTED_LEAGUE_IDS_BY_KEY`
  allowlist'i ve `selectedLeagueKeyForProviderLeagueId()` ile yapılır. Başka
  lig/branşın fixture'ı asla sızmaz (bkz. `scripts/test-live-architecture.mjs`).
- **Tüm maçları önceden hazırlama:** Beş seçili ligin sezon fikstürleri en geç
  altı saatte bir `provider_fixtures` tablosuna yazılır. Beş dakikalık cron,
  başlama zamanına dört saat kalmış veya son 26 saat içinde başlamış maçların
  zengin verisini maç kimliği bazında önceden ısıtır.
- **Maç başına yenileme politikası:** Canlı pencere 10 saniye, maç öncesi
  1–15 dakika 60 saniye, 15–60 dakika 5 dakika, 1–2 saat 15 dakika ve bitmiş
  maçlar 7 gün TTL kullanır. İstemci bu süreyi sunucudan alır; her sekme sabit
  aralıkla ayrı ayrı sağlayıcı kotası tüketmez.
- **Kesintide veri koruma:** 429, 5xx, timeout, açık circuit breaker veya başka
  bir eşzamanlı yenileme olduğunda son doğrulanmış kadro, diziliş, olay,
  istatistik ve skor snapshot'ı sunulur; boş başarılı cevap üretilmez.

### Endpoint sözleşmeleri

| Endpoint | Amaç | Cache/TTL |
| --- | --- | --- |
| `GET /api/football/live?league=...` | Skor, dakika, state; minimal include | 5s edge + kalıcı snapshot fallback |
| `GET /api/football/matches/:fixtureId/events` | Gol/kart/değişiklik, ETag destekli | 8s, kalıcı dedup (`live_match_events`) |
| `GET /api/football/matches/:fixtureId/details` | Kadro, diziliş, hakem, hava durumu | 300s/1800s |
| `GET /api/football/matches/:fixtureId/statistics` | Maç istatistikleri | canlıyken 30s, bitince 1800s+ |
| `GET /api/football/matchday?fixture=...` | Maç kimliğine bağlı birleşik skor, olay, istatistik, kadro ve diziliş snapshot'ı | duruma göre 10sn–7gün |
| `GET /api/health` | Yapılandırma + `live_score` gözlemlenebilirlik özeti (secret içermez) | no-store |

`/api/football/live` yanıt gövdesi:

```json
{
  "provider": "sportmonks",
  "league": "super-lig",
  "updatedAt": "ISO-8601",
  "providerUpdatedAt": "ISO-8601 veya null",
  "stale": false,
  "staleAgeSeconds": 0,
  "degraded": false,
  "reason": "no_live_matches | stale_snapshot | provider_rate_limited | provider_unavailable | plan_restricted | not_configured (opsiyonel)",
  "nextRefreshInSeconds": 6,
  "matches": []
}
```

`reason` alanı makinece ayrıştırılabilir hata/duruş sınıfını taşır; `error`
alanı yalnızca geriye dönük uyumluluk için (eski istemci mesajları) korunur.

### İstemci polling davranışı

- `assets/js/live.js`, sabit `setInterval` yerine sunucunun bildirdiği
  `nextRefreshInSeconds` değerine göre kendini ayarlayan recursive
  `setTimeout` kullanır (3sn–300sn arası kelepçelenir).
- Her istek `AbortController` ile iptal edilebilir; lig değişiminde veya yeni
  bir poll başladığında önceki istek iptal edilir.
- Artan bir sıra numarası (`liveFeedRequestSeq`) ile geç gelen eski bir
  cevabın daha yeni skoru geri alması engellenir.
- Sekme gizliyken (`document.hidden`) hızlı polling durur, görünür olunca
  hemen tazelenir. `online`/`offline` olaylarında da aynı davranış uygulanır.
- Maç kartındaki gol/kart/istatistik bölümü artık ana canlı uçtan değil,
  görünen canlı maçlar için lazy olarak çağrılan `/events` ve `/statistics`
  uçlarından (kendi TTL'leriyle) beslenir.

### Sonuç kesinleştirme

`worker/index.js#settlePendingFootballPredictions` (5 dakikalık `scheduled()`
cron'u tarafından tetiklenir) kickoff'u geçmiş ve `status != 'bitti'` olan
maçları `verifiedSportmonksFixture()` ile yeniden doğrular (lig izolasyonu
dahil), sonucu `results` tablosuna idempotent şekilde (on_conflict=match_id)
yazar ve `matches.status`'u `bitti` yapar. Ödül/challenge RPC'si
(`settle_prediction_challenge_match`) fırsatçı olarak ayrıca denenir;
production Supabase şemasında bu RPC ve `matches.challenge_week` kolonu
**henüz uygulanmamış migration backlog'una bağlıdır** (bkz. Bilinen riskler).

- Canlı maç sırasında istemci sunucunun bildirdiği adaptif aralıkla (canlıyken ~6sn, devre arasında ~15sn, boşta ~60sn) `/api/football/live`'a bakar.
- Sağlayıcı kapsamındaki skor, dakika, gol, kart, kadro, diziliş, oyuncu, hakem, hava ve istatistik alanları normalize edilerek sunulur.
- Eksik sağlayıcı verisi başka bir branşın kaydıyla veya uydurma içerikle doldurulmaz.

Galatasaray - Çorum FK örneğinde sistem Sportmonks fikstür kimliği üzerinden karşılaşmayı eşleştirir. Maç sağlayıcı tarafından canlıya alındığında skor ve olaylar otomatik görünür.

## Görsel politikası

Öncelik sırası:

1. API sağlayıcısının lisanslı `image_path`/medya alanları
2. Kulüp, lig ve organizasyonların izinli resmî embed içerikleri
3. Projeye ait veya açık lisanslı görseller
4. Marka ve gerçek kişi taklidi içermeyen, kullanım hakkı doğrulanmış özgün arka planlar
5. Görsel yoksa estetik, branşa özel tipografik placeholder

Sportradar Images veya benzeri ücretli medya paketleri ayrı lisans gerektirir. Lisans doğrulanmadan görsel indirilemez, yeniden dağıtılamaz veya “aktif” gösterilemez.

## Veri otomasyonu

Sistem insan müdahalesi olmadan çalışacak şekilde tasarlanır:

- Canlı etkinlik varken kısa aralık
- Yaklaşan etkinliklerde orta aralık
- Takvim, takım ve sporcu profilinde uzun cache
- X/Instagram/YouTube akışlarında günlük veya kontrollü yenileme
- API başarısızlığında son doğrulanmış cache
- Her kayıtta sağlayıcı, güncellenme zamanı ve branş kimliği

Ayrıntılı plan: [docs/API-PLANI.md](docs/API-PLANI.md)

## Supabase güvenliği

- Tablolarda RLS aktiftir.
- Admin işlemleri sunucu RPC'leri üzerinden yürür.
- Kullanıcı e-postaları yalnızca yetkili admin işlemlerinde döner.
- Admin kendi admin yetkisini arayüzden kaldıramaz.
- Yetki ve ödül işlemleri audit loglarına yazılır.
- Predict puanlama ve ödül talepleri yalnızca sunucu tarafında kesinleşir.

## Test ve build sonuçları

2026-08-24 canlı skor ve futbol bilgi mimarisi release doğrulamasında kaydedilen sonuçlar:

| Komut | Sonuç |
| --- | --- |
| `npm run check` | ✅ Geçti |
| `npm run qa:api` | ✅ 161/161 |
| `npm run qa:hardening` | ✅ 68/68; futbol home/season, canlı, basketbol/voleybol, UFC ve motorsporu single-flight/kota/hata-semantiği kontrolleri dahil |
| `npm run qa:weekly-football` | ✅ Lider tabloları, XYZ Performans Skoru v1, olay tekilleştirme, 11 benzersiz oyunculu diziliş ve 50 eşzamanlı istekte tek upstream kontrolü geçti |
| `npm run qa:weekly-load` | ✅ Yerel stub: 100 aynı-lig istek=1 Topscorers, beş lig=lig başına 1, 50 aynı-tur=1 fixture; p50/p95/p99 raporlandı |
| `npm run qa:matchday` | ✅ Geçti |
| `npm run qa:supabase-lazy` | ✅ Geçti |
| `npm run qa:matchday:snapshots` | ✅ 4/4 genel maç senaryosu |
| `npm run qa:live-details` | ✅ Geçti |
| `npm run qa:football-predictions` | ✅ Geçti (schema-safe finalize için güncellendi) |
| `npm run qa:football-ia` | ✅ Geçti |
| `npm run qa:demand-scope` | ✅ Geçti; görünür rota sahipliği, iptal ve API adetleri doğrulandı |
| `npm run qa:league-contract` | ✅ Beş lig anahtarı/ID'si, Edge Function, sohbet allowlist'i ve ileri/geri migration sözleşmesi geçti |
| `npm run qa:live-architecture` | ✅ 43/43 |
| `npm run qa:live-quota` | ✅ Geçti; `all + 5 lig` paralel fallback çağrısı tek upstream |
| `npm run qa:responsive` (withdata) | ✅ Son kanonik futbol koşusu: 7 viewport × ana sayfa + 5 lig = 42 sayfa, 974/974 kontrol |
| `npm run qa:responsive:nodata` | ✅ 60 sayfa senaryosu, 535/535 kontrol |
| `npm run qa:dist` | ✅ 32/32; kanonik kök, tek-lig, Predict, hesap/sohbet ve açık fixture senaryoları iki ardışık koşuda geçti |
| `npm run qa:perf` | ✅ Release kapısı geçti; ham sonuç `reports/performance/release-performance-report.json` içinde |
| `npm run qa:predict-security` | ✅ Geçti |
| `npm run qa:db` | ⏭️ Çağrıldı; PostgreSQL/psql bulunmadığı için exit 2 ile atlandı. Production şema, RLS ve paralel upsert bu makinede doğrulanmış sayılmaz |
| `npm run build` | ✅ Geçti (dist/ üretildi) |
| `npm run check:legal` | ❌ Başarısız — kuruluş öncesi hukuki placeholder'lar dolu değil. Bu kod değişikliğinden kaynaklanmayan, fakat production yayınını kesin olarak engelleyen açık bir maddedir |

## Haftalık futbol özellikleri

Tek-lig genel bakışlarında gol, asist ve kart liderleri ile Haftanın Yıldızı /
Haftanın 11'i gösterilir. Lider sayıları Sportmonks'un mevcut sezon
top-scorer kayıtlarından gelir. Haftalık ödüller sağlayıcının ham olay, kadro,
dakika, pozisyon ve skor verilerinden **XYZSkor tarafından**
`XYZ Performance Score v1` ile hesaplanır; Sportmonks ödülü veya resmî lig
seçimi gibi sunulmaz. Formül ve veri kökeni
[`docs/release-readiness/XYZSKOR_SCORING_METHODOLOGY.md`](docs/release-readiness/XYZSKOR_SCORING_METHODOLOGY.md)
ile [`legal/data-sources.html`](legal/data-sources.html) içinde açıklanır.

- `/api/football/leaders?league=<lig>`: seçili lig ve mevcut sezon; 45 dakika
  shared cache, single-flight ve distributed lease.
- `/api/football/weekly-awards?league=<lig>`: son tamamlanan hafta; 6 saat shared
  cache, aynı algoritma sürümüyle idempotent kalıcı kayıt.
- Ana beş-lig `/` rotası bu uçları çağırmaz. Modül yalnız tek-lig ekranında
  viewport'a yaklaşınca açılır ve rota değişince bekleyen istek iptal edilir.
- Dört özellik bağımsız feature flag ile kapatılabilir:
  `football_leaders_enabled`, `xyz_performance_score_enabled`,
  `weekly_star_enabled`, `team_of_week_enabled`.

## Bilinen riskler ve doğrulanamayan maddeler

- **Production Supabase migration durumu bu release turunda yeniden
  sorgulanmadı.** Önceki denetim, `matches.challenge_week`/
  `challenge_league` kolonları ile `settle_prediction_challenge_match`
  RPC'sinin hedef projede eksik olabileceğini bildirmişti. İstemci tarafı
  yalnız doğrulanmış `results`/`matches` kolonlarını kullanan şema-güvenli
  sonuç yolunu korur; ancak challenge backlog'u ve bu release'teki yeni sohbet
  odası migration'ı production'a alınmadan önce hedef şema üzerinde ayrıca
  doğrulanmalıdır.
- **Gerçek in-play fixture üzerinde uçtan uca doğrulama yapılamadı.**
  Geliştirme sırasında canlı bir Süper Lig/Premier League/La Liga/Bundesliga/
  Serie A maçı yoktu. Mimarinin durum makinesi (`no_live_matches` →
  `live` → `halftime` → `bitti`) gerçek Sportmonks yanıt şekilleriyle ama
  mock edilmiş HTTP çağrılarıyla test edildi (`scripts/test-live-architecture.mjs`).
- **OpenAI Sites platformunun Cache API garantisi doğrulanamadı.** Bu yüzden
  tekilleştirme ve kalıcılık tamamen Supabase'e taşındı (edge cache yalnızca
  ek hızlandırma). Bu mimari kararın doğru olduğu varsayımı; gerçek
  production trafiğinde `provider_sync_runs.request_count` metriği ile teyit
  edilmelidir.
- **20 gerekli test senaryosunun tamamı otomatikleştirilmedi.** Fake-clock ile
  tam maç öncesi→canlı→devre→bitti geçişi ve responsive/visual görsel
  kontroller (320/360/375/390/430/768/1440) `qa:responsive` ile kapsanıyor; ancak
  gerçek zamanlayıcı tabanlı (fake timer) bir istemci-tarafı test seti
  yazılmadı (mevcut test altyapısı gerçek `setTimeout` bekliyor, sahte saat
  enjeksiyonu için `sinon`/`vitest` gibi bir bağımlılık eklenmedi — bu kasıtlı
  bir minimal-bağımlılık kararıdır, `package.json`'a yeni devDependency
  eklemeden önce onay gerekir).
- **`npm run qa:db` bu son istemci/performance release turunda yeniden
  çalıştırılmadı.** Şema değişikliği production'a alınmadan önce migration
  apply → rollback → re-apply, RLS ve paralel transaction kontrolleri hedef
  PostgreSQL/Supabase ortamında yeniden çalıştırılmalı ve ayrı kanıt kaydı
  tutulmalıdır.

## Git ve yayın

### Futbol ana sayfası ve performans zinciri (v310)

- `/` tek bir lige değil, Süper Lig, Premier League, La Liga, Bundesliga ve Serie A maç merkezine açılır.
- Beş lig isteği birbirini beklemez; aynı anda başlatılır. Ekran ilk HTML boyamasında hazır bir maç merkezi kabuğu gösterir.
- Başarılı toplu sonuç 10 dakika tarayıcı önbelleğinde tutulur. Aynı kullanıcı sayfayı yenilediğinde maçlar ağ yanıtını beklemeden önbellekten çizilir ve taze süre içinde yeni `/api/football/home` isteği açılmaz. Önbellek eskimişse son doğrulanmış veri anında çizilirken yalnız bir arka plan `/api/football/home` isteği başlatılır.
- Lig seçimi `/super-lig`, `/premier-league`, `/la-liga`, `/bundesliga` veya `/serie-a` rotasına gider ve yalnız seçilen ligin sezon verisini kullanır.
- Oturum bilgisi sekme ömründe bir kez okunur; lig geçişi kapsam kontrolünü beklemez. Kapsam denetimi arka planda çalışırken önbellekteki doğrulanmış lig paketi hemen çizilir.
- Ana vitrindeki her karşılaşma maç merkezine bağlıdır; `Predict` ve `1 / X / 2` girişleri aynı doğrulanmış fixture kimliğini taşır.
- Canlı, bitmiş ve yaklaşan maçlar ayrı görsel durumlara ve filtrelere sahiptir. Ana sayfadaki toplu veri yalnız futbol liglerinden oluşur; diğer spor API aileleri çağrılmaz.
- Sağlayıcının Türkçe veya İngilizce durum değerleri (`canlı/live`, `devre_arasi/halftime`, `bitti/finished`, iptal ve erteleme varyantları) tek istemci sözleşmesine normalize edilir. Şerit, maç listesi, ana vitrin ve maç merkezi aynı durumu kullanır.
- Tüm ligler ekranında alt bölüme gidildiğinde rota `/all/...` olarak korunur; yenileme sonrasında kapsamın sessizce Süper Lig'e dönmesi engellenir.

### İki katmanlı profesyonel futbol bilgi mimarisi (v311)

Futbol ürünü iki ayrı ekran sözleşmesine ayrılmıştır:

| Rota | Sorumluluk | Veri kapsamı |
| --- | --- | --- |
| `/` | Beş liglik futbol maç merkezi | Süper Lig, Premier League, La Liga, Bundesliga ve Serie A |
| `/<lig>` | Seçili ligin genel bakışı | Yalnız URL'deki lig |
| `/<lig>/matches` | Seçili ligin tam fikstürü | Yalnız URL'deki lig |
| `/<lig>/standings` | Seçili ligin tam puan durumu | Yalnız URL'deki lig |
| `/<lig>/clubs` | Seçili ligin kulüp merkezi | Yalnız URL'deki lig |
| `/<lig>/transfers` | Seçili ligin transfer merkezi | Yalnız URL'deki lig |
| `/<lig>/news` | Seçili ligin kaynaklı gündemi | Yalnız URL'deki lig |

Ana futbol sayfası artık tek kanonik lig seçici, liglere göre gruplanmış maçlar,
`Canlı / Biten / Yaklaşan` filtreleri, fixture kimliğine bağlı Predict düğmeleri,
öne çıkan maç ve kompakt puan durumu taşır. Tek-lig maç vitrini ve eski lig
komutu kökte çalıştırılmaz. Bu nedenle `/` açılışında beş sezon isteğine ek
olarak örtük bir altıncı Süper Lig isteği üretilmez.

Tek-lig genel bakışı; lig kimliği ve sezon etiketi, beş lig arasında geçiş,
genel bakış/puan durumu/maçlar/takımlar/transferler/haberler sekmeleri, tam
puan tablosu, canlı-yaklaşan-sonuç fikstür grupları, lider/hücum/savunma/form
metrikleri, kaynaklı gündem ve transfer özetini aynı lig anahtarından üretir.
Aggregate vitrin ve eski sosyal/video ana sayfa modülleri bu ekranda render
edilmez. Provider tablosu yoksa sonuçlardan hesaplanan tablo; yalnız Süper Lig
için son çare olarak açık `2024–25 ARŞİV` etiketi taşıyan tarihî tablo gösterilir.

Performans ve hata sınırları:

- Futbolun ilk boyaması yalnız kritik Sportmonks lig paketini bekler; hesap,
  ödül ve ortak Supabase tabloları arka planda hydrate edilir.
- Beş lig sağlayıcı isteği Worker içinde `Promise.allSettled` ile aynı anda
  başlar. Tarayıcı yalnız tek kompakt home cevabı indirir; bir lig hata
  verdiğinde diğer dört lig kullanılabilir kalır ve hatalı lig kendi durumunu
  açıkça gösterir.
- Kök cache yalnız gösterilen maçların sonuçlarını ve her ligin ilk beş tablo
  satırını saklar; bütün sezon sonuçları tarayıcı depolamasına kopyalanmaz.
- Bir ligde İstanbul gününe ait maç varsa günün tamamı gösterilir; yoksa en
  fazla üç doğrulanmış yaklaşan maç, o da yoksa yalnız doğrulanmış son iki
  tamamlanmış maç gösterilir. Geçmiş saatli ama durumu/sonucu olmayan kayıt,
  iptal ve ertelenmiş fikstür “yaklaşan” sayılmaz.
- Bugün dışındaki fikstürlerde tarih ve saat birlikte görünür. `0-0` sonucu
  falsy değer kabul edilip kaybolmaz.
- `Predict` hızlı seçimi `/?fixture=<id>&pick=1|X|2` rotasına aynı fixture ve
  seçimle taşınır; maç merkezi seçimi görsel olarak hazırlar.

### Edge toplama, SWR ve canlı akış performansı (v312)

v312, iki katmanlı bilgi mimarisinin ağ ve ilk boyama sözleşmesini
kesinleştirir:

- Tarayıcı beş ayrı tam sezon cevabı indirmez. Kök futbol ekranı yalnızca
  `GET /api/football/home` isteği yapar; Worker Süper Lig, Premier League,
  La Liga, Bundesliga ve Serie A paketlerini edge katmanında paralel
  `Promise.allSettled` ile toplar. Bir lig hatası diğer dört ligi düşürmez.
  Cevap yalnız gösterilecek maçları, ilişkili sonuçları ve her ligin ilk beş
  puan durumu satırını taşır.
- Home cevabı edge üzerinde kısa süreli taze cache ve
  `stale-while-revalidate` ile korunur. Tarayıcıdaki `v3` kompakt cache 10
  dakika tazeyse ağ isteği başlatılmadan doğrudan kullanılır; süresi dolmuş son doğrulanmış veri de
  ilk boyamayı bekletmeden gösterilir ve tek `/api/football/home` isteğiyle
  arka planda yenilenir. Başarılı revalidate cevabı kontrollü
  `xyz:football-home-refreshed` olayıyla ekrana uygulanır.
- Tarayıcı gerçek HTTP `503` aldığında aynı görünür kapsam için `Retry-After`
  döngüsü kurmaz: root en fazla bir `/api/football/home`, tek lig en fazla bir
  `/api/football/season?league=<lig>` isteği yapar. Yeniden deneme ancak yeni bir
  görünür kullanıcı talebinde veya edge/provider cache katmanında gerçekleşir.
- Stale root cache anında çizilirken arka plandaki tek SWR isteğinin
  `AbortController` sahibi ağ promise’i sonuçlanana kadar korunur. Kullanıcı lig
  ya da Predict kapsamına geçerse eski `/home` isteği iptal edilir; geç gelen
  cevap state’e, refresh olayına veya browser cache’ine uygulanmaz.
- Eşzamanlı home yenilemeleri `footballHomeNetworkRequest` üzerinde tek
  promise'e birleştirilir. Canlı akış da lig kapsamını izler; aynı kapsamda
  devam eden istek varken ikinci istek başlatılmaz. Lig gerçekten değişirse
  eski kapsamın isteği iptal edilir. Kanonik production ekranı görünmeyen eski
  sağlayıcı panelini taşımadığı için kritik yolda ayrıca `/api/health` çağrısı
  yapmaz; sağlık kontrolü yalnız bu panelin gerçekten bulunduğu operasyon
  yüzeylerinde en fazla dakikada bir çalışır.
- Worker canlı maç sırasında `nextRefreshInSeconds: 6` döndürür; istemci alt
  sınırı 5 saniyedir. Böylece skorlar normal koşullarda 5–6 saniyelik ritimde
  sayfa yenilenmeden birleşir. Devre arası ve canlı maç olmayan dönemlerde
  daha uzun sunucu aralığı kullanılarak kota korunur.
- Bir fikstür canlı listeden çıktığında doğrudan bitmiş sayılmaz. Kayıt önce
  `livePendingVerification` durumuna alınır, ardından
  `GET /api/football/fixture?id=<fixtureId>` ile sonuç ve durum doğrulanır.
  Aynı fikstür için eşzamanlı çıkış kontrolleri tekilleştirilir; doğrulama
  gelmeden skor silinmez veya uydurma sonuç üretilmez.
- `?fixture=<id>` bulunmayan `/`, `/all`, `/<lig>` ve lig alt rotalarında eski
  matchday resolver hiç kurulmaz: `#matchdayCommand` görünmez kalır, resolver
  kaynaklı ek season/matchday isteği ve polling/lig-değişim listener'ı
  üretilmez. Tek-lig genel bakışının kendi season isteği bu guard'dan
  bağımsızdır. Matchday yalnız açık bir fixture ayrıntı URL'sinde çalışır.
- İlk HTML; kök maç merkezi ve tek-lig genel bakışı için görünür bir first-paint
  kabuğu taşır. Sınırlı `#xyzCriticalCss` bloğu 9 KB altında tutulur; web
  fontları ile haricî stil katmanları render'ı bloke etmeden yüklenir ve tüm
  stilleri senkron açan `noscript` yedeği korunur. Bu sözleşme cache'li/son
  doğrulanmış verinin bir saniyenin altında görünmesini hedefler; yeni cihazdaki
  soğuk sağlayıcı cevabının ağ süresi ayrı ölçülür.
- `app.css` ortak ama kritik olmayan stil katmanıdır. `football-hub.css`, yalnız kanonik `/`, `/all`
  ve beş `/<lig>` genel bakışının navigasyon, maç merkezi, tablo, fikstür,
  durum ve responsive geometrisini sahiplenir. Futbol katmanı preload edilir;
  büyük ortak katman `media="print"` geçişiyle asenkron uygulanır. Rota
  kapsamlı futbol katmanı ortak/controls katmanından sonra geldiği için son
  sözü söyler.
- `app-late.css` ilk HTML'de bir `<template>` içinde inert tutulur; kanonik
  futbol ilk açılışında indirilmez. `style-loader.js`, aynı dosyayı isteyen
  bütün çağrıları tek promise'te birleştirir ve dosyayı controls ile
  `football-hub.css` öncesine yerleştirerek cascade sırasını korur. Fixture,
  lig alt rotası veya başka kanonik olmayan yüzey doğrudan açılırsa bu katman
  otomatik yüklenir.
- `style-loader.js` ayrıca `window.__XYZ_FOOTBALL_HUB_READY__` bariyerini
  kurar. `football-hub.css` yüklenince bariyer çözülür; stil hatasında da kritik
  kabuk korunarak boot kilitlenmez. `football-early.js` boyama yapmadan önce bu
  bariyeri beklediği için dolu aggregate DOM'u stilsiz gösterilmez.
- `initial-route.js`, görünür HTML'den önce kanonik rota sınıflarını ve lig
  dataset'ini kurar. Fixture yoksa kökte tek `/api/football/home`, tek-lig
  genel bakışında yalnız URL'deki lige ait tek `/api/football/season` isteğini
  başlatır; ilgili tarayıcı cache'i tazeyse bu ağ isteği de sıfırdır.
  `data.js`/`ui.js` aynı global promise'i devralır; ilk isteği tekrar etmez.
- Production build, hesap/auth, haber/maç merkezi, mobil navigasyon, sohbet ve
  açık fixture DOM'unu sürümlü same-origin fragmentlere ayırır. Zorunlu
  fragmentler uygulama chunk'larından önce eklenir; mobil/sohbet gibi ikincil
  bir fragment geçici olarak alınamazsa ana futbol boot'u durmaz. Açık fixture
  yoksa matchday fragmenti hiç istenmez.
- `football-early.js` yalnız aggregate kökte çalışır. Doğrulanmış `v3` cache'i
  veya home cevabını `textContent` tabanlı güvenli DOM düğümleriyle çizer;
  başlık, lig rayı, her lig grubu ve öne çıkan kartı ayrı macrotasklarda
  ekleyerek uzun ana-thread görevini sınırlar. Erken renderer ile tam UI
  arasındaki hazır olayı ve 1,5 saniyelik sınırlı fallback, hızlı yerel yükte
  iki renderer'ın birbirinin DOM'unu yarıda kesmesini önler. Tek-lig genel
  bakışını ana `ui.js` kendi season paketiyle render eder.
- `ui.js` çekirdek renderer'dır; `app-boot.js` zorunlu `boot()` sahipliğini
  taşır. Kanonik futbol rotaları `ui-extras.js` beklemeden bir sonraki
  macrotask'te başlar. Fixture ve kanonik olmayan rotalarda
  `app-boot.js`, inert `#xyzUiExtrasTemplate` içindeki scripti bir kez yükler,
  ardından boot'u çalıştırır. `ui-extras.js` hiçbir zaman uygulamayı kendi
  başına başlatmaz.
- Kanonik ekrandan maçlar/puan durumu/takımlar/transferler/haberler gibi eski
  alt yüzeylere geçiş hem `ensureXYZLegacyStyles()` hem
  `ensureXYZUiExtras()` çağrısını tetikler. Sohbet scripti listener'ını defer
  yükler; fakat panelin CSS'i ve Supabase oda/mesaj aboneliği ilk açma eylemine
  kadar bekler. Sohbet düğmesi paneli göstermeden önce geç stil promise'ini
  tamamlar.
- Üretim build'i üzerinde 390×844, 4× CPU yavaşlatma ve Fast 3G profiliyle üç
  bağımsız soğuk çalıştırma release kapısıdır. Son ölçümde medyan FCP **548 ms**,
  dolu beş-lig vitrini **1.419 sn**, Premier League geçişi **481 ms**, doğrudan
  Süper Lig kabuğu **681 ms**, dolu Süper Lig görünümü **1.428 sn** ve en uzun
  görev **210 ms** ölçüldü; yinelenen API isteği, lig kapsam ihlali, console ve
  page error sayıları sıfırdı. Ham kanıt
  `reports/performance/release-performance-report.json` dosyasına yazılır.

### Görünür talep sahipliği ve sağlayıcı kotası (v313)

v313'te her ağ isteğinin tek bir görünür sahibi vardır. Sayfa, lig veya branş
değiştiğinde eski kapsamın zamanlayıcısı durur ve devam eden istek
`AbortController` ile ağ seviyesinde iptal edilir:

- `/` ve `/all`, ekranda beş ligi birlikte gösterdiği için tek bilinçli toplama
  istisnasıdır. Tarayıcı taze cache'te `home=0`, stale/cold durumda en fazla
  `GET /api/football/home ×1` yapar; hiçbir hata yolu beş ayrı season isteğine
  fan-out etmez. Canlı akış yalnız görünürken `league=all` kapsamında çalışır.
- `/<lig>` yalnız URL'deki ligin season ve live kapsamını kullanır. Hızlı lig
  geçişinde eski season/live isteği iptal edilir; geç gelen eski cevap yeni lig
  DOM'una uygulanmaz.
- `/predict` yalnız kullanıcının seçtiği ligin sezon paketini ister (`all` için
  güvenli varsayılan Süper Lig). Futbol ana sayfası, diğer ligler, ortak altı
  Supabase tablosu, sağlık ve coverage uçları Predict açılışında otomatik
  sorgulanmaz. Görünür Predict ekranında yalnız ödül metinleri, oturum sahibinin
  kendi tahminleri ve yalnız bu tahmin kimliklerine ait sonuçlar dar kapsamda
  yüklenir; hesap veya ekran değişince istek iptal edilir.
- `?fixture=<id>` yalnız o fixture'ın matchday verisini yeniler. Home, season ve
  genel live poll kurulmaz; ayrıntı kotası doluysa yedek istek yalnız aynı
  `GET /api/football/fixture?id=<id>` kaydıdır. Kullanıcının kayıtlı tahmini
  fixture+oturum başına cache/single-flight ile bir kez okunur.
- Basketbol ve voleybol yalnız seçili branş için bir
  `GET /api/sports/today?sport=<branş>` isteğinin sahibidir. Branş butonları
  ikinci bir API isteği üretmez; geçişte eski branş isteği iptal edilir.
  Motorsporu canlı poll'u yalnız görünür seri/canlı sekmesinde çalışır.
- Transfer akışı yalnız transfer yüzeyi veya lig genel bakışındaki ilgili blok
  viewport'a girdiğinde yüklenir. Gizli sekme, Predict, başka spor ya da başka
  futbol alt sekmesi canlı/transfer sorgusu üretmez. Oturum açma, çıkış ve takım
  değişimi yalnız hesap bağlamını yeniler; bütün spor verisini tekrar çekmez.
- `/api/health` ve `/api/football/coverage` kullanıcı sayfası açılışının kritik
  yolundan çıkarılmıştır; operasyon amaçlı kontroller görünür ürün verisinin
  yerine çalıştırılmaz.

Sunucu tarafında bu istekler kullanıcı başına sağlayıcı çağrısına dönüşmez:

- Football season paketleri lig başına 30 dakika, beş-lig home paketi 5 dakika
  kalıcı shared cache'te tutulur. Aynı isolate promise single-flight, farklı
  isolate'lar Supabase `sync_locks` lease'i ve `live_feed_cache` snapshot'ı
  paylaşır.
- Sportmonks `livescores/inplay` provider-global tek akıştır. `all` ve beş lig
  aynı anda istense de 15 saniyelik holder-safe lease ve 5 saniyelik ortak
  snapshot sayesinde bir provider çağrısı yapılır; sonuç gerçek
  `providerLeagueId` ile liglere ayrılıp route çıkışında tekrar filtrelenir.
  Kilit sahibi yenilerken doğrulanmış snapshot yoksa ikinci provider çağrısı
  açılmaz; istemciye `503 sync_in_progress` döner ve mevcut canlı skor korunur.
- Spor `today` ucu yalnız seçili branşın bugünkü tarihini sorgular; eski
  `0,-1,-2,-3,-7` beş-gün fan-out'u kaldırılmıştır. Aynı branş+tarih cold-miss
  çağrıları da keyed single-flight/shared lease ile birleşir. Sağlayıcı
  4xx/5xx/HTML/timeout döndürürse bu durum "maç yok" diye başarıya çevrilmez
  veya shared cache'e yazılmaz; yalnız doğrulanmış başarılı boş cevap cache'lenir.
- Worker'a gerçek bir ağ/DNS erişim hatası olmadıkça Supabase canlı fallback'i
  çağrılmaz. Structured `429/503` yanıtı ikinci sağlayıcı zinciri açmaz. Gerçek
  fallback de Worker ile aynı global lock/cache anahtarlarını kullandığı için
  provider kotasını çift tüketmez.

Bu sözleşmeyi `npm run qa:demand-scope`, `npm run qa:live-architecture`,
`npm run qa:live-quota` ve `npm run qa:hardening` korur.

v314'te lig genel görünümü, FotMob/Sofascore bilgi hiyerarşisinden yalnızca
akış prensibini alır: başlık, sekmeler, tablo, fikstür ve alt metrikler tek
kesintisiz yüzeyde ilerler; referansların marka, bileşen ve görsel düzeni
kopyalanmaz. Predict 1/X/2 seçenekleri maç satırlarının altında korunur. Bu
değişiklik yalnız sunum katmanındadır; v313 demand-scope, cache, canlı skor ve
provider single-flight sözleşmeleri aynen kalır.

v314'te yayınlanan first-party istemci dosyaları (`app.css`, `app-late.css`,
`football-hub.css`, `style-loader.js`, `initial-route.js`, `football-early.js`,
`data.js`, `live.js`, `match-center.js`, `matchday-live.js`, `predict-game.js`,
`ui.js`, `app-boot.js`, `ui-extras.js`, `chat.js`, `multisport.js`,
`sport-branches.js`, `motorsports.js`) aynı `?v=314` cache-busting
sürümünü taşır. Production build ayrıca içerik hash'i üreterek bu manuel
sürümün üzerinde ikinci bir immutable-cache güvenlik katmanı uygular.

Kanonik ilk-açılış API sözleşmesi:

| Yüzey | Tam olarak izin verilen futbol istekleri | Yasaklanan tekrarlar |
| --- | --- | --- |
| `/`, `/all` (`fixture` yok) | Taze cache: `home=0`; stale/cold: `/api/football/home ×1`. Görünürken `/api/football/live?league=all ×1` | `season=0`, `matchday=0`, `health=0`, `coverage=0`, ikinci home/live yok |
| `/super-lig` | Taze cache: `season=0`; stale/cold: `/api/football/season?league=super-lig ×1`. Görünürken kendi live isteği | `home=0`, `matchday=0`, `health=0`, başka lig season/live yok |
| `/premier-league` | Taze cache: `season=0`; stale/cold: `/api/football/season?league=premier-league ×1`. Görünürken kendi live isteği | `home=0`, `matchday=0`, `health=0`, başka lig season/live yok |
| `/la-liga` | Taze cache: `season=0`; stale/cold: `/api/football/season?league=la-liga ×1`. Görünürken kendi live isteği | `home=0`, `matchday=0`, `health=0`, başka lig season/live yok |
| `/bundesliga` | Taze cache: `season=0`; stale/cold: `/api/football/season?league=bundesliga ×1`. Görünürken kendi live isteği | `home=0`, `matchday=0`, `health=0`, başka lig season/live yok |
| `/serie-a` | Taze cache: `season=0`; stale/cold: `/api/football/season?league=serie-a ×1`. Görünürken kendi live isteği | `home=0`, `matchday=0`, `health=0`, başka lig season/live yok |
| `/predict` | Yalnız seçili lig season paketi (`all → super-lig`) | `home=0`, `live=0`, diğer lig season=0, ortak tablo fan-out'u yok |
| `?fixture=<id>` (view değeri fark etmez) | `/api/football/matchday?fixture=<id> ×1`; hata durumunda yalnız aynı `/api/football/fixture?id=<id> ×1` | `home=0`, `season=0`, genel live=0 |
| `/basketbol`, `/voleybol` | Yalnız görünür branş için `/api/sports/today?sport=<branş> ×1` | Diğer branş=0, football API=0, branch-nav tekrarı=0 |

`/index.html` kökün, `/all` ise aggregate kapsamın uyumluluk takma adıdır.
`?fixture=<id>` açıkça verilmedikçe matchday zinciri kurulmaz. Lig genel
bakışındaki tablo, maç grupları, form/metrikler, gündem ve transfer özeti aynı
URL lig anahtarından üretilir; başka ligin season/live verisi DOM'a eklenmez.

Regresyon komutları:

```powershell
npm run check
npm run qa:supabase-lazy
npm run qa:football-ia
npm run qa:demand-scope
npm run qa:league-contract
npm run qa:matchday
npm run qa:live-architecture
npm run qa:live-quota
npm run qa:hardening
npm run qa:weekly-football
npm run qa:dist
npm run qa:responsive
npm run qa:perf
npm run build
```

`qa:football-ia`; beş lig sırasını, compact bundle durum semantiğini, 0-0
sonucunu, Predict rota aktarımını, aggregate/tek-lig render ayrımını ve kökte
tek home isteğini doğrular. `qa:matchday` ise fixture parametresi bulunmayan
tüm futbol rotalarında sıfır matchday isteği/listener sözleşmesini korur.

`npm run check`; kritik CSS'in 9 KB sınırını, `football-hub.css` kapsamını,
`app-late.css` template'inin inert kalmasını, `ui.js → ui-extras.js template →
app-boot.js` sırasını, zorunlu boot sahipliğini ve bütün v313 cache anahtarlarını
statik olarak denetler. `qa:responsive` withdata modu; 320, 360, 375, 390, 430,
768 ve 1440 genişliklerinde kök ile beş lig genel bakışını ayrı ayrı açar. Her koşuda
`requestedApiPaths` listesini rapora yazar; yukarıdaki kesin istek adetlerini,
sıfır page/console error'ı, yatay taşma olmamasını ve istisnaları açıkça
etiketlenmiş gerçek `44×44` dokunma hedeflerini release kapısı yapar.
`qa:perf`, 390×844/Fast 3G/4× CPU profilinde kök dolumunu ve Premier League
geçişini ölçer; API tekrarlarını, lig kapsam ihlalini, uzun görevleri ve hata
sayılarını ham raporla birlikte doğrular.

Kaynak dalı: `integration/latest-zip-2026-08-17`

```powershell
git add README.md .gitignore index.html package.json assets docs scripts supabase worker reports/performance/release-performance-report.json
git commit -m "Açıklayıcı değişiklik mesajı"
git push origin integration/latest-zip-2026-08-17
```

Production dağıtımı `.openai/hosting.json` içindeki mevcut Sites projesine yapılır. Build arşivleri ve geçici paketler Git'e eklenmez.

## Dokümantasyon

- [API planı](docs/API-PLANI.md)
- [Canlı skor uygulama ve operasyon rehberi](docs/LIVE-SCORE-HANDOFF-2026-08-22.md)
- [Veri sağlayıcı mimarisi](docs/data-provider-architecture.md)
- [API envanteri ve satın alım notu](docs/api-envanteri-ve-satin-alim-notu-2026-08-04.md)
- [Profesyonel devir teslim](docs/professional-handoff-2026-08-03.md)
- [Supabase migration runbook](docs/supabase-migration-runbook.md)
- [Secret operasyon şablonu](docs/ops-secrets-ledger-template.md)

## Hukuki sınırlar

- Sağlayıcı sözleşmesi izin vermediği veriyi cache'leme veya yeniden dağıtma.
- Oyuncu ve takım görsellerini yalnızca lisanslı/izinli kaynaktan kullan.
- Sosyal medya içeriğini platformun resmî API veya embed sistemiyle göster.
- Oranları bahis çağrısı olarak değil, ücretsiz tahmin verisi olarak sun.
- Kaynak, güncelleme zamanı ve veri durumu kullanıcıya görünür olmalıdır.
