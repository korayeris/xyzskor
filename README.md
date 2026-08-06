# XYZSkor

## Son surum: uye ve admin yetkilendirme

Hesap paneline site tasarimiyla uyumlu admin konsolu eklendi. Admin kullanici sag ustteki hesap panelinden kayitli uyeleri arayabilir, uye e-postasi/kullanici adi/takim bilgisini gorebilir, tahmin/haftalik oyun/odul talebi sayilarini kontrol edebilir, admin yetkisi verebilir veya kaldirabilir ve editoryal rol atayabilir.

Bu arayuz dogrudan tablo okumaz. Frontend `assets/js/data.js` uzerinden Supabase RPC cagirir:

- `list_member_admin_console`
- `set_member_admin_role`

Canli Supabase DB'ye uygulanan migration:

- `supabase/migrations/20260806173000_member_admin_console.sql`

Guvenlik notlari:

- Uye e-postalari sadece admin RPC uzerinden doner.
- Admin kendi admin yetkisini panelden kaldiramaz.
- Yetki degisimleri `audit_logs` tablosuna yazilir.
- Secret, service-role key, bearer token veya sifre README'ye ve repoya yazilmaz.

Süper Lig için matematiksel performans ve veri analiz platformu. Uygulama modüler vanilla JavaScript/CSS, Supabase ve Cloudflare uyumlu production build ile çalışır.

Mythos Cards yalnızca ödül sponsorudur. XYZSKOR üzerinde ürün satışı, sepet veya ödeme akışı bulunmaz; sponsor ürünleri yarışma kazananlarına ücretsiz hediye edilir.

## Ürün mimarisi

Ana navigasyonda yalnızca iki ürün alanı bulunur:

- **Futbol:** maçlar, canlı veri, fikstür, puan durumu ve editoryal içerik.
- **Predict:** ücretsiz tahmin yarışması, liderlik ve ödüller.

Profil, bildirimler, ayarlar, çıkış ve yetkili kullanıcılar için yönetim erişimi sağ üstteki hesap panelinden açılır.

## Yerel çalıştırma

PowerShell üzerinden:

```powershell
npm run dev
```

`npm` PATH üzerinde değilse doğrudan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Ardından `http://127.0.0.1:4173` adresini açın.

## Başka bilgisayara taşıma

Temiz proje ZIP'ini yeni bilgisayarda klasöre çıkarın. Klasör içinde PowerShell açıp şu komutu çalıştırın:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Başlatıcı PATH üzerindeki Python 3'ü, Windows `py` başlatıcısını veya o kullanıcıya ait Codex Python çalışma ortamını otomatik bulur. Hiçbiri kurulu değilse Python 3 kurulmalıdır. Ardından tarayıcıda `http://127.0.0.1:4173` adresini açın.

## Kontrol

```powershell
npm run check
npm run build
```

## Dosyalar

- `index.html`: Erişilebilir HTML kabuğu
- `assets/css/app.css`: Görsel sistem ve responsive düzen
- `assets/js/data.js`: Supabase, auth, tahmin ve liderlik veri katmanı
- `assets/js/live.js`: Hafta, canlı skor ve navigasyon akışı
- `assets/js/match-center.js`: Maç detay ürünü
- `assets/js/ui.js`: Arayüz render zinciri ve başlangıç
- `worker/index.js`: Statik yayın, güvenlik başlıkları ve 24 saat önbellekli X API katmanı
- `docs/XYZSKOR-devir-teslim.md`: Mimari ve operasyon notları
- `docs/professional-handoff-2026-08-03.md`: Profesyonel yazılımcıya teknik devir, satın alım/env/envanter ve mimari gerçeklik özeti
- `docs/api-envanteri-ve-satin-alim-notu-2026-08-04.md`: Aktif API yüzeyleri, çekilebilen veri tipleri ve satın alım teyit listesi
- `docs/ops-secrets-ledger-template.md`: Secret, billing, owner ve recovery kayıt şablonu
- `docs/advanced-upgrade-roadmap-2026-08-04.md`: Prototipten profesyonel seviyeye geçiş sırası
- `docs/data-provider-architecture.md`: Değiştirilebilir API-Football/Sportmonks katmanı ve veri sınıflandırma sözleşmesi
- `docs/provider-comparison-scorecard.csv`: 2–3 haftalık sağlayıcı karşılaştırma kayıt şablonu
- `docs/supabase-migration-runbook.md`: Yedek, staging, migration ve yük testi yayın akışı
- `supabase/functions/football-live/index.ts`: Canlı skor sağlayıcı adaptörü
- `supabase/migrations/20260731_live_feed_cache.sql`: Canlı API kotasını koruyan sunucu önbelleği
- `supabase/migrations/20260802180000_platform_core.sql`: Yeniden kurulabilir çekirdek şema, RLS ve tahmin kilidi
- `supabase/migrations/20260802181000_server_leaderboard.sql`: Sunucu tarafı puanlama/liderlik RPC'si
- `supabase/migrations/20260802182000_editorial_operations.sql`: Haber operasyonu, kaynak, inceleme ve audit şeması
- `worker/.dev.vars.example`: Worker tarafı secret değişken adları
- `scripts/dev.ps1`: Yerel geliştirme sunucusu
- `scripts/check.mjs`: Ürün, güvenlik ve mimari regresyon kontrolleri
- `scripts/load-test-predictions.mjs`: Yalnız staging için tahmin yazma yük testi

Supabase service-role ve spor veri sağlayıcısı anahtarları istemciye veya repoya eklenmemelidir. API-Football/Sportmonks çağrıları yalnızca sunucu tarafındaki Supabase Edge Function üzerinden yapılır. Sağlayıcı, `FOOTBALL_DATA_PROVIDER` secret'ıyla değiştirilir; ön yüz kodu değişmez.

Resmî kulüp paylaşımları için Sites production ortamında `X_BEARER_TOKEN` secret'ı tanımlanır. Token hiçbir zaman istemci JavaScript'ine, `.openai/hosting.json` dosyasına veya Git deposuna yazılmaz. X akışı maliyet kontrollü günlük modda çalışır: lig başına en fazla 5 kulüp ve 2 kaynak hesabı, hazırlık akışında en fazla 4 kulüp taranır; başarılı yanıtlar ve kredi yetersizliği durumları 24 saat cache'lenir. Gönderilere bağlı fotoğraflar ya da video kapakları X'in resmî medya expansion alanlarından alınır. Bu profil paylaşım metnini, medyasını, tarihini, etkileşim sayılarını ve X bağlantısını sunar; X tarafındaki harcama limiti geliştirici panelinden ayrıca düşük tutulmalıdır.
## Canlı veri sözleşmesi

Sportmonks bağlantısı sunucu tarafında tutulur. `SPORTMONKS_API_TOKEN` tanımlandığında seçili ligler için canlı skor, sezon fikstürü, sonuçlar ve puan durumu Worker/Supabase adaptörleri üzerinden alınır. `/api/football/live`, `/api/football/season`, `/api/football/club` ve `/api/football/transfers` route'ları gerçek sağlayıcı yanıtını normalize eder. Anahtar yoksa `sportmonks_not_configured` döner; arayüz tahmini veya sahte kayıt üretmez. YouTube için `YOUTUBE_API_KEY`, resmî X akışı için `X_BEARER_TOKEN` gerekir.
