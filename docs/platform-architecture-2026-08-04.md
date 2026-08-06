# XYZSKOR Platform Architecture

**Tarih:** 4 Ağustos 2026  
**Durum:** Uygulanabilir hedef mimari  
**Amaç:** Bu belge, XYZSKOR’un profesyonel ekibe devredilebilir web, backend, veri, auth ve mobil mimarisini tek yerde sabitler.

## 1. Bugünkü gerçek durum

Sistem bugün üç parçalı bir yapıdadır:

1. Statik web istemcisi
   - `index.html`
   - `assets/js/*`
   - `assets/css/app.css`
2. Edge veri katmanı
   - `worker/index.js`
3. Supabase uygulama katmanı
   - Auth
   - Postgres
   - RLS
   - Edge Functions
   - Migrations

Bu yapı çalışır, fakat tek kanonik backend sınırı henüz tam net değildir. Aynı futbol domaini hem Worker içinde hem Supabase Edge Function içinde işlenmektedir. Üretimde bu ikili sahiplik uzun vadede sadeleştirilmelidir.

## 2. Hedef mimari

Önerilen üretim mimarisi:

```text
Web / Mobile clients
        │
        ▼
Cloudflare edge entry
  - static delivery
  - WAF / bot filtering
  - rate limiting
        │
        ▼
Canonical BFF / API layer
  - competition feed
  - live score
  - standings
  - clubs / players / transfers
  - social ingest outputs
  - predict writes
        │
        ├─► Sportmonks
        ├─► X API
        ├─► YouTube Data API
        └─► future: Instagram-approved ingestion / editorial CMS
        │
        ▼
Supabase
  - Auth
  - Postgres
  - RLS
  - object storage
  - scheduled jobs
  - leaderboards / prediction state
```

## 3. Kanonik backend kararı

Teknik tavsiye:

- Cloudflare Worker = dış dünyaya açılan kanonik read API/BFF
- Supabase = auth, kullanıcı verisi, tahmin yazma, leaderboard, admin, audit system of record

Sebep:

- Worker dış API cache ve normalization için daha uygun
- Supabase kullanıcı ve transaction domaini için daha uygun
- Mobil uygulama da aynı BFF sözleşmesini kullanabilir
- Sağlayıcı anahtarları istemciden tamamen ayrılır

## 4. Futbol veri domainleri

Sportmonks planınızdan çekilecek ana alanlar:

- lig / sezon listesi
- fikstür
- canlı skor
- maç durumu
- olaylar: gol, kart, değişiklik, penaltı
- puan durumu
- iç saha / dış saha formu
- takım profili
- arma / logo
- kadro listesi
- oyuncu profili
- sezon istatistikleri
- teknik direktör
- hakem
- stadyum / venue
- onaylı ilk 11
- diziliş
- oyuncu bazlı maç verisi
- sakatlık / ceza
- gol krallığı
- haftanın takımı

Bu alanların hiçbiri doğrudan tarayıcıdan Sportmonks’a bağlanmamalıdır.

## 5. Sosyal veri katmanı

Sosyal akış için hedef yapı:

- X API:
  - kulüp hesapları
  - lig/organizasyon hesapları
  - hazırlık maçı akışı
  - görsel/video medya varyantları
- YouTube Data API:
  - canlı yayınlar
  - upcoming streams
  - son programlar
- Instagram:
  - yalnız Meta’nın izin verdiği, yasal ve erişilebilir API akışları
  - scraping tabanlı çözüm önerilmez

Sosyal veriler ikiye ayrılmalı:

1. ham sağlayıcı kayıtları
2. yayınlanabilir normalize kartlar

Bu sayede frontend her platform için farklı format çözmez.

## 6. Veritabanı hedefi

Şu anki migration seti iyi bir çekirdek kuruyor. Büyük hacim için aşağıdaki ayrımlar netleştirilmeli:

### 6.1 Çekirdek tablolar

- `profiles`
- `matches`
- `match_events`
- `match_lineups`
- `match_absences`
- `league_standings`
- `predictions`
- `results`
- `rewards`
- `model_predictions`

### 6.2 Editoryal tablolar

- `editorial_items`
- `editorial_sources`
- `editorial_updates`
- `editorial_reviews`
- `publication_jobs`

### 6.3 Yeni önerilen alanlar

- `social_posts`
- `social_post_media`
- `social_accounts`
- `competition_snapshots`
- `player_season_snapshots`
- `club_season_snapshots`
- `reward_claims`
- `device_fingerprints`
- `fraud_signals`
- `push_subscriptions`

## 7. Yüksek hacim için DB kuralları

- prediction writes ile read-heavy public football queries ayrılmalı
- leaderboard sonuçları her istekte tam hesaplanmamalı; materialized veya precomputed yapı kullanılmalı
- canlı skor event akışı append-first mantıkla tutulmalı
- public read endpoint’leri cache-first çalışmalı
- kullanıcıya açık listeleme sorgularında dar index stratejisi zorunlu
- RLS kuralları auth domaininde kalmalı; toplu public read’lerde gereksiz ağır sorgu oluşturmamalı

