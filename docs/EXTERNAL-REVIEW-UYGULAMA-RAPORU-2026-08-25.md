# XYZSKOR dış inceleme uygulama raporu

Tarih: 25 Ağustos 2026
Kaynak belge: `docs/EXTERNAL-REVIEW-HANDOFF-2026-08-25.md`
Çalışma tabanı: `XYZSKORCLAUDEFULLSTACK20260825.zip`

Bu rapor, handoff belgesindeki her maddenin gerçek sonucunu verir. Doğrulanamayan
adımlar açıkça `ATLANDI` veya `AÇIK` olarak işaretlenmiştir; hiçbir mock sonuç
production kanıtı gibi sunulmamıştır.

---

## 1. Otomatik test matrisi — gerçek sonuçlar

| Komut | Sonuç |
| --- | --- |
| `npm ci` | ✅ |
| `npm run check` | ✅ |
| `npm run build` | ✅ |
| `npm run check:legal` | ❌ **Kasıtlı açık** (bkz. §4 P0-1) |
| `npm run qa:api` | ✅ 165/165 |
| `npm run qa:general-home` | ✅ 44/44 (**yeni kapı**) |
| `npm run qa:demand-scope` | ✅ |
| `npm run qa:league-contract` | ✅ |
| `npm run qa:football-ia` | ✅ |
| `npm run qa:matchday` | ✅ |
| `npm run qa:live-architecture` | ✅ |
| `npm run qa:live-quota` | ✅ |
| `npm run qa:hardening` | ✅ |
| `npm run qa:weekly-football` | ✅ |
| `npm run qa:predict-security` | ✅ |
| `npm run qa:football-predictions` | ✅ |
| `npm run qa:supabase-lazy` | ✅ |
| `npm run qa:dist` | ✅ 44/44 |
| `npm run qa:responsive` | ✅ 1408/1408 |
| `npm run qa:responsive:nodata` | ✅ 819/819 |
| `npm run qa:perf` | ✅ tüm kapılar |
| `npm run qa:db` | ✅ **gerçek PostgreSQL 16.13** (geçici yerel örnek) |

Performans (medyan, 3 koşu): FCP **664 ms**, dolu beş lig ekranı **1416 ms**,
Premier League geçişi **242 ms** (önceki tur 397 ms), en uzun görev **120 ms**,
tekrarlı kritik API isteği **0**, cardinality ihlali **0**, konsol/sayfa hatası **0**.

---

## 2. Bulunan ve düzeltilen gerçek hatalar

### 2.1 `qa:api` — x-media transfer-only sözleşmesi (baseline'da kırıktı)
Baseline'da `qa:api` 160/161 idi. Başarısız assertion `x-media` kartının post
metnini kontrol ediyordu; test fixture'ı "Galatasaray bugün kazandı" gibi bir
**maç sonucu** metni kullanıyordu. Worker'ın `content_scope: transfer-only`
filtresi bu metni doğru şekilde eliyordu — yani **kod doğru, test bayattı**.
Filtre zayıflatılmadı; fixture transfer içerikli bir gönderiyle değiştirildi ve
**4 yeni assertion** eklendi: transfer dışı içeriğin elendiği, `content_scope`
değeri, uygun post bulunmayan kulüpler için `post: null` (uydurma yok).
→ `qa:api` **165/165**.

### 2.2 `qa:db` hiç çalışmıyordu — CRLF satır sonları
Handoff, `qa:db`'nin "psql yokluğu nedeniyle atlandığını" bildiriyordu. Gerçek
neden bundan fazlaydı: `scripts/test-tools/*.sh` dosyalarının **tamamı CRLF**
satır sonu taşıyordu ve `bash` altında `set: -: invalid option` /
`syntax error near unexpected token $'do\r'` ile anında ölüyordu. Yani psql
kurulu olsa da paket Linux/CI üzerinde çalışmayacaktı.
→ Dört `.sh` dosyası LF'e çevrildi, `.gitattributes`'a `*.sh text eol=lf` eklendi,
çalıştırma bitleri verildi.

