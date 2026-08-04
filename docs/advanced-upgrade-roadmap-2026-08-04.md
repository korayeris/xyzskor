# XYZSKOR ileri seviye geçiş yol haritası

Son güncelleme: 4 Ağustos 2026

Bu belge “iyi prototip” seviyesinden “profesyonel ürün altyapısı” seviyesine geçiş için uygulanacak sırayı sabitler.

## Faz 1 — tek backend otoritesi

Hedef:

- frontend hangi veriyi nereden aldığını tartışmasız bilecek
- read path tek otoriteye oturacak

Yapılacaklar:

1. Worker read API kanonik yüzey olarak sabitlenir
2. Supabase kullanıcı, tahmin, leaderboard ve admin state için system of record olarak kalır
3. her `/api/football/*` yanıtına standart metadata eklenir:
   - `source`
   - `updatedAt`
   - `stale`
   - `competition`
   - `provider`
4. static fallback veri dosyaları editoryal/demo etiketiyle ayrıştırılır

Çıkış kriteri:

- aynı domain için iki farklı backend akışı kalmaz

## Faz 2 — production secrets ve billing hijyeni

Hedef:

- kim hangi servisi ödüyor ve hangi token nerede kullanılıyor netleşir

Yapılacaklar:

1. `docs/api-envanteri-ve-satin-alim-notu-2026-08-04.md` sahibi tarafından doldurulur
2. `docs/ops-secrets-ledger-template.md` Git dışında gerçek verilerle tutulur
3. aşağıdaki servisler için owner kaydı tamamlanır:
   - Supabase
   - Sportmonks
   - X
   - YouTube / Google Cloud
   - Domain registrar
4. token rotation takvimi oluşturulur

Çıkış kriteri:

- hiçbir kritik servis “tek kişinin hafızasında” kalmaz

## Faz 3 — kullanıcı ve güvenlik

Hedef:

- predict sistemi abuse edilemesin

Yapılacaklar:

1. email + OAuth auth akışı
2. MFA / 2FA
3. Turnstile veya eşdeğer bot koruması
4. IP / device / velocity rate limiting
5. ödül kazananlar için fraud kontrol akışı
6. RLS audit gözden geçirmesi

Çıkış kriteri:

- bot hesapla ödül toplama riski ciddi biçimde düşer

## Faz 4 — veri derinliği eşitleme

Hedef:

- yalnız Süper Lig değil, seçili tüm ligler aynı derinlikte görünür

Yapılacaklar:

1. standings
2. clubs
3. players
4. transfers
5. rumours
6. official social feed
7. preseason feed
8. season honors

Çıkış kriteri:

- her lig sekmesi en az “Süper Lig kadar dolu” görünür

## Faz 5 — admin ve editoryal operasyon

Hedef:

- ürün sahibi teknik müdahale olmadan içerik ve ödül akışını yönetebilsin

Yapılacaklar:

1. admin login
2. haber / manşet / hafta hikâyesi paneli
3. source / verification state yönetimi
4. sponsor ödül envanteri
5. kazanan onay ekranı
6. audit trail

Çıkış kriteri:

- operasyon chat geçmişiyle değil panel üzerinden döner

## Faz 6 — mobil uyumlu ortak platform

Hedef:

- web ve mobil aynı token sistemi ve aynı veri contract ile çalışsın

Yapılacaklar:

1. ortak design tokens JSON
2. ortak endpoint sözleşmesi
3. auth session modeli
4. push notification event modeli
5. mobile-friendly DTO standardı

Çıkış kriteri:

- mobil ekip ayrı backend tasarlamak zorunda kalmaz

## Faz 7 — gözlemleme ve ölçek

Hedef:

- sistem bozulduğunda bunu son kullanıcıdan önce ekip görsün

Yapılacaklar:

1. Sentry veya eşdeğer hata izleme
2. uptime monitor
3. provider freshness monitor
4. quota alarmı
5. deployment rollback checklist
6. load test

Çıkış kriteri:

- canlı sistem ölçülebilir ve yönetilebilir olur

## Öncelik sırası

İlk uygulanacak sıra:

1. tek backend otoritesi
2. ops / secrets / billing kaydı
3. auth + anti-bot
4. ligler arası veri derinliği eşitleme
5. admin panel
6. monitoring
7. mobil ortak sözleşme

## Bu gece itibarıyla repoda olan çekirdek

- production handoff dokümanı var
- platform architecture dokümanı var
- provider architecture dokümanı var
- satın alım/envanter notu eklendi
- ops secrets ledger şablonu eklendi
- worker env örnek dosyası eklendi

Bu, profesyonel ekibe devir için başlangıç seviyesini “dağınık sohbet geçmişi”nden çıkarıp “kontrollü sistem dosyaları” seviyesine taşır.