## 8. Auth ve üyelik sistemi

Önerilen üyelik omurgası:

- Supabase Auth
  - email/password
  - magic link opsiyonel
  - OAuth sonradan eklenebilir
- profil tamamlama
  - username
  - takım tercihi
  - ülke
  - pazarlama izinleri
- zorunlu güvenlik katmanları
  - email doğrulama
  - rate limits
  - brute-force koruması
  - audit log

### 8.1 MFA

Evet, ikinci adım doğrulama eklenebilir ve eklenmelidir:

- TOTP tabanlı MFA
- kritik aksiyonlarda re-auth
- ödül talebinde step-up auth

### 8.2 Bot ve çoklu hesap engeli

Ödül sistemi için tek auth yetmez. Gerekli katman:

- email verification
- device fingerprint
- IP / ASN anomaly scoring
- rate limiting
- behavior scoring
- reward claim öncesi step-up verification
- açık kural motoru
- manuel admin review kuyruğu

## 9. Predict sistemi

Predict domaini üç parçaya ayrılmalı:

1. fixture eligibility
   - maç yayınlandı mı
   - lock time geçti mi
2. prediction write
   - kullanıcı tahmini
   - idempotent upsert
3. scoring / settlement
   - yalnız resmî sonuç sonrası
   - sunucu tarafında

Frontend yalnız form deneyimini yönetmeli; sonuçlandırma ve puan dağıtımı backend işi olmalıdır.

## 10. Mobil uygulama mimarisi

Mobil için web ile uyumlu ama birebir aynı olmayan mimari öneri:

- React Native + Expo
- aynı BFF endpoint’leri
- Supabase Auth native client
- push notifications
- remote config
- deep link support

### 10.1 Mobil ekran omurgası

- Home
- Match Center
- Predict
- Standings
- Transfers
- Clubs
- Account
- Notifications

### 10.2 Ortak tasarım sistemi

Web ve mobil ortak token seti kullanılmalı:

- colors
- spacing
- radius
- shadow
- typography
- state colors
- competition themes

Bu token seti ayrı bir `design-tokens` JSON kaynağında tutulursa hem web hem mobil aynı görsel dili kullanır.

## 11. Domain ve altyapı satın alma sırası

Önerilen satın alma sırası:

1. domain
2. e-posta altyapısı
3. Sportmonks planı
4. X API kredisi
5. error monitoring
6. analytics / product telemetry

### 11.1 Domain

En doğru yaklaşım:

- ana domain: `xyzskor.com` benzeri kısa ve marka uyumlu alan adı
- üretim: `www`
- uygulama: `app`
- API/BFF: `api`

Örnek:

- `xyzskor.com`
- `www.xyzskor.com`
- `app.xyzskor.com`
- `api.xyzskor.com`

### 11.2 Mail

Kurumsal başlangıç için:

- Google Workspace veya Microsoft 365
- en az:
  - `hello@`
  - `support@`
  - `legal@`
  - `partnerships@`

## 12. Satın alınacak servisler

Üretim hedefi için servis listesi:

- Sportmonks
- X API credits
- YouTube Data API project
- Supabase Pro
- Cloudflare domain + DNS + WAF
- error monitoring: Sentry
- product analytics: PostHog

## 13. Profesyonel devir standardı

Bu repo profesyonel ekibe devredilmeden önce aşağıdakiler tamamlanmalı:

- tek kanonik backend boundary kararı
- public read API sözleşmesi dokümante edilmiş olması
- auth flow diyagramı
- reward / fraud kuralları
- migration sırası
- env var envanteri
- satın alınmış servis listesi
- staging / production ayrımı
- deploy playbook
- rollback playbook

## 14. Bu gece için öncelik sırası

1. frontend üretim dışı placeholder temizliği
2. kanonik mimari dokümantasyonu
3. broadcast / social / editorial boş durumlarının profesyonelleştirilmesi
4. football data surface’lerinin lig bazında ortak sözleşmeye oturtulması
5. auth + reward security backlog’unun yazılı hale getirilmesi
6. mobil uygulama için ortak token ve endpoint taslağı

## 15. Nihai teknik karar

XYZSKOR için doğru yön:

- data-heavy, edge-cached, API-first product
- frontend’te sert fallback yerine yayın kalitesi yüksek degrade davranışı
- auth ve predict tarafında Supabase
- read-heavy football ve social aggregation tarafında edge BFF
- web ve mobile arasında ortak backend sözleşmesi

Bu yapı korunursa site yalnız demo kalmaz; profesyonel ekip geldiğinde doğrudan genişletilebilir bir ürün omurgasına dönüşür.
