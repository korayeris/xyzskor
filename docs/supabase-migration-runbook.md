# XYZSKOR Supabase migration runbook

Bu akış canlı veritabanında doğrudan SQL denemek yerine şemayı yedekleyip staging ortamında doğrulamak içindir. Supabase'in önerdiği akış `db pull` → yerel `db reset` → staging `db push` → production `db push` sırasıdır.

Resmî kaynaklar:

- https://supabase.com/docs/guides/local-development/database-migrations
- https://supabase.com/docs/guides/local-development/cli-workflows

## 1. Mevcut uzak şemayı kayda al

```powershell
supabase login
supabase link --project-ref swhwmqbamzczztpfxctg
supabase db pull
supabase migration list
```

`db pull`, Dashboard üzerinden daha önce oluşturulmuş tabloları migration geçmişiyle hizalamak için zorunludur. Oluşan remote-schema migration'ı Git'e eklenmeden sonraki aşamaya geçilmez.

## 2. Temiz yerel veritabanında doğrula

```powershell
supabase start
supabase db reset
npm run check
npm run build
```

`db reset --linked` production projesinde kullanılmaz; uzak şemayı düşürüp yeniden oluşturabilir.

## 3. Staging projesine uygula

```powershell
supabase link --project-ref STAGING_PROJECT_REF
supabase db push
supabase functions deploy football-live
```

Staging kontrol listesi:

- Yeni kullanıcı kaydı ve profil tetikleyicisi
- Kendi tahminini okuma/yazma
- Başka kullanıcının tahminini okuyamama
- Maçtan 15 dakika önce veritabanı kilidi
- Haftalık/sezonluk `get_leaderboard` sonucu
- Anonim `get_match_prediction_consensus` sonucu
- Admin sonuç/ödül yazma yetkisi
- Editoryal kayıt, kaynak, inceleme ve audit politikaları
- Canlı maçta 30 saniyelik uyarlamalı cache

Yük testi yalnız staging test kullanıcısı ve test maçıyla çalıştırılır:

```powershell
npm run load:test
```

Gerekli değişkenler: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_TEST_JWT`, `TEST_MATCH_ID`. Canlı kullanıcı JWT'si veya service-role anahtarı kullanılmaz.

## 4. Production geçişi

Staging sonuçları onaylandıktan ve Dashboard yedeği alındıktan sonra:

```powershell
supabase link --project-ref swhwmqbamzczztpfxctg
supabase migration list
supabase db push
supabase functions deploy football-live
```

İlk editoryal owner üyeliği yalnız güvenli bakım oturumunda doğrulanmış Auth UID ile eklenir. Anahtarlar Git'e, `index.html` dosyasına veya tarayıcı loglarına yazılmaz.
