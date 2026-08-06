# XYZSKOR erişim ve ortam envanteri

Tarih: 2026-08-06

Bu dosya gizli değer saklamaz. Şifre, API key, bearer token, service-role key ve recovery code buraya yazılmaz. Sadece hangi servislerin kullanıldığı, hangi değişkenlerin gerektiği ve nerede yönetileceği tutulur.

## GitHub

- Repo: `korayeris/xyzskor`
- Aktif çalışma branch'i: `claude-development`
- Kullanım: kaynak kod, migration, dokümantasyon ve geliştirici ortak çalışma alanı.
- Gizli bilgi kuralı: GitHub reposuna `.env`, token, API anahtarı veya service-role key yazılmaz.

## GPT Sites / canlı yayın

- Sites project id: `.openai/hosting.json` içinde tutulur.
- Canlı URL: `https://xyzskor-tr.korayeris2002.chatgpt.site`
- Kullanım: production site yayını.
- Ortam secret'ları Sites/hosting ayarlarında tutulur; repoya yazılmaz.

## Supabase

- Project id: `supabase/config.toml` içinde `swhwmqbamzczztpfxctg`
- Kullanım:
  - Supabase Auth
  - Postgres DB
  - RLS politikaları
  - Edge Function: `supabase/functions/football-live`
- Gerekli gizli değerler:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_SECRET_KEYS`
- Kural:
  - Anon key frontend için sınırlı kullanılabilir.
  - Service-role key yalnız server/edge ortamında kalır.
  - DB migration önce staging/prod ayrımı düşünülerek uygulanır.

## Sportmonks

- Kullanım:
  - canlı skor
  - sezon fikstürü
  - puan durumu
  - kulüp/venue/coach/player ilişkileri
  - transfer endpointleri
- Gerekli gizli değerler:
  - `SPORTMONKS_API_TOKEN` veya `SPORTMONKS_TOKEN`
  - `SPORTMONKS_LEAGUE_IDS`
- Kural:
  - Token sadece Worker/Supabase Edge Function ortamında tutulur.
  - Frontend direkt Sportmonks'a çağrı atmaz.

## X / Twitter API

- Kullanım:
  - resmi kulüp akışları
  - hazırlık maçı/sosyal sinyal
  - gündem/rumor sinyali
- Gerekli gizli değer:
  - `X_BEARER_TOKEN`
- Kural:
  - Token sadece server ortamında tutulur.
  - Site kullanıcıları X API'ye direkt yük bindirmez; cache üzerinden okur.
  - Postlar birebir kaynak göstermeden sahiplenilmez; X sinyali editoryal kayıt üretmek için kullanılır.

## YouTube Data API

- Kullanım:
  - canlı yayın/video paneli
  - futbol kanalı son videoları
- Gerekli gizli değer:
  - `YOUTUBE_API_KEY`
- Kural:
  - Key sadece server ortamında tutulur.
  - Kota dostu cache kullanılmalıdır.

## Instagram Graph API

- Kullanım:
  - yalnız kendi Business hesabı ve izin verilen hashtag/medya alanları.
- Gerekli gizli değerler:
  - `INSTAGRAM_ACCESS_TOKEN`
  - `INSTAGRAM_BUSINESS_ACCOUNT_ID`
- Kısıt:
  - Başka kulüplerin Instagram gönderileri doğrudan çekilemez.

## DB temelinin durumu

- Yeni migration hazır:
  - `supabase/migrations/20260806165000_membership_data_foundation.sql`
- Henüz canlı Supabase DB'ye uygulandığı doğrulanmadı.
- Sıradaki teknik adım:
  1. Supabase CLI veya SQL Editor ile migration'ı uygula.
  2. Tabloların oluştuğunu doğrula.
  3. Auth ekranını bu RPC'lere bağla.

Not: Yukaridaki DB temelinin durumu bolumunde kalan "henuz uygulanmadi" ifadesi eski nottur; 20260806165000 temel migration'i daha once canli Supabase SQL Editor'da uygulanip dogrulanmistir.

## Uye ve admin yetkilendirme

- Migration:
  - `supabase/migrations/20260806173000_member_admin_console.sql`
- Canli Supabase durum:
  - `admin_role` tipi yoksa olusturulur.
  - `admin_memberships` yoksa olusturulur.
  - `audit_logs` yoksa olusturulur.
  - `list_member_admin_console` RPC olusturuldu ve dogrulandi.
  - `set_member_admin_role` RPC olusturuldu ve dogrulandi.
- Frontend baglanti:
  - `assets/js/data.js`: admin RPC cagri katmani.
  - `assets/js/ui.js`: hesap paneli icinde uye yetkilendirme arayuzu.
  - `assets/css/app.css`: hesap paneliyle uyumlu admin liste stili.
- Kural:
  - Uye e-postalari dogrudan frontend table select ile okunmaz; yalniz admin RPC uzerinden gelir.
  - Admin kendi admin yetkisini panelden kaldiramaz.
  - Yetki degisimleri `audit_logs` tablosuna kaydedilir.
