# XYZSKOR dış inceleme ve tamamlama devir belgesi

Tarih: 25 Ağustos 2026  
Canlı adres: `https://xyzskor-tr.korayeris2002.chatgpt.site/`  
Kaynak dalı: `integration/latest-zip-2026-08-17`

## 1. Amaç

Bu belge, mevcut çalışan mimariyi bozmadan XYZSKOR'u tamamlayacak sonraki
geliştirici için gerçek durum, açık sorunlar, kabul kriterleri ve test sırasını
tanımlar. Amaç yeniden tasarım uğruna veri izolasyonu, API kotası, canlı skor,
Predict güvenliği veya Supabase RLS sözleşmelerini geriletmemektir.

## 2. Mevcut çalışan temel

- Futbol ana yüzeyi beş ligi kapsar: Süper Lig, Premier League, La Liga,
  Bundesliga ve Serie A.
- Kök futbol ekranı tek `/api/football/home` isteğiyle kompakt veri alır; tarayıcı
  beş ayrı sezon isteğine fan-out yapmaz.
- Tek lig rotası yalnız kendi `/season`, `/live`, liderlik ve haftalık özellik
  kapsamını ister.
- Basketbol, voleybol, UFC ve motor sporları birbirinin veya futbolun API
  ailesine istek göndermez.
- Görünmeyen sekme canlı polling'i durdurur ve devam eden istek iptal edilir.
- Worker tarafında home, season, live, multisport, UFC ve motor sporları için
  single-flight/cache/lease korumaları vardır.
- Predict kullanıcı tahminleri kullanıcıya ve görünür kapsama göre dar yüklenir.
- Haftalık futbol özellikleri Sportmonks olaylarından XYZSKOR algoritmasıyla
  hesaplanır; hazır sağlayıcı rating'i doğrudan kullanılmaz.
- Son ölçüm: FCP 540 ms, dolu beş lig ekranı 1443 ms, Premier League geçişi
  397 ms, direkt lig görünümü 1416 ms, en uzun görev 135 ms; tekrarlı kritik API
  isteği ve konsol hatası sıfırdır.

## 3. Son yapılan değişiklikler

- Branş rotalarında ham/çizgisiz DOM'un kısa süre görünmesini azaltmak için
  branch first-paint koruması ve stil ön ısıtması eklendi.
- Üst spor sırası `Futbol, Basketbol, Voleybol, Motor Sporları, UFC, Predict`
  olarak sabitlendi.
- Yanlış anlam yaratan `Ana Sayfa` spor etiketi `Futbol` olarak değiştirildi.
- Maç tahmin kutularındaki parlak mavi yüzey koyu/nötr XYZSKOR tasarımına
  çevrildi; `Bugün ve yaklaşan maçlar` başındaki yeşil nokta kaldırıldı.
- Predict hesap görünümünü kıran `PREDICT_REWARD_TIERS is not defined` production
  hatası giderildi.
- Haftanın oyuncuları ve haftanın takımında doğrulanmamış/yapay yüz kullanılmaz.
  Resmî Sportmonks oyuncu fotoğrafı olmayan futbolcu görsel yüzeyde gösterilmez;
  haftanın 11'i aynı pozisyondaki fotoğraflı uygun adayla tamamlanmaya çalışır.
- Yeni doğrulanmış test hesabı Supabase Auth ve profile trigger üzerinden
  oluşturuldu; parola veya token bu belgeye ve Git'e yazılmadı.

## 4. Açık ve çözülmesi gereken konular

### P0 — yayın öncesi zorunlu

1. **Hukuki metinler hâlâ placeholder içeriyor.** `npm run check:legal`
   başarısızdır. Şirket/unvan, veri sorumlusu, iletişim, yürürlük ve yetkili merci
   alanları gerçek hukukçu onayıyla tamamlanmadan yayın hazır kabul edilmemeli.

2. **Production veritabanı son kaynakla yeniden doğrulanmadı.** Bu makinede
   `npm run qa:db` PostgreSQL/psql yokluğu nedeniyle atlandı. Son migration için
   gerçek PostgreSQL üzerinde apply → RLS → 20 paralel haftalık hesap/upsert →
   rollback → re-apply döngüsü zorunludur. Production şemasına elle müdahale
   edilmemeli.

3. **Üyelik doğrulama e-postası canlı SMTP ile kapanmadı.** Supabase Auth'ta
   kayıt ve oturum açma çalışıyor; fakat gerçek kullanıcıya doğrulama mailinin
   teslimi, yeniden gönderim, süresi dolmuş link ve rate-limit senaryoları canlı
   SMTP üzerinde uçtan uca kanıtlanmadı. Auto-confirm yalnız test hesabı için
   kullanıldı; production çözümü değildir.

4. **Gerçek canlı maç sırasında tam E2E kanıt eksik.** Mock ve mimari testler
   yeşildir fakat kickoff öncesi → canlı → devre → ikinci yarı → bitiş → canlı
   listesinden düşme zinciri gerçek bir sağlayıcı maçı boyunca ekran, Worker,
   Supabase fallback ve cache başlıklarıyla birlikte kaydedilmelidir.

