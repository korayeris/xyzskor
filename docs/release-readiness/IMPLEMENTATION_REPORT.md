# Uygulama raporu

## Eklenen ürün yüzeyi

- Sezon gol, asist, sarı kart ve kırmızı kart liderleri.
- XYZSkor Performans Puanı v1, puan breakdown’ı, haftanın yıldızı.
- Pozisyonu doğrulanmış oyunculardan 4-3-3; mümkün değilse 4-4-2 veya 3-4-3 haftanın takımı.
- Tek-lig genel bakışında görünürlüğe bağlı lazy yükleme; root, Predict ve diğer branşlarda sıfır yeni istek.

## Sunucu

- `GET /api/football/leaders?league=<slug>`
- `GET /api/football/weekly-awards?league=<slug>`
- 45 dakikalık lider cache’i, 6 saatlik haftalık ödül cache’i; same-isolate single-flight ve mevcut Supabase `sync_locks`/`live_feed_cache` katmanı.
- Provider hatası doğrulanmış boş sonuca çevrilmez; son doğrulanmış payload stale olarak korunabilir.

## Güvenli geri dönüş

`football_leaders_enabled`, `xyz_performance_score_enabled`, `weekly_star_enabled`, `team_of_week_enabled` değişkenlerinden biri kapatılarak ilgili uç 404 `feature_disabled` verir. Mevcut season/live mimarisi etkilenmez.

## İkinci denetimde düzeltilenler

- Aynı oyuncunun aynı liderlik metriği tekrarlanırsa en yüksek doğrulanmış toplam korunur; eksik player/participant ilişkisi endpointi bozmaz.
- İkinci sarı ihraç kaydı yellow/second-yellow/red biçimlerinde tekrarlanırsa ceza bir kez uygulanır.
- Aynı turda scheduled, postponed, cancelled veya abandoned maç bulunuyorsa tur `published` olmaz; eksik pozisyon havuzundan oyuncu veya diziliş uydurulmaz.
- Loading, fresh, stale, degraded, verified-empty ve error durumları istemci sözleşmesinde ayrılmıştır.
- Üç diziliş, skor bileşenleri, determinism ve feature flag açık/kapalı karşı testleri eklendi.

## Final öncesi genel sistem temizliği

- Sportmonks 500 hatasının yanlışlıkla `plan_restricted` 403 olarak sınıflandırılması düzeltildi; gerçek upstream arızası artık 502 ve doğru makine koduyla dönüyor.
- Public API hata gövdelerinden sağlayıcı mesajı, dahili hata metni ve token yankısı kaldırıldı. Kısmi hata dizileri yalnız düşük kardinaliteli genel kod taşır.
- README'deki kanıtsız “gerçek in-play production doğrulaması” ifadesi gerçek kanıt kapsamına çekildi; otomatik coverage isteği anlatımı güncel demand-scope mimarisiyle eşlendi.
- Emekli Kayak ve saha sporları için erişilemez renderer/CSS dalları ile iki kullanılmayan görsel kaldırıldı. Aktif basketbol, voleybol ve UFC yolları mobil browser smoke ile yeniden doğrulandı.
- Root ve Worker örnek ortam dosyaları gerçek provider değişkenleriyle eşitlendi; eksik API-Sports, Cito, OCBlacktop ve haftalık özellik anahtarları belgelendi. Statik kontrol, örnek ortam sözleşmesinin tekrar kaymasını engelliyor.