### 2.3 Migration rollback, daha eski bir migration'ın nesnesini siliyordu
`rollback/20260825160000_prediction_integrity_restore_down.sql`,
`public.enforce_prediction_integrity()` fonksiyonunu koşulsuz `drop` ediyordu.
Ancak bu fonksiyon **20260825 tarafından oluşturulmadı**; onu
`20260802180000_platform_core.sql` oluşturuyor, 20260825 yalnızca
`create or replace` ile güncelliyor. Sonuç: tek bir migration'ın geri alınması
çok daha eski bir migration'a ait fonksiyonu ve trigger'ı yok ediyor, ardından
gelen `20260821090000` down ve re-apply adımları
`function public.enforce_prediction_integrity() does not exist` ile kırılıyordu.
→ Rollback artık fonksiyonu silmek yerine **20260802180000'deki tanımına
döndürür** ve trigger'ı yeniden kurar.

### 2.4 Migration döngüsü testi eksik şemayı tam şema gibi ölçüyordu
`pg_migration_cycle.sh` **tüm** rollback dosyalarını (9) uyguluyor, fakat
yalnızca **elle yazılmış 4** migration'ı geri yüklüyordu. Migration seti
büyüdüğü için son durum doğrulaması eksik bir şemayı ölçüyor ve "anon
çağırabilen SECURITY DEFINER fonksiyon sayısı" 2 yerine 4 görünüyordu — yani
kapı yanlış alarm veriyordu. Re-apply listesi artık rollback dosyalarından
türetilir; döngü gerçekten apply → rollback → re-apply olur.

### 2.5 Challenge E2E testi güncel güvenlik sözleşmesinin gerisindeydi
`20260825160000_prediction_integrity_restore.sql` tahmin yazmayı oturum zorunlu
hale getirdi (`auth.uid()` null ise reddet). `pg_challenge_e2e_test.sql` ise
fixture'ı superuser bağlamında yazıyordu ve test gerçek PostgreSQL'de hiç
çalışmadığı için bu uyumsuzluk farkedilmemişti.
→ Test artık her kullanıcının tahminini **kendi oturum bağlamında** yazar ve
ek olarak iki güvenlik regresyonu kanıtlar: "başkası adına yazma" reddi ve
"oturumsuz yazma" reddi. → E2E **11/11**.

### 2.6 44×44 dokunma hedefi ihlalleri (baseline'da vardı)
Orijinal ZIP üzerinde ölçüldü ve doğrulandı: lig genel bakış ekranlarında
`EPL` düğmesi 43.4 px, `Maçlar` sekmesi 42 px genişlikteydi — yani bu ihlal
benim değişikliklerimden gelmiyordu, mevcut bir kabul kriteri açığıydı.
→ `.league-overview-switch button` ve `.league-overview-tabs button` için
`min-width:44px` eklendi.

---

## 3. Handoff P1 maddelerinin durumu

### P1.1 Genel çok sporlu ana sayfa — ✅ TAMAM
`/` artık beş ligli futbol merkezi değil, bağımsız genel ana sayfadır:
- İçerik `assets/js/general-home.js`; modül statiktir, **kendi başına hiç
  `fetch` yapmaz** (test ile kilitlendi).
- Kök açılışta **sıfır spor API isteği** — gerçek tarayıcıda ölçüldü
  (`qa:dist` → `smokeGeneralHome`, `qa:responsive` → `genel-anasayfa`).
- Futbol merkezi `/futbol` altına taşındı; `/all` geriye dönük uyumluluğu korur.
- Statik branş kartları: Futbol, Basketbol, Voleybol, Motor Sporları, UFC, Predict.

### P1.2 Route-aware branş geçişi — ⚠️ KISMEN TAMAM (dürüst ayrım)
`assets/js/branch-router.js` eklendi. İki mod vardır:

- **CLIENT (belge yenilenmez):** genel ana sayfa ↔ basketbol ↔ voleybol.
  `history.pushState` ile geçilir. Gerçek tarayıcıda `sameDocument: true`
  olarak kanıtlandı.