### P1 — kullanıcı deneyimi ve ürün mantığı

1. **Genel ana sayfa bilgi mimarisi tamamlanmadı.** `/` şu anda beş ligli futbol
   merkezi olarak davranır. Marka logosunun götürdüğü gerçek genel ana sayfa;
   futbol, basketbol, voleybol, motor sporları ve UFC'yi özetleyen ama ilk
   açılışta bütün spor API'lerini çağırmayan bağımsız bir shell olmalıdır.
   Çözüm, tüm API'leri peş peşe çağırmak değildir. İlk ekranda statik branş
   kartları ve yalnız seçilen/görünür branşın lazy verisi kullanılmalıdır.

2. **Branş geçişleri tam sayfa navigasyondur.** Futbol ↔ basketbol ↔ voleybol ↔
   motor sporları ↔ UFC geçişinde `location.assign` kullanılır. First-paint
   koruması ham DOM'u azaltır fakat kullanıcı yine belge yenilemesi hisseder.
   Route-aware ortak shell veya küçük bir istemci router kurulmalı; eski isteği
   abort etmeli, yeni branşın CSS/JS paketini önceden indirmeli ve mevcut header'ı
   yeniden oluşturmamalıdır. API sahibi yine yalnız aktif branş olmalıdır.

3. **Haftanın 11'i fotoğraf kapsamına bağlıdır.** Resmî fotoğrafı olmayan oyuncu
   yerine aynı pozisyondaki fotoğraflı aday kullanılıyor. Bir pozisyonda yeterli
   fotoğraflı aday yoksa bölüm güvenli biçimde yayınlanmaz. Bu durum veri
   doğruluğunu korur fakat sportif sıralamayı değiştirebilir. Doğru uzun vadeli
   çözüm, Sportmonks planında Player Images kapsamını doğrulamak veya lisanslı
   resmî oyuncu medya kaynağı satın almaktır; internetten rastgele fotoğraf
   kopyalanmamalıdır.

4. **Lider listelerinde fotoğrafı olmayan gerçek lider atlanabilir.** Görsel
   zorunluluğu nedeniyle gösterilen ilk beş, ham istatistik ilk beşinden
   farklılaşabilir. UI'da `Fotoğraflı oyuncular` diye açık etiketlenmeli veya
   lisanslı fotoğraf kapsamı tamamlanmalıdır.

5. **Branş tasarımları aynı kalite seviyesinde değil.** Futbol lig görünümü en
   olgun yüzeydir. Basketbol, voleybol, UFC ve motor sporlarında gerçek veri az
   olduğunda büyük boş alan oluşmamalı; doğrulanmış boş sonuç, yaklaşan veri ve
   son güncelleme durumu kompakt şekilde gösterilmelidir. Futbol widget'ı veya
   transfer modülü başka branşa taşınmamalıdır.

6. **Geçiş sırasında metin/skeleton politikası tutarlı değil.** Kullanıcı eski
   içeriği görürken küçük bir progress göstergesi tercih edilmeli; tüm sayfayı
   skeleton'a veya ham metne çevirmek yasaklanmalıdır. Focus, scroll ve seçili
   filtre korunmalıdır.

7. **Kaynak ve içerik lisansı gizlenmemeli.** X/medya verisi yalnız transfer ve
   doğrulanabilir futbol gündemi için kullanılabilir; metin XYZSKOR dilinde
   özetlenebilir fakat kaynak bağlantısı, yayıncı ve lisans yükümlülüğü
   kaldırılmamalıdır. Kaynağı kullanıcıdan saklamak hukuki ve güven problemi
   yaratır.

### P2 — büyüme ve operasyon

- Supabase Pro/Micro satın alımı tek başına saatteki ürün test sınırını çözmez;
  Auth SMTP, rate limit, connection/pool, PITR/backups, gözlemleme ve saklama
  politikaları birlikte planlanmalıdır.
- Beş yıllık kullanıcı verisi hedefi için event/audit tabloları bölümlenmeli,
  kişisel veri saklama/silme politikası, dışa aktarma ve satış öncesi veri
  envanteri kurulmalıdır.
- Sportmonks planında Player Images, lineups/formations, detailed statistics,
  sidelined, xG, odds ve news/media hakları endpoint bazında ölçülmeden plan
  yükseltilmemelidir.

## 5. Tasarım yönü

- FotMob veya Sofascore piksel piksel kopyalanmayacak.
- XYZSKOR yönü: koyu kömür zemin, mercan vurgu, mint canlı/veri durumu,
  geniş boşluk, düşük sayıda sınır ve iç içe kartlardan kaçınma.
- Büyük kare içinde küçük kare görünümü, sürekli çizgiler, parlak mavi seçim
  yüzeyi ve gereksiz durum noktaları kullanılmayacak.
- Masaüstünde içerik genişliği dengeli; mobilde 320/360/375/390/430 px'te tek
  kolon, 44×44 dokunma hedefi ve yatay taşmasız olmalıdır.
