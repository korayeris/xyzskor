# XYZSKOR STLC test kapanış raporu — 24 Ağustos 2026

## Sonuç

İstemci, Worker ve üretim paketi için planlanan teknik yayın kapıları geçti. Beş futbol ligi, Predict, basketbol, voleybol, UFC ve Formula 1 ekranlarında rota/veri izolasyonu; canlı skor dayanıklılığı; sağlayıcı kota koruması; mobil uyumluluk ve performans doğrulandı.

Üretim hazır kararı iki dış bağımlılık nedeniyle koşulludur:

1. `npm run check:legal`, yurt dışı veri aktarım mekanizması kuruluş/hukuk kararıyla doldurulmadığı için bilinçli olarak kırmızıdır.
2. Bu çalışma ortamında PostgreSQL servisi ve `psql` bulunmadığından migration/RLS paketi yeniden koşturulamadı. Önceki rapor sonuçları bu kapanışın yeni kanıtı sayılmamıştır.

Bu nedenle sürüm işlevsel canlı beta olarak değerlendirilebilir; hukuki üretim lansmanı ve veritabanı şema onayı ayrıca tamamlanmalıdır.

## Giriş kriterleri

- İstenen beş lig ve aktif spor branşları tanımlıydı.
- Üretim build'i çalıştırılabilir durumdaydı.
- API, canlı skor, Predict, responsive ve performans harness'ları mevcuttu.
- Test verisi olan ve sağlayıcı verisi olmayan durumlar ayrı çalıştırılabildi.
- Canlı yayın hedefi ve mevcut Sites projesi tanımlıydı.

## Gereksinim izlenebilirlik matrisi

| ID | Gereksinim | Doğrulama | Sonuç |
|---|---|---|---|
| R1 | Futbol ana sayfasında beş lig tek kompakt akışta yer almalı | Football IA, five-league contract, responsive `anasayfa` | Geçti |
| R2 | Lig sayfası yalnız seçilen ligin season/live verisini istemeli | Demand-scope, responsive 5 lig cardinality kontrolleri | Geçti |
| R3 | Bir branşın verisi başka branşa sızmamalı | Worker hardening, responsive basketbol/voleybol/UFC/Formula 1 | Geçti |
| R4 | Görünmeyen ekran API kotası tüketmemeli; eski istek iptal edilmeli | Demand-scope, Instagram canonical-scope UI testi | Geçti |
| R5 | Canlı skor cache, single-flight, stale ve hata durumlarını doğru ayırmalı | Live architecture 43/43, Supabase live quota | Geçti |
| R6 | Maç detayları olay, istatistik, kadro ve tahmin akışını fixture bazında çözmeli | Matchday resolver, snapshots, live details, dist fixture smoke | Geçti |
| R7 | Maçların altında takım logolu 1/X/2 Predict seçenekleri bulunmalı | Football IA ve üretim dist tarayıcı smoke | Geçti |
| R8 | Predict hileye, tekrar claim'e ve kullanıcılar arası veri sızıntısına kapalı olmalı | Predict security, football predictions, demand-scope owned hydrate | Geçti |
| R9 | Sağlayıcı HTML/4xx/5xx yanıtı “maç yok” olarak cachelenmemeli | API harness, Worker hardening | Geçti |
| R10 | Site 320/375/390/768/1440 genişliklerinde taşmamalı ve skeleton'da kalmamalı | Responsive withdata/nodata | Geçti |
| R11 | Kritik mobil içerik ve lig geçişleri belirlenen performans bütçesinde olmalı | Release performance gate | Geçti |
| R12 | Hukuki placeholder ve DB migration/RLS kontrolleri kapanmalı | `check:legal`, `qa:db` | Açık dış bağımlılık |

## Test planı ve ortam

