# XYZSKOR API envanteri ve satın alım notu

Son güncelleme: 4 Ağustos 2026

Bu belge iki şeyi ayırır:

1. kod/repo üzerinden kesin doğrulanabilen entegrasyonlar
2. işletme sahibi tarafından dışarıda teyit edilmesi gereken satın alım ve billing kayıtları

## 1. Kesin bağlı sistemler

### 1.1 Hosting

- Sites hosting
- Aktif canlı URL: `https://xyzskor-tr.korayeris2002.chatgpt.site`
- Sites project id: `appgprj_6a6cb5dd1124819199c961895189c684`

### 1.2 Veritabanı ve auth

- Supabase
- Project ref: `swhwmqbamzczztpfxctg`
- Browser endpoint: `https://swhwmqbamzczztpfxctg.supabase.co`

### 1.3 Futbol veri sağlayıcısı

- Sportmonks
- Kodda desteklenen production env:
  - `SPORTMONKS_API_TOKEN`
  - `SPORTMONKS_TOKEN`

### 1.4 Sosyal akış

- X API
- Kodda desteklenen env:
  - `X_BEARER_TOKEN`

### 1.5 Video / yayın akışı

- YouTube Data API v3
- Kodda desteklenen env:
  - `YOUTUBE_API_KEY`

## 2. Uygulamanın gerçek API yüzeyleri

### 2.1 Worker read API

- `/api/health`
- `/api/football/live`
- `/api/football/season`
- `/api/football/club`
- `/api/football/transfers`
- `/api/social/x-media-v2`
- `/api/social/x-preseason-v1` (sunucu sınıflandırıcısı/cache sürümü: v2)
- `/api/media/youtube`

### 2.2 Supabase application layer

- Browser client bootstrap: `assets/js/data.js`
- Edge Function: `supabase/functions/football-live/index.ts`
- SQL migrations: `supabase/migrations/*.sql`

## 3. Kodda çekilebilen veri tipleri

### 3.1 Sportmonks

- canlı skor
- maç durumu ve dakika
- sezon fikstürü
- sonuçlar
- puan durumu
- takım profili
- arma / logo
- venue / stadyum
- teknik direktör
- kadro
- son mevcut ilk 11
- formation
- transferler
- transfer söylentileri

### 3.2 X API

- kulüplerin son postları
- publisher / resmî hesap akışı
- görseller
- video kapakları
- etkileşim sayıları
- hazırlık maçı içerikleri
- URL bazlı kaynak geri dönüşü

### 3.3 YouTube Data API

- canlı yayınlar
- upcoming streams
- son videolar
- thumbnail
- yayın süresi
- kanal bilgisi

## 4. Kodda destek izi olan ama ana sistem olmayan

- API-Football
  - `FOOTBALL_DATA_PROVIDER` üzerinden eski/fallback mimari desteği var
  - bugünkü ana yön Sportmonks

## 5. Seçili 5 lig

Kodda tanımlı lig seti:

- Süper Lig
- Şampiyonlar Ligi
- UEFA Avrupa Ligi
- La Liga
- Premier League

## 6. Repo üzerinden kesin kanıtlanamayan ama teyit edilmesi gereken satın alımlar

Bu başlıklar koddan tek başına ispatlanamaz. Ürün sahibi doldurmalıdır.

### 6.1 Sportmonks

Kaydedilecek alanlar:

- plan adı
- aylık / yıllık billing
- yenileme tarihi
- hangi e-posta ile açıldı
- aylık çağrı limiti

### 6.2 X developer billing

Kaydedilecek alanlar:

- developer app id
- bearer token sahibi hesap
- kredi / spend cap
- auto recharge açık mı

### 6.3 YouTube / Google Cloud

Kaydedilecek alanlar:

- project id
- billing account owner
- quota alert e-postası

### 6.4 Supabase

Kaydedilecek alanlar:

- free / pro / team
- ödeme sahibi
- yedekleme politikası
- staging var mı

### 6.5 Domain

Şu an özel domain repo içinde bağlı görünmüyor.

İlerde alınırsa kaydedilecek alanlar:

- registrar
- domain owner
- DNS owner
- yenileme tarihi
- mail yönlendirme sahibi

## 7. Sahiplik kuralı

Bu dosya operasyon ledger yerine geçmez. Gerçek token, secret, recovery code ve ödeme kartı bilgileri Git dışında tutulmalıdır.
