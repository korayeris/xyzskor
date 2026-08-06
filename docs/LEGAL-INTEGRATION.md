# XYZSKOR Yasal Merkez — Entegrasyon Rehberi

## Teslim kapsamı

Bu paket şunları içerir:

- Profesyonel dört sütunlu footer
- 12 ayrı yasal/bilgilendirme sayfası
- KVKK aydınlatma ve başvuru formu
- Kullanım koşulları ve üyelik sözleşmesi
- Çerez politikası ve çalışan tercih yöneticisi
- Açık rıza ile ticari ileti onaylarının ayrı sunumu
- Oyun/ödül kuralları şablonu
- Künye ve hak ihlali bildirim sayfası

## Kurulum

1. ZIP içeriğini repo köküne, klasör yollarını koruyarak kopyalayın.
2. `assets/legal/legal-config.js` içindeki tüm köşeli parantezli alanları gerçek bilgilerle doldurun.
3. `snippets/signup-consents.html` içindeki alanları kayıt ekranınıza uyarlayın.
4. Analitik/pazarlama araçlarının başlatılmasını `XYZConsent.whenAllowed(...)` ile onaya bağlayın.
5. `npm run check` ve `npm run build` çalıştırın.
6. Alanlar doldurulduktan sonra `npm run check:legal` çalıştırın.

## Analitik entegrasyon örneği

```js
window.XYZConsent.whenAllowed('analytics', () => {
  // Analitik SDK'sını burada yükleyin.
});
```

Pazarlama SDK'ları için `marketing`, işlevsel araçlar için `functional` kategorisini kullanın.

## Yayına almadan önce zorunlu iş listesi

- Ticari unvan, vergi/sicil ve adres bilgileri doğrulandı.
- Gerçek e-posta ve KVKK başvuru kanalları açıldı.
- Çerez/depolama envanteri tarayıcı ve SDK bazında çıkarıldı.
- Supabase Ireland yurt dışı aktarım mekanizması hukukçu tarafından belirlendi ve gerekiyorsa bildirim yapıldı.
- Kampanyalar performansa dayalı mı, şansa dayalı mı sınıflandırıldı.
- Şansa dayalı seçim varsa izin gerekliliği değerlendirildi.
- Saklama süreleri muhasebe, 5651, KVKK ve sözleşme süreçleriyle uyumlu hale getirildi.
- Çocuk kullanıcı/yaş sınırı kararı verildi.
- Metinler gerçek ürün akışlarıyla karşılaştırıldı.

## Önemli

Bu paket operasyonel ve teknik bir hukuk metni taslağıdır; işletmenin gerçek faaliyetleriyle doğrulanmalı ve yayından önce Türkiye'de yetkili bir hukukçu tarafından son kontrolden geçirilmelidir. Metin eklemek tek başına KVKK uyumu sağlamaz; veri envanteri, yetkilendirme, sözleşmeler, güvenlik ve başvuru süreçleri de uygulanmalıdır.
