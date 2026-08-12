# XYZSKOR güvenli yayın kontrol listesi

Durum: Kapalı/güvenli beta. Bu belge hukuki danışmanlık değildir; üretim lansmanı öncesi uzman incelemesi gerekir.

## Tamamlanan teknik önlemler

- Ücretsiz Predict için bahis ve para yatırma yönlendirmeleri engellenir.
- Lisansı doğrulanmayan dış görseller istemci tarafında gizlenir.
- Dış bağlantılara `noopener noreferrer` uygulanır.
- Üyelik koşulları/KVKK kabulü zorunlu, pazarlama izni ayrı ve varsayılan kapalıdır.
- Üyelik e-posta yönlendirmesi yalnızca izin verilen üretim URL'sine döner.
- Veri kaynağı ve güncellenme bilgisinin görünür olması ürün standardıdır.

## Domain alındıktan sonra

1. Marka adı için TÜRKPATENT ve alan adı uyuşmazlık kontrolü yaptır.
2. DNS'te `mail.xyzskor.com` için Resend DKIM, SPF ve MX kayıtlarını ekle.
3. Resend alanı doğrulandıktan sonra Supabase Custom SMTP'yi test kullanıcısıyla dene.
4. `Site URL` ve redirect allow-list'i yeni HTTPS domainine taşı.
5. `legal@xyzskor.com` ve `privacy@xyzskor.com` adreslerini açıp yasal sayfalara ekle.
6. KVKK veri sorumlusu kimliği, iletişim bilgileri, saklama süreleri ve başvuru yöntemini gerçek bilgilerle tamamla.

## Yayından önce hak envanteri

- Sportmonks veri planı ve izin verilen üretim domaini kayıt altına alınmalı.
- API-Sports verileri için yeniden yayınlama/lisans kapsamı yazılı olarak doğrulanmalı.
- Her logo, sporcu fotoğrafı ve organizasyon görseli için kaynak ile kullanım dayanağı kaydedilmeli.
- YouTube/Instagram/X içeriği yalnızca resmî API veya gömme yöntemiyle gösterilmeli.
- Cito UFC ve motorsporları sağlayıcılarının ticari kullanım şartları yazılı olarak arşivlenmeli.
- Bahis, bookmaker ve affiliate bağlantıları üretimde kapalı kalmalı.

## Yayın kararı

Bu maddeler tamamlanmadan genel lansman yapılmaz. Beta etiketinin kaldırılması ayrı bir yayın kararıdır.
