# XYZSKOR koddan devam haritası

Bu belge projeyi VS Code içinde açtığınızda ilk bakılacak kısa teknik haritadır. API anahtarlarının değerleri kaynak koda yazılmaz; yalnızca ortam değişkenlerinin adları burada gösterilir.

## Ana akış

```text
Tarayıcı (index.html + assets/js)
  ├─ /api/football/* ──> worker/index.js ──> Sportmonks
  ├─ /api/social/*   ──> worker/index.js ──> X API v2
  ├─ /api/media/*    ──> worker/index.js ──> YouTube Data API
  └─ Supabase istemcisi ────────────────> Auth, tahmin, liderlik, editoryal kayıtlar
```

Tarayıcı hiçbir sağlayıcı tokenını görmez. Sportmonks, X ve YouTube çağrıları yalnızca `worker/index.js` içinden yapılır.

## İlk açılacak dosyalar

| Dosya | Görevi |
| --- | --- |
| `index.html` | Sayfa kabuğu, ekran bölümleri ve erişilebilirlik yapısı |
| `assets/js/ui.js` | Lig ekranları, transfer kartları, X gönderileri ve render zinciri |
| `assets/js/live.js` | Canlı maç sorgusu, lig seçimi ve istemci tarafı canlı veri akışı |
| `assets/js/data.js` | Supabase, oturum, tahmin ve veri yükleme katmanı |
| `assets/js/match-center.js` | Maç detay ekranı |
| `assets/css/app.css` | Tüm portal ve responsive görünüm |
| `worker/index.js` | Sunucu API rotaları, Sportmonks/X adaptörleri, cache ve güvenlik başlıkları |
| `supabase/functions/football-live/index.ts` | Eski/ikincil canlı veri adaptörü |

## Aktif API rotaları

| Rota | Kaynak | Amaç |
| --- | --- | --- |
| `/api/football/live?league=...` | Sportmonks | Canlı maçlar ve olaylar |
| `/api/football/season?league=...` | Sportmonks | Fikstür, sonuç ve puan durumu |
| `/api/football/club?league=...&team=...` | Sportmonks | Kulüp, kadro, teknik direktör ve stat |
| `/api/football/transfers?league=...` | Sportmonks | Transfer kayıtları; paket yetkisine bağlı |
| `/api/social/x-media-v2?league=...` | X API v2 | Lig kulüpleri ve o lige özel transfer kaynakları |
| `/api/social/x-preseason-v1?league=...` | X API v2 | Resmî hesaplardan hazırlık maçı/sonuç taraması; sunucu cache/sınıflandırıcı sürümü v2 |
| `/api/media/youtube` | YouTube | Yayın masası video akışı |
| `/api/health` | Worker | Sağlayıcıların yapılandırma durumu |

Desteklenen lig anahtarları: `super-lig`, `premier-league`, `la-liga`, `bundesliga`, `serie-a`. Sağlayıcı ID sırası `600,8,564,82,384` olarak sabittir. Her istek kendi lig listesini kullanır; başka ligden Süper Lig verisiyle doldurma yapılmaz.

## X bağlantılarının yeri

- Kulüp ve transfer kaynağı hesapları: `worker/index.js` içindeki `X_CLUBS_BY_LEAGUE` ve `X_PUBLISHERS_BY_LEAGUE`.
- Transfer kartları: `assets/js/ui.js` içindeki `renderTransferSignals`.
- Hazırlık maçı seçimi: `worker/index.js` içindeki `findBestPreseasonPost`.
- Hazırlık kartları: `assets/js/ui.js` içindeki `preseasonCardHTML` ve `loadPreseasonPosts`.

Hazırlık akışı son 50 resmî gönderiyi tarar. Önce hazırlık/friendly bağlamını doğrular, sonra skorlu ve “maç sonucu / full-time” ifadeli kaydı öne alır. Genel `matchday` ve `play-off` duyuruları hazırlık maçı sayılmaz.

## Ortam değişkenleri

| Ad | Kullanıldığı yer |
| --- | --- |
| `SPORTMONKS_API_TOKEN` | Sportmonks sunucu çağrıları |
| `X_BEARER_TOKEN` | X API v2 sunucu çağrıları |
| `YOUTUBE_API_KEY` | YouTube sunucu çağrıları |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | İstemci erişimi |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnız güvenli sunucu görevleri |

Token değerlerini `.js`, `.md`, `.openai/hosting.json` veya Git geçmişine eklemeyin.

## Geliştirme döngüsü

1. VS Code görevlerinden **XYZSKOR: Önizlemeyi Başlat** görevini çalıştırın.
2. `http://127.0.0.1:4173` adresinden önizleyin.
3. Değişiklikten sonra **XYZSKOR: Kontroller** ve **XYZSKOR: Production Build** görevlerini çalıştırın.
4. `dist/` üretilen çıktıdır; kaynak düzenlemeyi `index.html`, `assets/`, `worker/` ve `supabase/` içinde yapın.