- Statik/sözdizimi: Node tabanlı proje kontrolleri.
- API ve iş mantığı: Worker request/response harness'ları, lig/branş kapsam kontrolleri.
- Güvenlik: Predict oturum/nonce/claim testleri, token maskeleme ve kullanıcıya ait veri sorguları.
- Entegrasyon: canlı skor Worker + Supabase fallback, matchday resolver ve üretim dist smoke.
- Arayüz: Chromium üzerinde desktop/mobile, veri dolu ve veri yok senaryoları.
- Performans: 390×844, CPU 4× ve Fast 3G profili, üç bağımsız soğuk koşu.
- Veritabanı hedefi: PostgreSQL 16 migration apply → rollback → re-apply, RLS ve eşzamanlı claim; bu ortamda servis bulunmadığı için çalıştırılamadı.

## Yürütme özeti

| Paket | Sonuç |
|---|---:|
| API harness | 155/155 |
| Live architecture | 43/43 |
| Worker hardening | 68/68 |
| Production dist smoke | 32/32 |
| Responsive, veri dolu | 876/876 |
| Responsive, veri yok | 535/535 |
| Toplam responsive sayfa senaryosu | 120/120 |
| Predict security / football predictions | Geçti |
| Football IA / five-league / demand-scope | Geçti |
| Matchday resolver / snapshots / live details | Geçti |
| Chat ve match-center UI | Geçti |
| Instagram canonical-scope | 2 rota, 0 görünmeyen API isteği |
| Production build | Geçti, %15 küçültme |
| Legal gate | Kaldı: yurt dışı aktarım mekanizması |
| PostgreSQL/RLS | Koşulamadı: yerel servis/`psql` yok |

## Performans sonucu

- Medyan FCP: **556 ms** (bütçe 1.000 ms)
- Beş lig dolu ana ekran: **1.502 ms** (bütçe 2.500 ms)
- Premier League geçişi: **462 ms** (bütçe 1.500 ms)
- Doğrudan Süper Lig shell: **683 ms** (bütçe 1.000 ms)
- Doğrudan Süper Lig dolu görünüm: **1.416 ms** (bütçe 2.500 ms)
- En uzun ana-thread görevi: **160 ms** (bütçe 250 ms)
- Yinelenen API, cardinality, console ve page error: **0**

## Test sırasında bulunan ve kapatılan olay

Eski Instagram UI testi, canonical futbol kökünde artık görünmeyen legacy bir bölümü kaydırmaya çalışarak zaman aşımına düşüyordu. Ürün davranışı gereği bu modül görünür değildir. Test, ana sayfa ve lig sayfasında görünmezliğin yanında sıfır API çağrısını da zorunlu kılacak şekilde güncellendi; iki rota da geçti. Böylece eski test varsayımı düzeltilirken görünmeyen modülün kota tüketmesi de regresyon kapısına bağlandı.

## Çıkış kriterleri

- [x] Kritik işlevler ve beş lig/branş izolasyonu geçti.
- [x] Güvenlik, canlı veri, hata ve kota senaryoları geçti.
- [x] Üretim build'i ve dist smoke geçti.
- [x] 120 responsive senaryo geçti.
- [x] Performans bütçeleri geçti.
- [ ] Hukuki yurt dışı aktarım mekanizması gerçek kararla dolduruldu.
- [ ] PostgreSQL migration/RLS paketi bu sürüm commit'i üzerinde yeniden geçti.
- [ ] Üyelik doğrulama e-postası canlı SMTP ile doğrulandı.
- [ ] Gerçek in-play sağlayıcı maçı sırasında baştan sona canlı saha testi tamamlandı.

## Canlı sonrası izleme

- Ana sayfada `/api/football/home` ve `live?league=all` cardinality izlenmeli.
- Tek lig rotasında yalnız kendi `season` ve `live` istekleri görülmeli.
- Sağlayıcı 429/5xx oranı, stale veri süresi ve `sync_in_progress` sayısı takip edilmeli.
- Gerçek canlı maçta skor, dakika, olay, istatistik ve kadro yayılım süresi kaydedilmeli.
- Hukuki ve SMTP maddeleri kapanmadan “tam üretim lansmanı” etiketi kullanılmamalı.
