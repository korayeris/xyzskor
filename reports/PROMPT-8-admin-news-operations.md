# XYZSKOR — Prompt 8 Admin ve Haber Operasyonu Analizi

Tarih: 2 Ağustos 2026

> Bu belge tasarımdır. Veritabanına migration, policy veya fonksiyon uygulanmadı.

## Yapılanlar

- Mevcut admin arayüzü, istemci yazma çağrıları, Supabase migration’ları, Edge Function ve devir teslim belgesi incelendi.
- Mevcut `weekly_stories` ile önerilen haber olay modelinin çakışması değerlendirildi.
- İnceleme Kuyruğu, Haber Editörü, Kaynak Yönetimi, Futbol Verisi Yönetimi, Audit Log ve Bildirimler için güvenli operasyon akışı tasarlandı.
- Beş kişilik admin grubu ve Telegram bildirim/callback güvenliği için ayrı yetki modeli önerildi.
- Uygulanmamış, incelemeye hazır SQL taslağı `reports/PROMPT-8-review-only.sql` içinde hazırlandı.

## Mevcut Yapı ve Doğrulanabilenler

- Repodaki tek migration `live_feed_cache` tablosunu oluşturuyor; anon/authenticated erişimini tamamen kaldırıyor.
- Core tabloların gerçek `CREATE TABLE`, RLS ve policy SQL’i repoda yok.
- Devir teslim belgesi `public.is_admin()` isimli security-definer fonksiyon ve aktif RLS bulunduğunu söylüyor; bu iddia canlı katalog export’u olmadan repodan doğrulanamıyor.
- İstemci `profiles.is_admin` ile Yönetim Paneli bağlantısını koşullu oluşturuyor.
- Sonuç ve ödül yazımı istemciden `results.upsert` ve `rewards.upsert` çağrılarıyla yapılıyor; gerçek güvenlik RLS’e bağlı.
- Haberler `weekly_stories.cards` JSON dizisinde tutuluyor. Haftalık paketleme için uygun, kaynak bağımsızlığı, review geçmişi, düzeltme, idempotency ve audit için yetersiz.
- Haber ingestion/publish/Telegram Edge Function’ı yok.
- Service-role anahtarı istemci veya Git içinde bulunmadı; canlı Edge Function anahtarı yalnız ortamdan okuyor.

## Önerilen Bilgi Mimarisi

`weekly_stories` korunmalı ve haftalık editoryal vitrin görevi sürmelidir. Yeni haber operasyonunun temel kaydı olarak kullanılmamalıdır. Normalleştirilmiş yapı:

1. `editorial_items`: tek haber/gelişme ve yayın durumu.
2. `editorial_updates`: kronolojik güncelleme ve düzeltmeler.
3. `editorial_sources`: normalize kaynak kataloğu.
4. `editorial_item_sources`: haber–kaynak ilişkisi ve bağımsızlık/iddia kaydı.
5. `editorial_reviews`: editoryal karar geçmişi.
6. `publication_jobs`: zamanlı yayın ve idempotent worker kuyruğu.
7. `audit_logs`: değiştirilemez operasyon izi.
8. `notification_deliveries`: Telegram ve diğer kanallarda tek teslimat kaydı.
9. `admin_memberships`: beş kişilik aktif admin allowlist’i ve Telegram kimliği.

`news_events` adı kullanılmadı; mevcut `match_events` ile zihinsel çakışmayı azaltmak ve içeriğin yalnız “event” olmayabileceğini anlatmak için `editorial_items` seçildi.

## Durumlar ve Geçişler

Durumlar: `new`, `review_pending`, `changes_requested`, `source_pending`, `conflicting`, `approved`, `scheduled`, `published`, `rejected`.

İzinli ana akış:

`new → review_pending → approved → scheduled/published`

Yan akışlar:

- `review_pending → changes_requested → review_pending`
- `review_pending → source_pending → review_pending`
- `review_pending → conflicting`
- `review_pending/changes_requested/source_pending/conflicting → rejected`

`published` kaydı sessizce draft’a çevrilmemeli. Düzeltme yeni `editorial_updates` satırı ve audit kaydıyla yapılmalı.

## Tablo Tasarımı

| Tablo | Ana alanlar | Kritik indeks/unique | Public erişim | Admin erişimi |
| --- | --- | --- | --- | --- |
| `editorial_items` | id, slug, title, spot, body, category, confidence, status, related ids, timestamps, author/editor | unique slug; status+publish time; related match/team/player | yalnız zamanı gelmiş `published` | aktif editorial admin |
| `editorial_updates` | item_id, body, correction flag, public flag, created_at | item_id+created_at | parent published + public | aktif editorial admin |
| `editorial_sources` | canonical_name, canonical_url, source_type, active | normalized domain unique | yalnız aktif kaynakların yayın alanları | source manager/admin |
| `editorial_item_sources` | item_id, source_id, source_url, claim, first_seen_at, independent_group | item+source+URL unique | parent published | aktif editorial admin |
| `editorial_reviews` | item_id, reviewer, decision, note, created_at | item+created_at | yok | reviewer/admin |
| `publication_jobs` | item_id, run_at, status, idempotency_key, attempts | idempotency unique; due-job partial index | yok | server worker; admin read |
| `audit_logs` | actor, action, entity, before/after, request id, created_at | entity+id+time; request id | yok | admin read; server insert |
| `notification_deliveries` | channel, event key, recipient, status, provider id, attempts | channel+event+recipient unique | yok | server; admin read |
| `admin_memberships` | auth uid, role, active, telegram user id | auth uid unique; Telegram id unique | yok | owner/security admin |

## RLS ve Yetki Tasarımı

