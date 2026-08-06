# XYZSKOR — Prompt 9 Performans ve Kod Ayırma Raporu

Tarih: 2 Ağustos 2026

## Yapılanlar

- Dosya boyutu, Supabase çağrıları, `renderAll` kullanımları, event listener’lar, DOM ve görsel yükleme davranışı ölçüldü.
- Tek tahmin kaydından sonra sekiz tabloyu yeniden çeken `loadAllData()` ve bütün uygulamayı yenileyen `renderAll()` kaldırıldı.
- Başarılı Supabase upsert’inden sonra yalnız doğrulanmış kayıt yerel tahmin cache’ine yazılıyor; Predict özeti ve maç listesi yeniden çiziliyor.
- Kayıt başarısızsa yerel cache değişmediği için rollback ihtiyacı oluşmuyor.
- Ekran dışındaki eski hikâye düzeni ve uzun Predict listesine `content-visibility:auto` eklendi.
- Gizli kampanya görsellerine lazy loading eklendi.
- Framework/ES module geçişi ve büyük dosya ayırma yapılmadı; inline handler ve mevcut build/deployment davranışı korunarak risk ertelendi.

## Değiştirilen Dosyalar

- `index.html`
- `scripts/check.mjs`
- `reports/PROMPT-9-performance.md`

## Korunan Sistemler

- Tahmin doğrulama, kilit ve Supabase upsert
- `computeMatchPoints`
- Auth, RLS ve kullanıcı tahmini gizliliği
- Hash routing
- Maç Merkezi ve canlı veri adaptörü
- Mevcut Vanilla JS deployment modeli

## Eklenen Fonksiyonlar

- Yeni public fonksiyon eklenmedi.
- `savePrediction` başarılı sunucu yanıtından sonra cache güncelleyecek şekilde genişletildi.

## Veri ve API Değişiklikleri

- Şema, RLS veya API değişmedi.
- Tahmin kaydı öncesi: 1 upsert + ardından `loadAllData()` içindeki 8 tablo sorgusu.
- Tahmin kaydı sonrası: 1 upsert; ek toplu veri sorgusu yok.
- Sunucu başarısı alınmadan yerel tahmin değişmiyor.

## Çalıştırılan Testler

- `npm run check`
- `npm run build`
- Statik Supabase sorgu ve `renderAll` çağrı incelemesi
- 1280 px gerçek DOM ölçümü
- Lazy image ve yatay taşma kontrolü
- Production build dosya boyutu ölçümü

## Test Sonuçları

- Otomatik kontrol: başarılı.
- Production build: başarılı.
- `submitPrediction` içinde `loadAllData`: kaldırıldı ve test ile korunuyor.
- Başarılı kayıt sonrası `ALL_PREDICTIONS[matchId][userId]`: güncelleniyor.
- Güncel Futbol DOM’u: 1.316 element.
- DOM’daki 76 görselin ölçüm anında 15’i yüklenmişti; lazy kaynaklar ertelendi.
- Yatay taşma: yok.
- HTML boyutu önce 239.694 bayt, sonra 239.904 bayt. Performans değişikliği byte küçültme sağlamadı; 210 bayt artış ölçüldü.

## Görsel Kontroller

- `content-visibility` aktif; görünür Futbol modülleri ve gündem kartları kaybolmadı.
- Tahmin kayıt görünümü mevcut kompakt yapıyı koruyor.

## Mobil Kontroller

- Prompt 5–7’deki 360–1440 px kontrolleri korunuyor.
- Güncel 1280 px ölçümünde taşma yok.
- Bu değişiklik yeni breakpoint veya sabit genişlik eklemedi.

## Gerçek Veriye Bağlı Olmayan Alanlar

- Giriş yapılmış test hesabı olmadığından gerçek upsert’in ağ zamanlaması ölçülmedi.
- Tarayıcı Performance API’si test köprüsünde erişilebilir olmadığından transfer byte/LCP karşılaştırması alınamadı.

## Devam Eden Riskler

1. `index.html` yaklaşık 240 KB ve CSS/JS/HTML tek dosyada; sürdürülebilirlik riski devam ediyor.
2. Gizlenmiş eski kampanya, market ve Mythos kodu hâlâ dosyada; production render zincirinde değil ancak byte ve bakım maliyeti oluşturuyor.
3. `loadAllData()` ilk açılışta sekiz tabloyu `select('*')` ile çekiyor; veri büyüdüğünde sayfalama/alan seçimi gerekecek.
4. Büyük modül ayrımı inline handler’lar ve mevcut build nedeniyle Prompt 10 sonrasında ayrı davranış testleriyle yapılmalı.
5. Gerçek kullanıcıyla tahmin kaydı ve kilit sınırı uçtan uca test edilmedi.

## Sonraki Mantıklı Adım

Prompt 10 Hard Mode denetiminde gizli mock/kampanya kodu, XSS yüzeyleri, kırık butonlar, console hataları, iki ana alan ve yayın engelleyicileri uçtan uca kontrol edilmeli; yalnız güvenli frontend hataları düzeltilmeli.