- Haftanın takımındaki saha daha dar tutulabilir; yan panel yalnız gerçek değer
  üretiyorsa kalmalı. Resmî fotoğraf yoksa sahte yüz gösterilmemeli.

## 6. Değiştirilemeyecek mimari sözleşmeler

- `/` futbol kapsamındaysa tarayıcı: en fazla bir `/football/home` ve bir
  `/football/live?league=all`.
- Tek lig: en fazla bir kendi `/season`, bir kendi `/live`; başka lig isteği yok.
- Explicit `?fixture=`: home/season yok, yalnız matchday zinciri.
- Predict: yalnız seçilen lig ve oturum açmış kullanıcının dar verisi.
- Basketbol/voleybol: yalnız aktif sporun `/api/sports/today?sport=...` isteği.
- Gizli sekmede poll yok; route/branş değişiminde eski fetch abort.
- Spor menüsü API sahibi değildir; yalnız görünür hub veri ister.
- Provider HTML/4xx/5xx/timeout sonucu `maç yok` diye cache'lenmez.
- Eşzamanlı kullanıcılar provider'a fan-out yapmaz; single-flight/lease korunur.
- Secret, token, parola ve service-role değeri DOM, log, ZIP veya Git'e girmez.

## 7. İstenen çalışma sırası

1. Repo ve bu belgeyi oku; `sources/` dizinine dokunma.
2. Temiz worktree ve mevcut branch/commit durumunu kaydet.
3. `npm run check`, `npm run build`, demand-scope, hardening, live, Predict,
   matchday ve weekly testlerini baseline olarak çalıştır.
4. Önce genel ana sayfa ile branch router geçişini tasarla; API cardinality
   testini değişiklikten önce yaz.
5. Mobil ve masaüstünde tüm branşları gerçek kullanıcı akışıyla doğrula.
6. Player Images kapsamını provider playground/canlı endpoint ile ölç; veri
   yoksa UI uydurmasın ve satın alma gereksinimini tablo halinde çıkar.
7. Canlı SMTP ve production PostgreSQL adımlarını ayrı, kanıtlı operasyon olarak
   tamamla.
8. Hukuki gate kapanmadan “production hazır” deme.

## 8. Zorunlu final test matrisi

```text
npm ci
npm run check
npm run build
npm run check:legal
npm run qa:api
npm run qa:demand-scope
npm run qa:league-contract
npm run qa:football-ia
npm run qa:matchday
npm run qa:live-architecture
npm run qa:live-quota
npm run qa:hardening
npm run qa:weekly-football
npm run qa:predict-security
npm run qa:football-predictions
npm run qa:supabase-lazy
npm run qa:dist
npm run qa:responsive
npm run qa:responsive:nodata
npm run qa:perf
npm run qa:db
```

Gerçek PostgreSQL ve canlı SMTP gerektiren adımlar atlanırsa açıkça `ATLANDI` diye
raporlanmalı; geçmiş bir rapor yeni kanıt gibi sunulmamalıdır.

## 9. Tamamlanma kabul kriterleri

- Logo gerçek genel spor ana sayfasına gider; `Futbol` ayrı ve anlaşılırdır.
- Branş geçişinde ham DOM, eski branş metni, tüm sayfa skeleton'ı veya belirgin
  beyaz/siyah flash görünmez.
- Geçişte yalnız yeni görünür branşın API ailesi çağrılır.
- Her haftalık oyuncu görseli gerçek ve lisanslı oyuncu fotoğrafıdır; alternatif
  yüz/arma/top oyuncu fotoğrafı gibi sunulmaz.
- Tüm lig/branş ekranlarında boş alan yerine dürüst ve kompakt veri durumu vardır.
- Mobil 320–430, tablet 768 ve masaüstü 1440 testleri sıfır taşma/hata ile geçer.
- Gerçek canlı maç zinciri ve email doğrulama kanıtı eklenir.
- Legal ve production DB gate'i yeşil olmadan release tamamlandı sayılmaz.

## 10. Dış geliştiriciye verilecek kısa görev metni

> XYZSKOR deposunu devral. Önce bu belgedeki mimari sözleşmeleri ve testleri
> doğrula. Çalışan backend, API kota korumaları, lig/branş izolasyonu, Predict
> güvenliği ve Supabase RLS yapısını bozma. Öncelik sırası: gerçek çok sporlu ana
> sayfa, flash/delay üretmeyen route-aware geçiş, tüm branşlarda boşluksuz mobil
> UI, yalnız lisanslı gerçek oyuncu fotoğrafları, canlı maç E2E, SMTP ve production
> PostgreSQL doğrulaması, ardından legal gate. FotMob/Sofascore'u kopyalama;
> XYZSKOR'un kömür/mercan/mint tasarımını sade ve özgün biçimde geliştir. Her
> değişiklikten sonra request-cardinality, responsive ve performance kapılarını
> çalıştır. Yapamadığın veya doğrulayamadığın her şeyi final raporda açıkça yaz.
