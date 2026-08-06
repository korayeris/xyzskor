# XYZSKOR — Prompt 7 Sonuç Raporu

Tarih: 2 Ağustos 2026

## Yapılanlar

- Futbol gündemindeki yayımlanmış gerçek kartlar klavye ve fareyle açılan haber detayına bağlandı.
- Haber detayına başlık, spot, metin, kategori, güven seviyesi/açıklaması, kaynaklar, zamanlar, editör, ilgili takım/oyuncu/maç, kronolojik güncellemeler, düzeltme ve paylaşma alanları hazırlandı.
- Yalnız veritabanında bulunan alanlar gösteriliyor; eksik güven, kaynak veya kronoloji açık boş durumla belirtiliyor.
- Resmî, Güçlü İddia, Söylenti, Veri Analizi, Çelişkili ve Gelişiyor güven seviyeleri ayrı açıklamalarla desteklendi.
- Kaynak URL’leri yalnız HTTP/HTTPS ise tıklanabilir; dış bağlantılar `noopener noreferrer` ile açılıyor.
- Ofsayt gündem referansındaki kaynak/kişi–oyuncu/takım–zaman hiyerarşisi gerçek alanlar varsa kartlara eklendi.
- Sosyal etkileşim, takipçi, görüntülenme, kullanıcı veya oyuncu profili sayıları uydurulmadı.
- Haber modalı focus trap, Escape kapatma, odağı geri verme, mobil tam ekran ve safe area desteği aldı.

## Değiştirilen Dosyalar

- `index.html`
- `scripts/check.mjs`
- `reports/PROMPT-7-news-trust.md`

## Korunan Sistemler

- Yalnız `is_published` içeriklerin public gösterimi
- Supabase veri okuma akışı
- Futbol ve Predict iki ana alan mimarisi
- Maç Merkezi ve haber–maç ilişkisi
- Auth, RLS, tahmin, puanlama ve liderlik
- Gerçek veri ve kaynak doğruluğu kuralları

## Eklenen Fonksiyonlar

- `safeExternalURL`
- `newsSources`
- `openNewsDetail`
- `closeNewsDetail`
- `storyIdentityHTML`
- Genişletilen `storyConfidence`

## Veri ve API Değişiklikleri

- Yeni tablo, migration, RLS policy veya haber botu eklenmedi.
- Mevcut `weekly_stories.cards` içindeki alanlar kullanıldı.
- Eksik kaynak URL’si, editör, ilk görülme, oyuncu, güncelleme ve düzeltme bilgisi üretilmedi.
- Ayrı kaynak/kronoloji şeması uygulanmadı.

## Çalıştırılan Testler

- `npm run check`
- `npm run build`
- Gerçek yayımlanmış haber kartı açılışı
- Kaynak URL güvenliği
- Eksik güven seviyesi ve kronoloji boş durumları
- İlgili maç bağlantısı
- Escape, focus trap ve odağı geri verme
- 360, 390, 430, 768, 1280 ve 1440 px responsive kontrol
- Masaüstü ve 360 px mobil görsel kontrol

## Test Sonuçları

- Otomatik kontrol: başarılı.
- Production build: başarılı.
- Gerçek kayıtla haber detayı: başarılı (`Haftanın Açılış Maçı`).
- Kaynak: gerçek `TFF resmî duyurusu` kaydı gösterildi; URL olmadığı için bağlantı uydurulmadı.
- Güven seviyesi bulunmayan kayıtta rozet üretilmedi; dürüst boş durum gösterildi.
- Güvensiz dış bağlantı: bulunmadı.
- Escape ve odağı haber kartına geri verme: başarılı.
- Test edilen genişliklerde yatay taşma: yok.

## Görsel Kontroller

- Haber detayı editoryal, yoğun ve spor yayını hissinde; pazarlama hero’su kullanılmadı.
- Kaynak ve güncelleme alanları okunabilir satır yapısında.
- Referans görseldeki gündem kimlik sırası birebir tasarım kopyalanmadan uyarlandı.
- Kayıt kimlik alanları yoksa gereksiz avatar veya sahte kullanıcı gösterilmiyor.

## Mobil Kontroller

| Genişlik | Sonuç |
| --- | --- |
| 360 px | Tam ekran haber; taşma yok; aksiyonlar erişilebilir |
| 390 px | Taşma yok |
| 430 px | Taşma yok |
| 768 px | Merkez modal; taşma yok |
| 1280 px | 760 px editoryal modal |
| 1440 px | 760 px editoryal modal |

## Gerçek Veriye Bağlı Olmayan Alanlar

- Mevcut örnek haberde ayrı spot, editör, oyuncu, kronolojik güncelleme ve kaynak URL’si bulunmuyor.
- Bu alanlarda sahte içerik gösterilmedi.
- Haber botu ve sosyal kullanıcı akışı henüz bağlı değil.

## Devam Eden Riskler

1. `weekly_stories.cards` iç içe JSON yapısı kaynak bağımsızlığı, düzeltme geçmişi ve audit için sınırlı.
2. Public/draft ayrımının gerçek güvenliği mevcut RLS’e bağlı; migration/policy SQL’i repoda bulunmuyor.
3. Kaynak URL doğrulaması istemcide güvenli protokolü denetliyor; yayın öncesi sunucu tarafı doğrulama ayrıca gerekli.
4. Haber botu bağlanmadan önce idempotency, kaynak normalizasyonu, editoryal onay ve audit akışı kurulmalı.

## Sonraki Mantıklı Adım

Prompt 8 kapsamında mevcut admin ve Supabase yapısını değiştirmeden incelemek; haber operasyonu, beş kişilik admin grubu ve Telegram bildirimleri için RLS/audit/rollback içeren incelemeye hazır teknik tasarım hazırlamak.