- Public yalnız `published_at <= now()` olan `published` haberleri ve bunların public update/kaynak ilişkilerini okuyabilir.
- Draft, review, job, audit, notification ve admin üyelik tabloları anon/authenticated public sorgusuna kapalıdır.
- `profiles.is_admin` uzun vadede yetki kaynağı olmamalı; `admin_memberships` allowlist’i security-definer helper üzerinden kullanılmalı.
- Admin rolü tek tip olmamalı: `owner`, `editor`, `reviewer`, `source_manager`, `football_data`.
- Yayınlama doğrudan istemci update’i yerine server-side RPC/Edge Function üzerinden, geçiş doğrulaması ve audit ile yapılmalı.
- Service role yalnız Edge Function secret ortamında kalmalı.
- İlk uygulamadan önce canlı veritabanından `pg_dump --schema-only`, policy/function export’u ve Supabase advisor çıktısı alınmalı.

## Admin Alanları

- İnceleme Kuyruğu: durum, güven seviyesi, kaynak sayısı, uyuşmazlık ve SLA filtresi.
- Haber Editörü: mevcut kaydı düzenler; yayınlama geçişini tek başına bypass edemez.
- Kaynak Yönetimi: domain normalizasyonu, kaynak türü, aktiflik ve bağımsız grup.
- Futbol Verisi Yönetimi: mevcut maç/veri tabloları; haber editöründen ayrı rol.
- Audit Log: filtrelenebilir, salt okunur; silme/güncelleme yok.
- Bildirimler: delivery durumu, retry, provider mesaj id’si; secret veya tam token göstermez.

## Telegram ve Beş Kişilik Grup

- Yalnız `admin_memberships.active=true` ve eşleşen sayısal `telegram_user_id` kabul edilir.
- Webhook isteğinde Telegram `X-Telegram-Bot-Api-Secret-Token` başlığı sabit zamanlı karşılaştırmayla doğrulanır.
- Her `update_id` ve `callback_query.id` unique kaydedilir; tekrar gelen istek aynı sonucu döndürür.
- Yayın komutu `publication_jobs.idempotency_key` ve haber durum kilidiyle çift yayını engeller.
- Hatırlatma için `notification_deliveries(channel,event_key,recipient)` unique kuralı tek teslimatı garanti eder.
- Callback payload kısa opaque token taşır; haber kimliği/eylem sunucu kayıtlarından çözülür, kullanıcı girdisine güvenilmez.
- Kullanıcı ve bot için ayrı rate limit uygulanır; başarısız denemeler audit’e yazılır.
- Bot token, webhook secret ve service role yalnız Edge Function secret store’da tutulur; loglanmaz.

## Rollback

1. Yeni ingestion ve publish worker’ı kapatılır.
2. Frontend mevcut `weekly_stories` okumaya devam eder; yeni modele zorunlu bağımlılık kurulmaz.
3. Yeni tablolara yazma kesilir ve export alınır.
4. Policy/helper fonksiyonlar yalnız dependency kontrolünden sonra kaldırılır.
5. `weekly_stories` alanları veya mevcut RLS hiçbir aşamada otomatik silinmez.

## Değiştirilen Dosyalar

- `reports/PROMPT-8-admin-news-operations.md`
- `reports/PROMPT-8-review-only.sql`

## Korunan Sistemler

- Mevcut Supabase şeması ve RLS
- Auth ve admin davranışı
- `weekly_stories` yayın akışı
- Sonuç, ödül, tahmin ve puanlama
- Canlı veri Edge Function’ı

## Eklenen Fonksiyonlar

- Çalışan uygulamaya fonksiyon eklenmedi.
- SQL taslağındaki helper/trigger isimleri yalnız inceleme önerisidir.

## Veri ve API Değişiklikleri

- Uygulanan değişiklik yok.
- Canlı Supabase veya Telegram API çağrısı yapılmadı.

## Çalıştırılan Testler

- Repo dosya ve migration envanteri
- Core tablo/policy SQL araması
- Service-role ve Telegram entegrasyonu araması
- Mevcut admin yazma çağrılarının statik incelemesi

## Test Sonuçları

- Core şema/RLS migration’ları: repoda bulunamadı.
- Telegram entegrasyonu: bulunamadı.
- Audit log ve yayın kuyruğu: bulunamadı.
- Service-role anahtarı istemci/Git içinde: bulunmadı.
- Mevcut tek migration RLS’i etkinleştiriyor ve client rollerini revoke ediyor.

## Görsel Kontroller

- Bu aşama teknik tasarımdır; ürün arayüzü değiştirilmedi.

## Mobil Kontroller

- Bu aşama teknik tasarımdır; yeni mobil arayüz eklenmedi.

## Gerçek Veriye Bağlı Olmayan Alanlar

- Beş adminin gerçek auth UID ve Telegram ID değerleri alınmadı; örnek kimlik üretilmedi.
- Gerçek haber botu, webhook URL’si ve secret değerleri bulunmuyor.

## Devam Eden Riskler

1. Canlı katalog/policy export’u olmadan yeni SQL’in isim ve constraint çakışmaları doğrulanamaz.
2. `profiles.is_admin` istemci görünürlüğü için kullanılıyor; yetki kaynağının canlı policy davranışı ayrıca denetlenmeli.
3. JSON haber kartlarından normalize modele geçiş veri kaybı ve çift yayın riski taşır; shadow-write/backfill gerekir.
4. Telegram callback ve yayın işlemleri service-role kullandığı için ayrı tehdit modeli ve staging testi gerektirir.

## Sonraki Mantıklı Adım

Prompt 9 kapsamında önce yükleme/render ölçümleri alınmalı; yalnız davranış güvenli ve ölçülebilir performans iyileştirmeleri uygulanmalı. SQL taslağı canlı şema export’u alınmadan çalıştırılmamalı.