- **MANAGED (belge değişimi zorunlu):** futbol kökü, UFC, motor sporları.
  Neden: `ufc-hub.js` ve `motorsports.js` IIFE'leri **yüklenme anında**
  `location.pathname`'e bağlıdır ve tek seferlik mount eder. Bunları istemcide
  yeniden mount edilebilir hale getirmek, çalışan üç branş yüzeyini baştan
  yazmayı gerektirirdi; handoff kuralı 2 (çalışan mimariyi gereksiz yeniden
  yazma) gereği yapılmadı.
  Bu yolda geçiş yine korunur: eski istek **abort edilir** → hedef branşın JS
  paketi `ensureXYZBranchModule()` ile **talep anında indirilir** → hedef belge
  **prefetch edilir** → ancak sonra tek `commitNavigation()` noktasından commit
  edilir. Tüm sayfa skeleton'a çevrilmez; yalnız ince `.xyz-route-progress`
  göstergesi açılır ve kullanıcı eski içeriği görmeye devam eder.

**Açık kalan:** futbol ↔ UFC ↔ motor sporları geçişlerinde hâlâ bir belge
yüklenmesi olur (prefetch nedeniyle flash'sız, ama SPA değil). Tam SPA istenirse
bu üç modülün mount/unmount API'sine refactor edilmesi gerekir — ayrı ve
kapsamlı bir iş kalemidir.

Ek düzeltme: `multisport.js` içindeki `pruneFootballSurface()` futbol DOM'unu
**siliyordu**; bu geçişi tek yönlü yapıyordu. Artık **gizler**
(`.xyz-branch-hidden`) ve `restoreFootballSurface()` ile geri döndürür. Görünür
DOM sızıntısı aynı şekilde engellenir.

### P1.3 / P1.4 Fotoğraf kapsamı şeffaflığı — ✅ TAMAM
Fotoğraf filtresi (yalnız doğrulanmış `cdn.sportmonks.com` oyuncu görselleri)
korundu; uydurma yüz üretilmedi. Filtrenin sıralamayı değiştirebildiği artık
kullanıcıdan saklanmıyor:
- `footballLeaderPhotoNoticeHTML()` her lider listesinin başında
  **"Fotoğraflı oyuncular"** etiketini, fotoğrafı olmadığı için listelenmeyen
  oyuncu sayısını ve sıralamanın ham istatistikten sapabileceğini yazar.
- Haftanın 11'i aynı notu taşır (kaç adayın 11'e alınmadığı dahil).
- 6 yeni `check.mjs` assertion'ı ile kilitlendi.

**Açık:** Sportmonks planındaki Player Images kapsamı **ölçülemedi** — bkz. §4.

### P1.5 / P1.6 Branş ekran kalitesi ve boş durum politikası — ✅ TAMAM
Eski boş durum kutusu `min-height:260px` kesikli çerçeveydi; veri az olduğunda
ekranın tamamı boş görünüyordu. Yeni `compactEmptyHTML()`:
- kompakt, sola hizalı, düşük kontrastlı bir şerit üretir,
- **doğrulanmış boş sonuç** ile **sağlayıcı hatasını açıkça ayırır**
  ("Bu bir sağlayıcı hatasıdır, doğrulanmış boş sonuç değildir"),
- **kapsam** ve **son güncelleme zamanı** bilgisini gösterir.
Basketbol, voleybol, lig/takım/predict görünümleri ve hata yolu dahil 6 çağrı
noktası dönüştürüldü.

### P1.7 Kaynak ve lisans şeffaflığı — ✅ TAMAM
- `xPostCardHTML` artık **yayıncı hesabını (`@handle`)** ve platformu gösterir
  (önceden yalnız takım adı + jenerik "Transfer kaynağı" etiketi vardı).
- `xSourceLicenceNoteHTML()` içerik ve kaynak politikası bağlantısını **hem
  dolu hem hata durumunda** gösterir; telif ve yayın haklarının yayıncıya ait
  olduğunu yazar.
