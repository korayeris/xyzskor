# XYZSKOR — Prompt 2 Sonuç Raporu

Tarih: 2 Ağustos 2026

### Yapılanlar

- Ana navigasyon yalnız `Futbol` ve `Predict` olarak yeniden kuruldu.
- Eski `story`, `stories`, `live`, `matches`, `standings`, `league`, `leader`, `rewards` ve `profile` hash’leri iki yeni ürün alanına yönlendirildi.
- Canlı veri modülü ayrı ana ekran olmaktan çıkarılıp Futbol alanının parçası yapıldı.
- Profil, giriş, kayıt, çıkış ve admin erişimi sağ üst hesap paneline taşındı.
- Normal/misafir kullanıcı hesap panelinde admin bağlantısı üretilmiyor.
- Hesap paneline ilk odak, focus trap, Escape ile kapanma, arka plan scroll kilidi ve odak geri dönüşü eklendi.
- Büyük sponsor hero, kampanya kartları, ürün vitrini ve hard-coded transfer/oyuncu panelleri görünür production akışından çıkarıldı.
- Lacivert, kırık beyaz, gri, kontrollü yeşil/mavi/amber/kırmızı/altın renklerini içeren Phase 1 token katmanı eklendi.
- Mobilde iki ana geçiş, 50 px dokunma alanı ve safe-area uyumu sağlandı.
- Kullanıcı adı, takım ve ödül metni için kritik render noktalarında HTML kaçışlaması eklendi.
- `npm run check` platform bağımsız hale getirildi.

### Değiştirilen Dosyalar

- `index.html`
- `scripts/check.mjs`
- `package.json`
- `README.md`

### Korunan Sistemler

- Supabase Auth ve oturum yükleme
- Kullanıcı kayıt/giriş akışı
- Takım seçimi ve tek değişim davranışı
- Tahmin upsert ve kickoff eksi 15 dakika kilidi
- `computeMatchPoints`
- Haftalık/genel liderlik ve tie-break
- Maç Merkezi ve `#match/:id` davranışı
- `#week/:number` davranışı
- Canlı veri Edge Function/adaptör sözleşmesi
- RLS ve admin backend kontrolleri
- Mythos Cards sponsor-only kuralı

### Eklenen Fonksiyonlar

- `escapeHTML`
- `renderAccountContent`
- `openAccount`
- `closeAccount`

### Veri ve API Değişiklikleri

- Supabase şeması, migration, RLS, auth veya Edge Function değiştirilmedi.
- Yeni mock veri eklenmedi.
- Hard-coded transfer/söylenti/oyuncu performans blokları görünür arayüzden kaldırıldı.

### Çalıştırılan Testler

- `npm run check`
- `npm run build`
- Futbol → Predict geçişi
- `#live` → Futbol alias testi
- `#profile` → Predict alias testi
- Misafir hesap paneli ve admin görünmezliği
- Hesap panelinde Escape ve odak geri dönüşü
- 360, 390, 430, 768, 1280 ve 1440 px responsive ölçüm
- Tarayıcı console/error kontrolü

### Test Sonuçları

- Check: başarılı.
- Production build: başarılı.
- İki ana ürün geçişi: başarılı.
- Eski route alias’ları: başarılı.
- Misafir hesap panelinde admin bağlantısı: 0.
- Son temiz tarayıcı çalışmasında console error: 0.
- Test edilen genişliklerde yatay taşma: yok.

### Görsel Kontroller

- Desktop header yalnız Futbol, Predict, bildirim ve hesap kontrollerini gösteriyor.
- Sponsor hero kaldırıldı; gerçek Futbol içeriği yaklaşık 126 px’de başlıyor.
- Gerçek maç/hafta içeriği ilk viewport içinde.
- Büyük yuvarlak kampanya kartları görünür ana akıştan çıkarıldı.

### Mobil Kontroller

- 360/390/430 px’de yalnız Futbol ve Predict ana geçişi görünür.
- Ana geçişler 50 px, hesap düğmesi 44 px.
- Eski beş öğeli alt navigasyon görünmüyor.
- Marka ve hesap düğmesi mobil header’da erişilebilir.
- Yatay taşma görülmedi.

### Gerçek Veriye Bağlı Olmayan Alanlar

- Hard-coded sponsor ve transfer veri sabitleri eski dosyada hâlâ bulunuyor fakat CSS ile production görünümünden çıkarıldı ve render sonucu kullanıcıya gösterilmiyor.
- Tam fiziksel kod temizliği davranış güvenli modül ayırma aşamasında yapılmalı.
- Haftalık hikâye ve fikstür içeriği mevcut Supabase verisinden geliyor; editoryal doğruluğu bu frontend aşamasında değiştirilmedi.

### Devam Eden Riskler

- Core Supabase/RLS migration’ları repoda hâlâ bulunmuyor; değiştirilmedi.
- Tüm legacy `innerHTML` noktaları henüz ortak güvenli renderer’a taşınmadı. Kullanıcı adı ve ödül gibi en doğrudan saldırı yüzeyleri kapatıldı; kalan admin/veri sağlayıcı alanları sonraki aşamalarda ele alınmalı.
- Admin bölümü link olarak yalnız admin hesap panelinde üretilse de legacy admin panel DOM’u kaynakta mevcut. Prompt 6’da yalnız yetkili kullanıcı için dinamik üretime taşınmalı.
- `loadAllData` tek hata sınırını kullanmaya devam ediyor.
- Statik legacy sponsor/market kodu dosya boyutunu artırıyor.
- Canlı Edge Function rate limiting ve core RLS ayrı güvenlik incelemesi gerektiriyor.

### Sonraki Mantıklı Adım

Prompt 3: Futbol alanını günlük futbol merkezine dönüştürmek; canlı/yaklaşan maçları, gerçek haber/boş durumlarını, transfer/boş durumunu ve puan durumu özetini modül bazlı hata sınırlarıyla tek ekranda birleştirmek.
