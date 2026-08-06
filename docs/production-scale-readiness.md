# XYZSKOR üretim ve ölçek hazırlığı

Bu belge, trafiğin büyümesi sırasında hangi katmanın ne zaman güçlendirileceğini tanımlar.

## Şu anda uygulanan temel

- Statik dosyalar CDN üzerinde uzun süreli ve değişmez önbellekle sunulur.
- X akışı 24 saat önbellekte tutulur; sağlayıcı kesintisinde son doğrulanmış veri yedi güne kadar gösterilebilir.
- Aynı çalışma örneğine eşzamanlı gelen X yenilemeleri tek sağlayıcı isteğinde birleştirilir.
- Dış sağlayıcı isteği sekiz saniyede zaman aşımına uğrar.
- `/api/health` üretim sağlık kontrolü secret değerlerini göstermeden servis durumunu bildirir.
- GitHub üzerindeki her değişiklik ürün kontrollerinden ve production build işleminden geçer.

## Genel yayından önce

1. Supabase Pro veya eşdeğer kapasiteye geçiş, günlük yedek ve geri yükleme tatbikatı.
2. Cloudflare/Sites tarafında WAF, bot koruması ve uç nokta bazlı hız sınırı.
3. Hata izleme, yapılandırılmış log, çalışma süresi alarmı ve X/Sportmonks bütçe alarmı.
4. Tahmin yazma, liderlik okuma ve canlı skor için ayrı yük testleri.
5. KVKK envanteri, saklama süreleri, kullanıcı veri silme ve hesap dışa aktarma akışları.

## Trafik eşikleri

- **10 bin aylık aktif kullanıcı:** gerçek kullanım ölçümü, hata alarmı, Supabase kapasite takibi.
- **50 bin aylık aktif kullanıcı:** yazma işlemlerinde kuyruk, liderlik tablolarında önceden hesaplama, salt-okunur CDN yanıtları.
- **100 bin+ aylık aktif kullanıcı:** çok bölgeli gözlemleme, kurumsal spor veri SLA'sı, felaket kurtarma ve bağımsız güvenlik testi.

## Değişmez kurallar

- API anahtarları GitHub'a veya istemci JavaScript'ine yazılmaz.
- Tahmin kilidi ve puan hesaplama yalnız sunucu/veritabanı tarafında uygulanır.
- Sağlayıcı verisi kaynak, güncellik ve doğrulama seviyesiyle birlikte tutulur.
- Büyük trafik duyurusu yapılmadan önce staging ortamında hedef yükün en az iki katı test edilir.