- Doğrulanmış kaynak URL'i yoksa artık `#` hedefli **ölü bağlantı üretilmez**;
  yayıncı adı düz metin olarak gösterilir (hem X kartında hem transfer
  merkezinde).
- 6 yeni `check.mjs` assertion'ı ile kilitlendi.

---

## 4. AÇIK ve DOĞRULANAMAYAN maddeler (dürüst liste)

### P0-1 Hukuki metinler — ❌ AÇIK (kasıtlı, uydurulmadı)
`npm run check:legal` başarısız. Gerekli 6 kritik alandan **5'i dolu**; tek açık
alan:

```
assets/legal/legal-config.js → infrastructure.crossBorderMechanism
  "[YAYINDAN ÖNCE HUKUKİ MEKANİZMAYI YAZIN: yeterlilik kararı / standart
    sözleşme / bağlayıcı şirket kuralları / arızi hâl]"
```

Bu, KVKK m.9 kapsamında **yurt dışına veri aktarımının hangi hukuki mekanizmaya
dayandığı** beyanıdır (barındırma Supabase West EU / İrlanda). Bu bir teknik
değer değil, veri sorumlusunun ve hukuk danışmanının kararıdır; uydurulması
gerçek hukuki risk yaratır ve handoff kuralı 5/6 ile §10 bunu açıkça yasaklar.
**Bu alan gerçek bilgiyle doldurulmadan "production hazır" denilmemelidir.**

Ayrıca `check:legal`'ın kapı olarak kontrol *etmediği*, fakat yayınlanmış legal
sayfalarda hâlâ placeholder olan alanlar (hukukçu teyidi gerekir):
`infrastructure.footballDataProvider`, `analyticsProvider`,
`errorMonitoringProvider`, `emailProvider`, `pushProvider` ve `retention.*`
saklama süreleri. Bunlara dokunulmadı.

### P0-2 Production veritabanı — ⚠️ KISMEN
Gerçek PostgreSQL 16.13 üzerinde tüm paket PASS oldu ve **3 gerçek hata bulundu
ve düzeltildi** (§2.2–2.5). Ancak bu **geçici bir yerel PostgreSQL örneğidir**,
production Supabase projesi değildir.
**ATLANDI:** hedef production Supabase şeması üzerinde apply → RLS → 20 paralel
haftalık hesap/upsert → rollback → re-apply döngüsü. Ayrı ve kanıtlı bir
operasyon olarak yürütülmelidir. Production şemasına elle müdahale edilmedi.

### P0-3 Üyelik doğrulama e-postası (canlı SMTP) — ❌ ATLANDI
Bu ortamda gerçek SMTP sağlayıcısı, Supabase Auth production projesi ve gerçek
posta kutusu erişimi yok. Teslim, yeniden gönderim, süresi dolmuş link ve
rate-limit senaryoları **doğrulanmadı**. Auto-confirm yalnız test hesabı içindir
ve production çözümü değildir.

### P0-4 Gerçek canlı maç E2E — ❌ ATLANDI
Bu ortamda Sportmonks production token'ı ve o anda oynanan gerçek bir maç yok.
Kickoff öncesi → canlı → devre → ikinci yarı → bitiş → canlı listesinden düşme
zinciri **gerçek sağlayıcı maçı üzerinde kaydedilmedi**. Mevcut yeşil sonuçlar
(`qa:live-architecture`, `qa:matchday`, `qa:live-quota`) mock HTTP üzerindedir ve
production kanıtı olarak sunulmamaktadır.

### P1.3 Sportmonks Player Images kapsamı — ❌ ÖLÇÜLEMEDİ
Provider playground/canlı endpoint erişimi (geçerli `SPORTMONKS_API_TOKEN`)
olmadığı için plan kapsamı endpoint bazında ölçülemedi. UI tarafı doğru
davranıyor (fotoğraf yoksa uydurmuyor, durumu etiketliyor), fakat **satın alma
gereksinimi tablosu gerçek ölçüm olmadan çıkarılamaz**. Gerekli ölçüm listesi:
`players` (`image_path` dolu oran), `topscorers`, `lineups`/`formations`,
`statistics`, `sidelined`, `xG`, `odds`, `news`/`media`.

