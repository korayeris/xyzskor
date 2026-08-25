# Veritabanı doğrulaması

Migrationlar:

- `20260825130000_weekly_football_awards.sql`
- `20260825150000_member_admin_hardening.sql`

- `football_weekly_player_scores`: lig/sezon/tur/oyuncu/algoritma için unique anahtar.
- `football_weekly_awards`: lig/sezon/tur/algoritma için unique anahtar.
- Anonim ve authenticated roller yalnız `published` kayıtları okuyabilir.
- İstemci rolleri yazamaz; yazma yalnız service-role sunucu yolundadır.
- Rollback dosyası sağlanmıştır.

Yerel PostgreSQL 16 doğrulama sonucu final raporunda gerçek komut sonucu olarak kaydedilir. Erişim yoksa “çalıştırıldı” sayılmaz.

Tek komutluk yerel tekrar çalıştırma yolu `npm run qa:db` komutudur. Paket `weekly_football_db_test.sql` ile published-only RLS/grant ve unique upsert sözleşmesini, `weekly_football_concurrency_test.sh` ile 20 paralel aynı tur hesabının tek satırda kalmasını denetler.

25 Ağustos 2026 gerçek Supabase production doğrulaması:

- Migration ilk kez uygulandı; iki tablo ve iki published-only SELECT policy oluştu.
- `anon INSERT=false`, `authenticated UPDATE=false`, `authenticated DELETE=false` doğrulandı.
- Anon rolü iki test kaydından yalnız tek `published` kaydı gördü.
- Aynı unique anahtara yeniden upsert sonrasında satır sayısı `1` kaldı.
- Rollback sonrasında iki `to_regclass` sonucu `NULL`; yeniden apply sonrasında iki tablo da tekrar mevcut.
- Üretimde `auth.users=4`, `profiles=1`, eksik profil `3`, admin `0` durumu yakalandı.
- Üyelik/admin hardening migration'ı eksik üç profili backfill etti; sonuç `auth.users=4`, `profiles=4`, eksik profil `0` oldu.
- Eksik `handle_new_user()` fonksiyonu ile `on_auth_user_created` tetikleyicisi yeniden kuruldu.
- Admin RPC yüzeyinde `anon` EXECUTE kaldırıldı; `authenticated` EXECUTE korunurken fonksiyon içi `is_admin()` kontrolü devam ediyor.
- Üyelik/admin rollback -> re-apply döngüsü production üzerinde geçti; son doğrulamada trigger, profil bütünlüğü ve anon bloklama sonuçları `true`.
- Haftalık published-only RLS testi production üzerinde transaction içinde geçti ve test kayıtları `ROLLBACK` ile temizlendi.
- Dashboard ile 20 ayrı SQL oturumu denendi; yalnız 7 editör hazır hale gelebildi ve tarayıcı kontrol katmanı zaman aşımına uğradı. Bu nedenle gerçek 20-paralel DB kanıtı **henüz geçmedi** ve başarı olarak raporlanmaz.
- Uygulama/Worker katmanındaki yük testi ayrıca geçti: aynı haftalık iş için 50 paralel istemci, 50 başarı ve tek sağlayıcı hesaplama zinciri (`weeklyCoalesced=49`). Bu sonuç DB bağlantı paralelliğinin yerine geçmez.

Proje gözleminde nano compute CPU %2, disk %14, RAM %50 ve 5/60 bağlantı kullanıyordu. Migration/RLS yükü için plan büyütme gereği görülmedi; satın alma yapılmadı. “Saatte iki test” DB compute sınırı değildir. 20 paralel kanıt, `psql` bulunan bir runner veya bağlı Supabase veritabanı aracı üzerinden tekrar çalıştırılmalıdır.

Admin panelinin kullanılabilmesi için bir mevcut hesabın bilinçli olarak ilk `owner` yapılması gerekir. Production'da admin sayısı bilerek `0` bırakılmıştır; hesap kimliği tahmin edilerek yetki verilmemiştir.
