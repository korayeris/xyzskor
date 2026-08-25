# Hukuki hazırlık

`npm run check:legal` yayın kapısıdır. Mevcut metinlerde şirket, adres, e-posta, saklama ve sağlayıcı alanlarının gerçek işletme bilgileriyle hukuk uzmanı tarafından onaylanması gerekir.

Kaynak envanteri:

- Sportmonks: fikstür, skor, liderlik, kadro, oyuncu/takım meta verisi ve sağlayıcı görsel URL’leri.
- XYZSkor: Performans Puanı v1, haftanın yıldızı ve haftanın takımı seçimi.
- Takım/oyuncu görselleri için yeniden dağıtım ve cache hakkı sağlayıcı sözleşmesinden ayrıca doğrulanmalıdır.

Uzman onayı olmadan hukuki placeholder’lar doldurulmamıştır; bu nedenle legal gate kırmızıysa production release bloklanır.
