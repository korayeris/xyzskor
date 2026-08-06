# XYZSKOR DB temeli

Tarih: 2026-08-06  
Migration: `supabase/migrations/20260806165000_membership_data_foundation.sql`

## Temel karar

Üyelik için ana kimlik katmanı Supabase Auth `auth.users` üzerinde kalır. Uygulama verileri `public` şemasındaki ayrı tablolarda tutulur. Kişisel veri minimum tutulur; teslimat adresi gibi hassas bilgiler yalnız ödül kazanan kullanıcıdan alınır.

## Katmanlar

- `profiles`: Kullanıcı profili. Email ve şifre burada tutulmaz; onlar Supabase Auth tarafındadır.
- `legal_documents`: KVKK, gizlilik, kullanım koşulları ve ödül kurallarının sürümlü kayıtları.
- `user_consents`: Kullanıcının hangi yasal metnin hangi versiyonunu ne zaman kabul ettiğinin kanıtı.
- `user_privacy_requests`: KVKK erişim, silme, düzeltme ve itiraz talepleri.
- `weekly_games`: Predict dışındaki haftalık oyunların yayın/kilit/skor durumları.
- `weekly_game_entries`: Kullanıcıların haftalık oyun cevapları.
- `reward_campaigns`: Sponsorlu ödül kampanyaları.
- `reward_claims`: Sadece kazananlardan alınan ödül talep ve teslimat kayıtları.
- `account_security_events`: Bot/fraud/rate-limit olayları için hash tabanlı güvenlik kayıtları.

## Güvenlik prensipleri

1. Kullanıcı başka kullanıcının tahminini, oyun cevabını, onayını veya ödül talebini okuyamaz.
2. Puan hesaplama frontend tarafında yapılmaz; `score` alanı backend/admin akışıyla yazılır.
3. Ödül adresi herkesten değil, yalnız kazanan kullanıcıdan alınır.
4. IP ve user-agent ham veri olarak değil, hash olarak saklanmalıdır.
5. Yasal metinler versiyonlanır; kullanıcı onayı da versiyona bağlı tutulur.
6. RLS tüm yeni tablolarda aktiftir.

## İlk uygulanacak ürün akışı

1. Kullanıcı email ile kayıt olur.
2. Kayıt ekranında zorunlu metinler gösterilir.
3. `accept_user_consent(...)` RPC ile onay kaydedilir.
4. Kullanıcı profilini `update_my_profile(...)` RPC ile tamamlar.
5. Haftalık oyun cevabı `submit_weekly_game_entry(...)` RPC ile kaydedilir.
6. Kazanan kullanıcı için `request_reward_claim(...)` RPC ile ödül talebi açılır.
7. Admin ödül talebini inceler ve teslimat bilgisini sınırlı süreyle işler.

## Uygulama notu

Bu migration sadece DB temelini hazırlar. Üretimde uygulanmadan önce Supabase SQL Editor veya Supabase CLI ile staging/prod ayrımı yapılarak çalıştırılmalıdır.
