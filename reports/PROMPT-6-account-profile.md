# XYZSKOR — Prompt 6 Sonuç Raporu

Tarih: 2 Ağustos 2026

## Yapılanlar

- Profil deneyimi üçüncü ana ekran yerine masaüstü avatarı ve mobil hesap düğmesinden açılan drawer içinde toplandı.
- Giriş yapmış kullanıcı için kullanıcı adı, tuttuğu takım, e-posta, haftalık puan, toplam puan, genel sıra, doğru tahmin oranı, kesin skor ve toplam tahmin sayısı gösteriliyor.
- Kullanıcının yalnız kendi tahminlerinden son sekiz kayıtlık kompakt tahmin geçmişi oluşturuldu.
- Kazanılmış rozetler gerçek hesap performansından hesaplanarak gösteriliyor; kazanılmamış rozetler başarı gibi sunulmuyor.
- Takım seçimi ve sezonda bir kez takım değiştirme davranışı hesap ayarlarına taşındı.
- Takip edilen takım/futbolcu ve bildirim tercihi için mevcut veri modeli bulunmadığından sahte seçimler yerine dürüst durum mesajları eklendi.
- Bildirim düğmesindeki doğrulanmamış okunmamış bildirimi ima eden yeşil nokta kaldırıldı.
- Yönetim Paneli bağlantısı yalnız `u.is_admin` koşulunda DOM’a ekleniyor.
- Drawer Escape ile kapanıyor, odağı açan düğmeye döndürüyor ve Tab/Shift+Tab odağını panel içinde tutuyor.
- Mobil drawer `100dvh`, safe area ve kontrollü iç kaydırma kullanıyor.

## Değiştirilen Dosyalar

- `index.html`
- `scripts/check.mjs`
- `reports/PROMPT-6-account-profile.md`

## Korunan Sistemler

- Supabase Auth ve oturum yönetimi
- Profil oluşturma ve okuma akışı
- Takımı sezonda yalnız bir kez değiştirme davranışı
- Tahmin kaydetme ve kilitleme
- `computeMatchPoints`
- Haftalık ve genel liderlik
- Mevcut admin işlemleri ve sunucu/RLS yetki kontrolleri
- Hash route alias davranışı

## Eklenen Fonksiyonlar

- `accountGeneralRank`
- `accountHistoryHTML`
- Genişletilen `renderAccountContent`

## Veri ve API Değişiklikleri

- Yeni tablo, migration, RLS policy veya Auth davranışı eklenmedi.
- Takip ve bildirim tercihi için istemci tarafında geçici veri tutulmadı.
- Hesap metrikleri yalnız mevcut maç, sonuç, tahmin ve profil kayıtlarından hesaplanıyor.
- Admin bağlantısının arayüz koşulu güçlendirildi; sunucu tarafı yetkilendirme yerine kullanılmadı.

## Çalıştırılan Testler

- `npm run check`
- `npm run build`
- Misafir hesap drawer açılışı
- Admin bağlantısının misafir DOM’unda bulunmaması
- Açılışta kapatma düğmesine odak
- Escape ile kapatma ve odağı geri verme
- Tab ve Shift+Tab focus trap
- 360, 390, 430, 768, 1280 ve 1440 px responsive kontrol
- 360 px mobil görsel kontrol

## Test Sonuçları

- Otomatik kontrol: başarılı.
- Production build: başarılı.
- Misafir drawer açılışı ve auth çağrıları: başarılı.
- Misafir DOM’unda Yönetim Paneli bağlantısı: bulunmadı.
- Escape ile kapanma ve odağın hesap düğmesine dönüşü: başarılı.
- Focus trap: ilk ve son kontrol arasında iki yönde başarılı.
- Test edilen genişliklerde yatay taşma: yok.
- Giriş yapılmış kullanıcı profili üretim verisine yazmadan test edilemedi; test hesabı oluşturulmadı.

## Görsel Kontroller

- Drawer koyu, keskin ve kompakt spor ürünü görünümünü koruyor.
- Profil ayrı navigasyon sekmesi olarak görünmüyor.
- Misafir görünümünde yalnız üyelik ve giriş eylemleri bulunuyor.
- Mobilde kapatma düğmesi 44 × 44 px ve görünür focus ring taşıyor.

## Mobil Kontroller

| Genişlik | Sonuç |
| --- | --- |
| 360 px | Tam genişlik drawer; yatay taşma yok |
| 390 px | Tam genişlik drawer; yatay taşma yok |
| 430 px | Kontrollü drawer genişliği; taşma yok |
| 768 px | Sağ drawer; taşma yok |
| 1280 px | Sağ drawer; arka plan kilidi korunuyor |
| 1440 px | Sağ drawer; taşma yok |

## Gerçek Veriye Bağlı Olmayan Alanlar

- Takip edilen takımlar ve futbolcular için mevcut profil alanı/tablosu bulunmuyor.
- Bildirim tercihleri için mevcut kullanıcı ayarı kaydı bulunmuyor.
- Bu alanlarda sahte varsayılan, sahte takip veya çalışmayan toggle oluşturulmadı.

## Devam Eden Riskler

1. `profiles.is_admin` alanı istemci görünürlüğünü belirliyor; gerçek yetki güvenliği mevcut RLS ve sunucu kontrollerine bağlı kalmalı.
2. Profil, tahmin ve liderlik tablolarının migration/RLS SQL’i repoda bulunmuyor; yetki denetimi ayrıca gerekli.
3. Takip ve bildirim özellikleri açılmadan önce kullanıcıya özel tablo, RLS, doğrulama ve geri alma tasarımı gerekiyor.
4. Giriş yapılmış kullanıcıyla takım değiştirme ve çıkış akışı uçtan uca test hesabıyla ayrıca doğrulanmalı.

## Sonraki Mantıklı Adım

Prompt 7 kapsamında yalnız yayımlanmış gerçek haber kayıtlarıyla çalışan haber detayını ve güven açıklamalarını oluşturmak; eksik kaynak/kronoloji alanları için şema değiştirmeden açık boş durum ve ayrı veri modeli önerisi hazırlamak.
