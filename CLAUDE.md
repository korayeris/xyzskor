# CLAUDE.md — XYZSKOR proje bağlamı ve çalışma kuralları

Bu dosya Claude Code (ve diğer AI ajanları) için yazılmıştır. Bir göreve başlamadan
önce **tamamını oku**. Buradaki kurallar, kod tabanında acı çekilerek öğrenilmiş
tuzakları içerir; görmezden gelmek sessiz hatalara yol açar.

---

## 1. Proje nedir

XYZSKOR: Süper Lig, Şampiyonlar Ligi, UEFA Avrupa Ligi, La Liga ve Premier League
için canlı skor, fikstür, puan durumu, transfer akışı, editoryal içerik ve
**ücretsiz tahmin yarışması (Predict)** sunan bir futbol platformu.

Mythos Cards yalnızca **ödül sponsorudur**. Sitede ürün satışı, sepet veya ödeme
akışı yoktur. **Bahis, oran ve para yatırma yoktur** — bu bir ürün taahhüdüdür ve
sayfa metinlerinde yazılıdır.

## 2. Mimari

```
Tarayıcı (vanilla JS SPA, framework YOK, bundler YOK)
   │  index.html + assets/js/{data,live,match-center,ui,chat}.js + assets/css/app.css
   │
   ├─→ Cloudflare Worker (worker/index.js)  ── SportMonks v3 / X API / YouTube / Instagram Graph
   │      statik dosya sunumu + /api/* proxy + edge cache + güvenlik başlıkları
   │
   └─→ Supabase (doğrudan tarayıcıdan)  ── Auth, Postgres, RLS, Realtime
          supabase/migrations/*.sql
```

**Script yükleme sırası önemlidir** (index.html sonunda, hepsi `defer`):
`supabase-js` → `data.js` → `live.js` → `match-center.js` → `ui.js` → `chat.js`

Bunlar **klasik script**, ES module DEĞİL. Global scope paylaşırlar. `let`/`const`
ile tanımlı globaller `window`'a eklenmez — test yazarken buna dikkat et.

---

## 3. MUTLAK KURALLAR (ihlal etme)

### 3.1 Sahte veri üretme
Sağlayıcı veri döndürmüyorsa **"yayınlanmadı" / "alınamıyor" de, tahmin üretme.**
Sahte skor, sahte kadro, sahte istatistik, sahte oran — hiçbiri kabul edilemez.
Bu kural kod tabanının her katmanına yayılmış durumda; bozma.

### 3.2 Bahis oranı ekleme
SportMonks `/odds/*` ve `/predictions/value-bets` endpoint'leri **kullanılmayacak**.
Site "bahis ve para yatırma bulunmaz" diye taahhüt veriyor; ayrıca Türkiye'de
7258 sayılı kanun kapsamında oran yayını ciddi risktir.
`/predictions/probabilities` kullanılabilir ama yalnızca "sağlayıcı modeli
olasılığı" etiketiyle, kupon/oran diline hiç yaklaşmadan.

### 3.3 Secret'lar
Hiçbir token, API anahtarı veya service-role anahtarı koda, log'a, dokümana
yazılmaz. Supabase **anon/publishable** anahtarı `data.js`'te açıktır — bu
tasarım gereğidir (RLS ile korunur), service-role ile karıştırma.

