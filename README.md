# XYZSKOR

## Canlı skor mimarisi (2026-08-23 durumu)

`docs/CLAUDE-LIVE-SCORE-HANDOFF-2026-08-22.md` promptu uygulandı: merkezi
ingest, kalıcı snapshot, single-flight kilit, circuit breaker, ayrıştırılmış
API sözleşmeleri ve şema-güvenli sonuç kesinleştirmesi artık kodda mevcut ve
gerçek testlerle doğrulandı (bkz. [Test ve build sonuçları](#test-ve-build-sonuçları)).

Gerçek bir in-play Sportmonks fikstürü üzerinde skor ve zengin maç verisi
akışı production'da doğrulandı. Tek fikstüre özel kurtarma verisi kaldırıldı;
aynı snapshot, kilit ve kota koruması artık seçili liglerdeki her fikstür için
fikstür kimliği üzerinden çalışır.

[Claude için canlı skor uygulama promptu](docs/CLAUDE-LIVE-SCORE-HANDOFF-2026-08-22.md)

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
| `assets/css/app.css` | Tasarım sistemi ve responsive düzen |
| `assets/js/data.js` | Veri, Supabase ve sağlayıcı adaptörleri |
| `assets/js/live.js` | Canlı skor ve navigasyon akışı |
| `assets/js/ui.js` | Futbol ve ana arayüz render zinciri |
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
4. Yapay zekâ ile üretilmiş, marka ve gerçek kişi taklidi içermeyen arka planlar
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

2026-08-23 tüm maçlar için canlı skor mimarisi teslimatında çalıştırılan gerçek sonuçlar:

| Komut | Sonuç |
| --- | --- |
| `npm run check` | ✅ Geçti |
| `npm run qa:api` | ✅ 155/155 |
| `npm run qa:hardening` | ✅ 31/31 |
| `npm run qa:matchday` | ✅ Geçti |
| `npm run qa:matchday:snapshots` | ✅ 4/4 genel maç senaryosu |
| `npm run qa:live-details` | ✅ Geçti |
| `npm run qa:football-predictions` | ✅ Geçti (schema-safe finalize için güncellendi) |
| `npm run qa:live-architecture` | ✅ 26/26 |
| `npm run qa:responsive` (withdata) | ✅ 235/235 |
| `npm run qa:responsive:nodata` | ⚠️ 15 hata — **ortam kısıtı**, temel (değişiklik öncesi) koda karşı doğrulandı, aynı 15 hata orada da var (basketbol/voleybol sağlayıcı anahtarı bu ortamda yok) |
| `npm run qa:visual`, `qa:chat`, `qa:instagram`, `qa:match-center`, `qa:perf` | ✅ Temel koda karşı doğrulandı, sonuçlar aynı (bu ortamda ağ/secret kısıtları nedeniyle bazı beklenen hata durumları var, hiçbiri bu teslimatla ilgili regresyon değil) |
| `npm run qa:predict-security` | ✅ Geçti |
| `npm run qa:db` | ⏭️ Atlandı — bu ortamda PostgreSQL yerel kurulum imkânı yok. Bunun yerine migration döngüsü (apply → idempotent re-apply → rollback → re-apply) **gerçek production Supabase projesinde** Supabase MCP ile doğrulandı |
| `npm run build` | ✅ Geçti (dist/ üretildi) |
| `npm run check:legal` | ❌ Beklenen şekilde başarısız — kuruluş öncesi hukuki placeholder'lar dolu değil. Bu, bu teslimatla **ilgisiz, önceden var olan** bir yayın engelidir |

## Bilinen riskler ve doğrulanamayan maddeler

- **Production Supabase şeması eksik migration'lar içeriyor.** Denetim
  sırasında `matches.challenge_week`/`challenge_league` kolonlarının ve
  `settle_prediction_challenge_match` RPC'sinin production projesinde
  (`swhwmqbamzczztpfxctg`) **uygulanmadığı** tespit edildi — bu dal
  (`integration/latest-zip-2026-08-17`) içindeki migration dosyaları var ama
  hiç `apply_migration` ile çalıştırılmamış. Bu, ödül/challenge
  kesinleştirmesinin sessizce hiç çalışmadığı anlamına geliyordu (her cron
  turu "column does not exist" ile patlıyor ve yutuluyordu). Bu teslimat bunu
  şema-güvenli bir sonuç kesinleştirme yoluyla (yalnızca doğrulanmış
  `results`/`matches` kolonları) çözdü, ancak ödül/challenge migration
  backlog'unun kendisini **kapsam dışı bıraktı** (riskli, büyük ve bu canlı
  skor görevinden bağımsız). Emre'nin bu backlog'u ayrı bir görev olarak
  planlaması önerilir.
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
  kontroller (320/375/390/768/1440) `qa:responsive` ile kapsanıyor; ancak
  gerçek zamanlayıcı tabanlı (fake timer) bir istemci-tarafı test seti
  yazılmadı (mevcut test altyapısı gerçek `setTimeout` bekliyor, sahte saat
  enjeksiyonu için `sinon`/`vitest` gibi bir bağımlılık eklenmedi — bu kasıtlı
  bir minimal-bağımlılık kararıdır, `package.json`'a yeni devDependency
  eklemeden önce onay gerekir).
- **`npm run qa:db` bu sandbox'ta hiç çalışmadı** (yerel PostgreSQL/apt erişimi
  yok). Migration doğrulaması bunun yerine gerçek production Supabase'inde
  Supabase MCP ile yapıldı (apply → idempotent re-apply → rollback →
  re-apply, artı `try_acquire_sync_lock` için gerçek eşzamanlı kilit testi).

## Git ve yayın

Kaynak dalı: `integration/latest-zip-2026-08-17`

```powershell
git add .
git commit -m "Açıklayıcı değişiklik mesajı"
git push origin integration/latest-zip-2026-08-17
```

Production dağıtımı `.openai/hosting.json` içindeki mevcut Sites projesine yapılır. Build arşivleri ve geçici paketler Git'e eklenmez.

## Dokümantasyon

- [API planı](docs/API-PLANI.md)
- [Claude için canlı skor uygulama promptu](docs/CLAUDE-LIVE-SCORE-HANDOFF-2026-08-22.md)
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
