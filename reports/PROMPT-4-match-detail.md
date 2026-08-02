# XYZSKOR — Prompt 4 Sonuç Raporu

Tarih: 2 Ağustos 2026

## Yapılanlar

- Maç Merkezi üst bilgisi gerçek spor ürünü hiyerarşisine geçirildi.
- Turnuva, tarih, maç durumu, takımlar, varsa doğrulanmış skor, başlangıç saati, stadyum, hakem ve tahmin kapanış zamanı aynı üst alanda düzenlendi.
- Sonuç bulunmayan maçta skor üretilmiyor; başlangıç saati gösteriliyor.
- Tahmin kapanışı mevcut 15 dakikalık kilit davranışından hesaplanıyor.
- Kullanıcının yalnız kendi tahmini üst alanda gösterilebiliyor.
- `Genel Bakış`, `Maç Akışı`, `Kadrolar`, `İstatistikler`, `Eksikler`, `Maç Önü`, `İlgili Haberler` ve `Topluluk` maç detayının erişilebilir alt bölümleri olarak düzenlendi.
- Kadro, eksik, olay akışı, istatistik ve haber bulunmadığında bağlamsal boş durumlar eklendi.
- İlgili haberler yalnız yayınlanmış `weekly_stories.cards` kayıtlarında gerçek `related_match_id` ilişkisi varsa gösteriliyor.
- Topluluk alanı diğer kullanıcıların bireysel tahminlerini göstermiyor.
- Maç detay sorguları bağımsız hata yönetimine geçirildi; bir sorgunun hatası diğer detay bölümlerini durdurmuyor.
- Tarayıcı geri dönüşü ve modal kapatma davranışı history kaydı şişirmeden çalışacak şekilde düzenlendi.
- Futbol ekranının hash ve scroll bağlamı dönüşte korunuyor.
- Maç Merkezi focus trap, Escape kapatma ve sekmelerde ok/Home/End klavye kontrolü aldı.
- Veri tabanından gelen maç, kadro, eksik, analiz ve haber metinleri HTML kaçışından geçirildi.

## Değiştirilen Dosyalar

- `index.html`
- `scripts/check.mjs`
- `reports/PROMPT-4-match-detail.md`

## Korunan Sistemler

- Supabase Auth ve oturum yönetimi
- Tahmin kaydetme sistemi
- Tahmin kilitleme zamanı
- `computeMatchPoints`
- Haftalık ve genel liderlik hesapları
- Takım seçimi
- Hash routing
- Canlı veri adaptörü
- Mevcut RLS ve tahmin gizliliği davranışı
- Admin yetki kontrolleri

## Eklenen Fonksiyonlar

- `mcQuery`
- `setMcTabState`
- `goToPredictionFromMatch`
- `renderMcAbsences`
- `mcModelHTML`
- `renderMcPrematch`
- `relatedNewsForMatch`
- `renderMcNews`
- `renderMcCommunity`

## Veri ve API Değişiklikleri

- Yeni tablo, migration, RLS policy veya API endpoint eklenmedi.
- Maç detayının mevcut dört Supabase çağrısı korunarak sonuçları bağımsız ele alındı.
- Anonim consensus sonucu arayüzde yayınlanmadı; mevcut gizlilik davranışı korundu.
- İlgili haberler mevcut yayınlanmış editoryal kayıtların ilişki alanından okunuyor.
- Doğrulanmış kaynak adı kayıtta bulunmuyorsa sabit bir medya kaynağı uydurulmuyor.

## Çalıştırılan Testler

- `npm run check`
- `npm run build`
- Gerçek Supabase fikstür kaydıyla Maç Merkezi açma
- Tüm maç detayı sekmelerine geçiş
- Sekmelerde klavye yön tuşu kontrolü
- Kadro boş durumu
- Maç akışı boş durumu
- İlgili haber ilişkisi
- Topluluk tahmin gizliliği
- Tarayıcı geri dönüşü
- Mobil ve masaüstü responsive kontrol
- Tarayıcı konsol kontrolü

## Test Sonuçları

- Otomatik kontrol: başarılı.
- Production build: başarılı.
- Maç Merkezi açılışı: başarılı.
- Erişilebilir tab durumu ve `aria-selected`: başarılı.
- İlgili haber: gerçek ilişkiyle 1 kayıt gösterildi.
- Bireysel tahmin gizliliği: başarılı.
- Browser Back: modal kapandı, `#football` bağlamı ve scroll konumu korundu.
- Tarayıcı uygulama hatası: yok.
- Yerel canlı Edge Function bağlantı uyarısı devam ediyor; Maç Merkezi davranışını durdurmuyor.

## Görsel Kontroller

- Büyük, pazarlama tipi maç hero kullanılmadı.
- Skor/başlangıç merkezli kompakt spor yayını hiyerarşisi doğrulandı.
- Uzun takım adları için satır kırma güvenliği eklendi.
- Sekmeler maç detay paneli içinde yatay kaydırılabilir.
- Kapatma düğmesi 44 × 44 px.

## Mobil Kontroller

| Genişlik | Sonuç |
| --- | --- |
| 360 px | Taşma yok; tam ekran panel; arma/kapatma çakışması yok |
| 390 px | Taşma yok |
| 430 px | Taşma yok |
| 768 px | Taşma yok; panel genişliği ekrana uyuyor |
| 1280 px | Taşma yok; panel 900 px |
| 1440 px | Taşma yok; panel 900 px |

## Gerçek Veriye Bağlı Olmayan Alanlar

- Doğrulanmış olay akışı bulunmadığından gol, kart ve oyuncu değişikliği gösterilmiyor.
- Kadrolar henüz açıklanmadığı için dürüst boş durum gösteriliyor.
- Hakem ve hava verisi bulunmayan maçlarda bilgi eksikliği açıkça belirtiliyor.
- Ayrı maç istatistiği sağlayıcısı bulunmadığından yalnız mevcut lig tablosu karşılaştırması kullanılıyor.
- Topluluk consensus verisinin RLS/policy kaynağı repoda doğrulanamadığı için dağılım yayınlanmıyor.

## Devam Eden Riskler

1. Consensus RPC ve maç detayı tablolarının migration/RLS SQL’i repoda bulunmuyor; sunucu tarafı gizlilik denetimi ayrıca gerekli.
2. Canlı Edge Function yerel önizlemede erişilemiyor.
3. Maç olayları için bağlı ve doğrulanmış bir veri modeli bulunmuyor.
4. Kaynak adı maç kaydında bulunmadığında yalnız doğrulama durumu gösteriliyor; kaynak adı uydurulmuyor.

## Sonraki Mantıklı Adım

Prompt 5 kapsamında Predict ana ekranını, mevcut tahmin kilidi, kayıt, puanlama ve liderlik davranışlarını değiştirmeden kompakt bir haftalık yarışma deneyimine dönüştürmek.