### P1.2 Tam SPA branş geçişi — ⚠️ KISMEN (§3 P1.2)

---

## 5. Değiştirilmeyen mimari sözleşmeler (doğrulandı)

Handoff §6'daki sözleşmelerin tamamı otomatik kapılarla korunuyor ve geçti:
- `/futbol` (ve `/all`): en fazla bir `/football/home` + bir `/football/live?league=all`
- `/` (genel ana sayfa): **hiçbir** spor API isteği
- Tek lig: yalnız kendi `/season` + kendi `/live`
- Açık `?fixture=`: home/season yok, yalnız matchday zinciri
- Basketbol/voleybol: yalnız aktif sporun `/api/sports/today?sport=...`
- Gizli sekmede poll yok; branş değişiminde eski fetch abort
- Spor menüsü ve router **hiçbir API endpointinin sahibi değil** (test ile kilitli)
- Single-flight/lease/cache korumaları bozulmadı (`qa:hardening`, `qa:live-quota`)
- Secret/token/parola DOM, log veya kaynağa girmedi

---

## 6. Değişen dosyalar

**Yeni:**
`assets/js/general-home.js`, `assets/js/branch-router.js`,
`scripts/test-general-home-router.mjs`,
`docs/EXTERNAL-REVIEW-UYGULAMA-RAPORU-2026-08-25.md`

**Değişen (ürün):** `index.html`, `assets/js/initial-route.js`,
`assets/js/app-boot.js`, `assets/js/style-loader.js`,
`assets/js/football-early.js`, `assets/js/live.js`, `assets/js/ui.js`,
`assets/js/multisport.js`, `assets/js/sport-branches.js`,
`assets/css/football-hub.css`, `assets/css/app-late.css`,
`worker/index.js`, `scripts/build.mjs`, `README.md`, `.gitattributes`

**Değişen (test/DB):** `scripts/check.mjs`,
`scripts/test-demand-scoped-fetching.mjs`,
`scripts/test-football-information-architecture.mjs`,
`scripts/test-tools/api_test_harness.mjs`,
`scripts/test-tools/dist_check.mjs`, `scripts/test-tools/perf_check.mjs`,
`scripts/test-tools/responsive_check.mjs`,
`scripts/test-tools/pg_suite.sh`, `scripts/test-tools/pg_migration_cycle.sh`,
`scripts/test-tools/pg_concurrency_test.sh`,
`scripts/test-tools/weekly_football_concurrency_test.sh`,
`scripts/test-tools/pg_challenge_e2e_test.sql`,
`supabase/migrations/rollback/20260825160000_prediction_integrity_restore_down.sql`,
`package.json` (`qa:general-home`)

Hiçbir test silinmedi, zayıflatılmadı veya skip edilmedi. Değiştirilen
assertion'ların her biri, kasıtlı bir sözleşme değişikliğini yansıtır ve
yorumla gerekçelendirilmiştir; net etki **+15 yeni assertion**dır.

---

## 7. Sonuç

Handoff'un UI ve backend görevleri uygulandı; `check:legal` dışındaki **tüm**
otomatik kapılar yeşildir ve `qa:db` ilk kez gerçek PostgreSQL üzerinde
çalıştırılarak üç gerçek hata ortaya çıkarılıp düzeltilmiştir.

**Handoff §9 uyarınca release TAMAMLANMIŞ SAYILAMAZ.** Açık kalan kapılar:
1. Hukuki gate (`crossBorderMechanism` — hukukçu kararı bekliyor)
2. Production Supabase üzerinde kanıtlı DB operasyonu
3. Canlı SMTP e-posta doğrulama zinciri
4. Gerçek canlı maç üzerinde uçtan uca yaşam döngüsü kanıtı
5. Sportmonks Player Images kapsam ölçümü ve satın alma tablosu

Bu beş madde gerçek ortam erişimi gerektirir ve bu turda **doğrulanmamıştır**.