### 3.4 Gizlilik
Kullanıcıların **bireysel tahminleri asla gösterilmez**. Yalnızca anonim toplu
dağılım (`get_match_prediction_consensus` RPC'si) yayınlanır.
`scripts/check.mjs` bunu regresyon testiyle koruyor — testi kırma, metni sil.

### 3.5 Onay
Production yapılandırması, deployment ve veritabanı migration'larının canlıya
uygulanması **kullanıcı onayı olmadan yapılmaz**.

---

## 4. Komutlar

```bash
npm run check     # Ürün, güvenlik ve mimari regresyon kontrolleri — HER değişiklikten sonra
npm run build     # Production build (dist/) — minify + cache busting dahil
npm run dev       # SADECE WINDOWS (PowerShell). Linux/macOS'ta: node scripts/dev-server.mjs
```

`npm run dev` PowerShell script'i çağırır. Linux/macOS'ta doğrudan:
```bash
node scripts/dev-server.mjs        # http://127.0.0.1:4173
```
`/api/*` istekleri `XYZSKOR_EDGE_ORIGIN` adresine proxy'lenir (varsayılan uzak sunucu).

`XYZSKOR_NO_MINIFY=1 npm run build` — hata ayıklama için minify'ı kapatır.

---

## 5. TUZAKLAR — bunları bilmeden kod yazma

### 5.1 `ui.js`'te fonksiyonlar 2–3 kez tanımlı
`renderClubSocial`, `renderFootballNews`, `renderEditorialNews`, `renderNewsHub`,
`renderPreseasonSocial`, `renderFootballFeatured`, `renderFootballTransfers`,
`renderFootballStandingsCompact`, `renderPortalSponsor` — bunların hepsi
dosyada birden fazla kez tanımlı. **Tarayıcıda SON tanım kazanır.**
İlk tanımı değiştirirsen hiçbir etkisi olmaz. Değişiklik yapmadan önce
`grep -n "function <ad>" assets/js/ui.js` çalıştır ve **en sondakini** düzenle
(genelde ~2300+ satırdaki IIFE bloğu).

### 5.2 `scripts/check.mjs` fonksiyon ayıklayıcısı kırılgan
`functionSource()` fonksiyon gövdesini süslü parantez sayarak ayıklar ama
**yorumları atlamaz ve tek tırnağı string başlangıcı sayar.**
Sonuç: bir fonksiyonun içindeki yorumda Türkçe apostrof kullanırsan
(`sn'de`, `TTL'i`) parser bozulur ve `"X fonksiyonu tamamlanmamış"` hatası alırsın.
**Fonksiyon içi yorumlarda apostrof kullanma.**

### 5.3 `matches` tablosu tam kaynak değil
Fikstür SportMonks'tan gelir (`/api/football/season`); `public.matches` yalnızca
Süper Lig için yedektir:
```js
MATCHES = providerMatches.length ? providerMatches : (scopedSuperLig ? matches : [])
```
Bu yüzden **sunucu tarafı bir RPC fikstürü göremez.** Kişiselleştirme, arama gibi
özellikler hibrit olmalı (RPC + istemci filtresi).

### 5.4 `profiles` RLS'i başkasının satırını vermez
`profiles_own_read` yalnızca `id = auth.uid()`. Bu yüzden chat'te yazar adı/takımı
mesaj satırına **denormalize edilir** (trigger içinde, sunucu tarafında). Benzer bir
ihtiyaçta ya denormalize et ya da `security definer` RPC yaz (`get_leaderboard` deseni).

### 5.5 SportMonks v3'te ilişkiler `include` olmadan gelmez
`form`, `fromTeam`, `toTeam`, `lineups.details` gibi alanlar ilişkidir.
Include etmezsen alan **sessizce boş gelir** — hata almazsın, sadece UI boş kalır.
Ayrıca include edilen ilişki **dizi** döner, düz string değil
(bkz. `normalizeStandingForm`).

### 5.6 PostgreSQL fonksiyonlarında PUBLIC EXECUTE
Yeni fonksiyon oluşturduğunda PostgreSQL **varsayılan olarak PUBLIC'e execute
yetkisi verir** — yani `anon` rolü de çağırabilir. Her `security definer` RPC için:
```sql
revoke all on function public.fn_adi(...) from public;
grant execute on function public.fn_adi(...) to authenticated;
```

### 5.7 `position` rezerve kelimedir
`RETURNS TABLE (... position bigint)` **sözdizimi hatası** verir ve migration
sessizce hiç uygulanmaz. Tırnakla: `"position" bigint`.

### 5.8 CSS'te 870+ `!important`
`assets/css/app.css` 4400+ satır, kronolojik yamalarla büyümüş, aynı bileşen 4–6
kez tanımlı. **Mevcut kuralları değiştirme** — yeni katmanı dosyanın SONUNA
`/* vNNN · başlık */` yorumuyla ekle. Mevcut katmanlar: v109 motion, v110 chat,
v111 instagram, v112 maç merkezi consensus.

### 5.9 Inline `onclick` bağımlılığı
`index.html`'de ~45 inline `onclick` global fonksiyon adlarına doğrudan referans
verir (`switchMainTab`, `openFootballSection`, `switchLeagueSection`...).
Bu yüzden build **bundle/IIFE değil, esbuild `transform`** kullanır (top-level
isimleri korur). Bundle moduna geçersen tüm site tıklanamaz hale gelir.
Build bu adların minify sonrası kaybolmadığını doğrular ve kaybolursa hata verir.

### 5.10 Statik dosyalar 1 yıl önbelleklenir
Worker `max-age=31536000, immutable` veriyor. Cache busting `?v=<hash>` ile
yapılır ve `build.mjs` tüm asset referanslarının sürümlendiğini **doğrular**.
`index.html`'e yeni bir asset eklersen kök-göreli yaz (`/assets/...`).
Yeni bir JS dosyası eklersen `CLIENT_JS_FILES` listesine ekle — yoksa parmak
izine dahil olmaz ve tarayıcı eski sürümü sunar.

---

## 6. Migration yazma

Dosya adı: `YYYYMMDDHHMMSS_snake_case_ad.sql`. Şablon:

```sql
-- Türkçe açıklama: ne yapıyor ve NEDEN.
begin;
create table if not exists public.tablo (...);
create index if not exists tablo_x_idx on public.tablo(...);

create or replace function public.fn() returns ...
language sql stable security definer set search_path = public, pg_temp as $$ ... $$;

alter table public.tablo enable row level security;
create policy tablo_public_read on public.tablo for select to anon, authenticated using (...);
create policy tablo_admin_all on public.tablo for all to authenticated
  using (public.is_editorial_admin(null)) with check (public.is_editorial_admin(null));

revoke all on public.tablo from anon;
grant select on public.tablo to anon, authenticated;
revoke all on function public.fn() from public;      -- 5.6!
grant execute on function public.fn() to authenticated;
comment on table public.tablo is 'Türkçe açıklama.';
commit;
-- GERİ ALMA PLANI (ayrı transaction): drop ...
```

Policy adlandırma: `<tablo>_<kapsam>_<işlem>` → `*_public_read`, `*_own_insert`,
`*_admin_all`. Hata mesajları Türkçe.

### Migration'ı yerelde test et (canlıya uygulamadan önce)
Projede bunun için hazır araçlar var:
```bash
# PostgreSQL 16 + Supabase ortamı taklidi (auth şeması, auth.uid(), roller, publication)
psql -f pg_supabase_shim.sql          # test-araclari paketinde
# sonra migration'ları sırayla uygula ve chat_rls_test.sql benzeri davranış testi yaz
```

---

## 7. Test ve doğrulama

Değişiklikten sonra **en az** şunlar:
```bash
npm run check && npm run build
node -e "const fs=require('fs');for(const f of ['data','live','match-center','ui','chat'])new Function(fs.readFileSync('assets/js/'+f+'.js','utf8'));console.log('OK')"
```

Mevcut test araçları (ayrı `test-araclari` paketinde, repoya dahil değil):
- `api_test_harness.mjs` — 146 kontrol, worker'ı Node'da mock upstream'lerle test eder
- `visual_check.mjs` / `chat_ui_check.mjs` / `ig_ui_check.mjs` — Playwright, sayfa hatası + DOM durumu
- `chat_rls_test.sql` — 18 senaryoluk RLS/güvenlik davranış testi
- `perf_check.mjs` — CPU/ağ kısıtlamalı mobil performans ölçümü

Bu araçlar sandbox'ta yazıldı; repoya taşımak istersen `tests/` altına koy ve
`package.json`'a script ekle.

---

## 8. Ortam değişkenleri (secret)

Worker (`worker/.dev.vars.example`):
`SPORTMONKS_API_TOKEN` (veya `SPORTMONKS_TOKEN`), `X_BEARER_TOKEN`,
`YOUTUBE_API_KEY`, `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_BUSINESS_ACCOUNT_ID`

Supabase Edge Function (`supabase/functions/.env.example`):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVE_REFRESH_SECRET`,
`LIVE_ALLOWED_ORIGINS`, `FOOTBALL_DATA_PROVIDER`

Anahtar tanımlıysa `/api/health` `"configured"` der. Abonelik kapsamını
`/api/football/coverage` söyler — yeni lig eklemeden önce buraya bak.

**Instagram kısıtı:** Graph API başka bir hesabın (kulübün) gönderilerini
çekmeye izin VERMEZ. Yalnızca (a) hashtag araması — herkese açık gönderiler,
7 günde en fazla 30 benzersiz hashtag; (b) kendi Business hesabının gönderileri.
Mevcut entegrasyon ikisini birden kullanır.

---

## 9. Git

- `main`'e doğrudan geliştirme yapma; `claude-development` (veya konu dalı) kullan.
- Küçük, açıklayıcı commit'ler. Commit mesajında **ne** değil **neden** anlat.
- Force push yok. Kullanıcının değişikliklerini silme.
- Onay almadan push/deploy yok.

---

## 10. Sırada ne var

Öncelikli iş listesi ve dosya seviyesinde plan için:
`XYZSKOR-yol-haritasi-2026-08-06.md` ve `XYZSKOR-olgunluk-raporu-2026-08-06.md`
(proje alanında ve teslim paketinde).

**En yüksek getirili sıradaki adımlar:**
1. Migration'ları canlı Supabase'e uygula + gerçek API anahtarlarını tanımla.
   Bu tek adım sıralama sistemini, chat'i ve tüm veri entegrasyonlarını
   "kod hazır"dan "çalışıyor"a taşır.
2. `/api/football/live` yanıtındaki `details` bloğu worker'da hesaplanıyor ama
   `live.js` hiç kullanmıyor — canlı kartta gol/kart/istatistik ücretsiz duruyor.
3. `/api/football/coverage` frontend'de hiç çağrılmıyor; lig seçilirken çağrılıp
   "bu lig abonelikte yok" mesajı net verilebilir.
4. `ui.js`'teki mükerrer fonksiyon tanımlarını temizle (5.1) — her değişikliği
   güvenli hale getirir.
