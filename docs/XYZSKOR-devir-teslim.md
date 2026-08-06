# XYZSkor — Devir Teslim Dokümanı

**Tarih:** 31 Temmuz 2026
**Ürün:** Süper Lig tahmin/lider tablosu platformu (bahis/iddaa değil — ücretsiz tahmin oyunu)
**Mimari:** Modüler vanilla JS/CSS + Supabase (Postgres + Auth + RLS). Framework yok; görünüm ve ürün davranışı korunurken kaynak kod sorumluluklarına göre ayrıldı.

**Sponsorluk kuralı:** Mythos Cards yalnızca ödül sponsorudur. XYZSKOR hiçbir ürün satmaz, fiyat göstermez ve satın alma bağlantısı barındırmaz. Gösterilen koleksiyon ürünleri yalnızca açıklanan yarışma kazananlarına ücretsiz hediye edilir.

**Veri sağlayıcı kararı (31 Temmuz 2026):** İlk canlı bağlantı API-Football ücretsiz kotasıyla, değiştirilebilir `football-live` Edge Function üzerinden yapılır. Üretim hedefi Sportmonks; Goalserve 2–3 haftalık gölge karşılaştırmadır. Sağlayıcı değiştirilirken ön yüz kodu değişmez. Ayrıntılar için [`data-provider-architecture.md`](./data-provider-architecture.md) esas alınmalıdır.

---

## 1. Dosya ve Erişim Bilgileri

| Ne | Değer |
|---|---|
| HTML kabuğu | `index.html` |
| Görsel sistem | `assets/css/app.css` |
| Veri/Auth/Puanlama | `assets/js/data.js` |
| Hafta/Canlı akış | `assets/js/live.js` |
| Maç merkezi | `assets/js/match-center.js` |
| Arayüz/Render/Boot | `assets/js/ui.js` |
| Supabase proje adı | `xyzskor` |
| Supabase project_id | `swhwmqbamzczztpfxctg` |
| Supabase URL | `https://swhwmqbamzczztpfxctg.supabase.co` |
| Kullanılan key | **publishable/anon** key (`sb_publishable_...`) — dosya içinde `SUPABASE_KEY` sabiti. **Service role key hiçbir yerde yok, olmamalı.** |
| Organizasyon | Supabase org: "Emre" (`eerlmmdcrgfqqvsblrvt`) |
| Bölge | eu-west-1 |
| Maliyet | $0/ay (ücretsiz katman) |

Yerel çalıştırma için `npm run dev`, üretim paketi için `npm run build` kullanılır. Bağımlılık kurulumu gerektiren bir frontend framework yoktur.

---

## 2. Genel Mimari

- **Dört sıralı JavaScript modülü:** veri/auth/puanlama → hafta ve canlı akış → Maç Merkezi → arayüz/render/boot. Klasik script sırası, mevcut inline event davranışlarını bozmadan ortak uygulama state'ini korur.
- **Veri akışı:** `boot()` → `loadAllData()` → herkese açık futbol verileri + oturum sahibinin kendi profili/tahminleri → sunucu tarafı `get_leaderboard` RPC → `renderAll()`. RPC henüz uygulanmamış eski Supabase ortamlarında geçici uyumluluk için eski geniş sorgu akışına geri düşer.
- **Production build:** HTML içindeki eski prototip bloklarını ve `data.js` içindeki örnek market verisini ayıklar; kaynak dosyalar ile yayın paketi birbirinden ayrıdır.
- **Routing:** URL hash tabanlı, framework'süz.
  - `#week/N` → aktif hafta
  - `#match/MATCH_ID` → Maç Merkezi açık
  - `parseHash()` / `updateHash()` / `hashchange` listener ile yönetiliyor.
- **State:** Global `let` değişkenleri (`MATCHES`, `PROFILES`, `ALL_PREDICTIONS`, `ALL_RESULTS`, `REWARDS`, `STANDINGS`, `WEEKLY_STORIES`, `currentUser`, `activeWeek`, `mcMatchId` vb.) — Redux/Zustand yok, kasıtlı olarak basit tutuldu.

### Sayfa/Sekme Yapısı
```
nav (üst bar) + live-ticker (sıradaki maç sayacı)
maintabs: Haftanın Hikâyesi | Tahmin Ligi | Canlı
├─ page-story
│   ├─ weekSelector (← N. Hafta →)
│   ├─ weeklyStoryArea (editoryal hikaye)
│   ├─ story-main: hero maç, maç listesi, video, öne çıkan veriler, model perf. teaser, geçen hafta
│   └─ story-aside: sıradaki maç, puan durumu (ilk 5), Tahmin Ligi CTA, reklam
├─ page-league
│   ├─ teamBannerArea, progressPanel
│   └─ leaguesubtabs: Tahminler | Puan Durumu | Lider Tablosu | Ödüller | Profilim | (Yönetim — admin'e gizli)
└─ page-live (yer tutucu, canlı veri sağlayıcısı bağlanınca doldurulacak)

mobile-bottom-nav (sadece <768px): Hikâye/Tahmin/Liderlik/Canlı/Profil
mcOverlay (Maç Merkezi — tam ekran drawer, 6 sekme)
authOverlay (üye ol/giriş modalı)
```

---

## 3. Supabase Şeması (mevcut tablolar)

| Tablo | Amaç | Yazma yetkisi |
|---|---|---|
| `profiles` | id(=auth uid), username, team, team_changed, is_admin | herkes kendi satırını |
| `matches` | id, hafta, ev, konuk, kickoff, stadyum, featured, verified, **status**, **referee_name**, **referee_stats**(jsonb), **weather**(jsonb) | admin |
| `match_analysis` | match_id, data(jsonb: 9 analiz alanı + `story_summary` dizisi) | admin |
| `predictions` | match_id, user_id, pick, score_home, score_away, submitted_at | kullanıcı kendi satırı |
| `results` | match_id, home, away, scored_at | admin |
| `rewards` | team, sira, aciklama | admin |
| `league_standings` | season, week, team, played/won/drawn/lost/goals_for/goals_against/goal_difference/points, home_played/home_points/away_played/away_points, form, source, verified_at | admin |
| `weekly_stories` | week(PK), title, intro, cards(jsonb dizi), watch_for(jsonb dizi), is_published | admin |
| `model_predictions` | match_id(PK), pick, score_home, score_away, predicted_at | admin — **RLS kickoff'tan önce yazmaya izin veriyor, sonra donuyor** |
| `match_lineups` | match_id, team, is_official, player_name, position, number, is_captain, is_keeper | admin |
| `match_absences` | match_id, team, player_name, status/availability_status, verification_status, reason, expected_return, source, source_url, checked_at | admin |
| `match_events` | match_id, minute, event_type, team, player, description, verified, source | admin (şu an **hiç kullanılmıyor**, canlı veri sağlayıcısı bağlanınca devreye girecek) |

**Yeniden kurulabilir kaynak:** `20260802180000_platform_core.sql` çekirdek tabloları, tetikleyicileri ve RLS politikalarını; `20260802181000_server_leaderboard.sql` sunucu puanlamasını; `20260802182000_editorial_operations.sql` haber operasyonu ve denetim izini tanımlar. Migration'lar canlıya uygulanmadan önce schema-only yedek ve staging testi alınmalıdır.

**RLS hedefi:** Profiller ve tahminler yalnız hesap sahibine açıktır. Herkese açık sıralama bireysel tahminleri değil, yalnız `get_leaderboard` RPC'nin toplulaştırılmış sonucunu döndürür. Tahminin 15 dakika kala kilitlenmesi hem istemcide hem veritabanı tetikleyicisinde uygulanır.

**Kritik RLS istisnası — `predictions`:**
```sql
select: auth.uid() = user_id OR (match kilitliyse — kickoff-15dk geçmişse)
```
Bu sayede kilitlenmemiş maçlarda başkalarının tahminleri **hiçbir zaman** istemciye inmiyor.

**RPC — `get_match_prediction_consensus(p_match_id text)`**
Topluluk tahmin yüzdesini döndürür. Kilit kapanmadan (`kickoff - 15dk`) önce **hiçbir satır döndürmez**. Kullanıcı kimliği asla dönmez, sadece toplam sayı + 3 yüzde.

---

## 4. Frontend Fonksiyon Haritası (önemli olanlar)

**Veri:** `loadAllData()`, `moduleQuery()`, `primeServerLeaderboards()` ve `fetchServerLeaderboard()`

**Auth:** `registerUser`, `loginUser`, `logoutUser`, `changeTeam`, `openAuth`/`closeAuth`

**Tahmin/Puanlama:** `savePrediction`, `setResult`, `computeMatchPoints`, `get_leaderboard` RPC, `leaderboardFor`, `sortRows`. Tarayıcı hesapları yalnız migration uygulanmamış eski ortam için uyumluluk yedeğidir.

**Hafta sistemi:** `getAvailableWeeks`, `weekMatches`, `weekStatus` (gerçek zamandan "3 gün kaldı"/"4'ü tamamlandı"/"tamamlandı" hesaplar), `goToWeek`/`prevWeek`/`nextWeek`, `parseHash`/`updateHash`

**Maç Merkezi:** `openMatchCenter`, `closeMatchCenter`, `switchMcTab`, `ensureMcData` (lazy-load: lineups+absences+model_predictions+consensus RPC, cache'lenir), `renderMc*` (Overview/Analysis/Lineups/Stats/Flow/Predictions)

**Puan Durumu:** `seasonNotStarted()`, `standingsStale()`, `sortedStandings()` — üç farklı durumu ayırt eder (veri yok / sezon başlamadı / güncelleniyor)

**Render zinciri:** `renderAll()` → hepsini tetikler → `boot()` bunu try/catch içinde çağırır, hata olursa `showLoadError()` + "Tekrar dene" butonu.

---

## 5. Bilinen Kısıtlar / Yapılmayanlar (bilerek)

Bunlar **kasıtlı olarak** eklenmedi — yarım/bozuk özellik bırakmamak için:

- **Tam editoryal admin arayüzü henüz yok:** Kuyruk, kaynak, inceleme, düzeltme, zamanlanmış yayın, bildirim ve audit şeması migration olarak hazır; web CRUD ekranı ve worker işleyicileri sonraki fazdır.
- **Takvime ekle, Paylaşım, Site içi arama, Takım mini sayfaları, Gol krallığı** — hiç başlanmadı (Öncelik 2/3 olarak bırakıldı, yarım buton yok).
- **Canlı maç akışı** (`match_events`) — şema hazır, RLS hazır, ama front-end her zaman "Canlı maç akışı veri sağlayıcısı bağlandığında burada gösterilecek" diyor. Sportmonks ana akışının sunucu tarafı entegrasyonu ve Goalserve gölge testi henüz API anahtarları alınmadığı için bağlı değil.
- **Otomatik tahmin modeli** — `model_predictions` tablosu var ama otomatik hiçbir şey çalıştırmıyor; admin manuel SQL ile tek tek girmesi gerekiyor.
- **Ödüller haftaya bağlı değil** — `rewards` tablosunda `week` kolonu yok, sadece takım bazlı. Haftalık ödül sistemi istenirse şema değişikliği gerekir.

---

## 6. Bilinen Riskler / Yapılacaklar Listesi

1. **Supabase Auth → "Leaked Password Protection" kapalı.** SQL ile açılamıyor, Dashboard → Authentication → Policies üzerinden manuel açılmalı.
2. **Email confirmation** varsayılan olarak açık olabilir — test/geliştirme sürecinde Dashboard → Authentication → Providers → Email → "Confirm email" kapatılabilir.
3. **Admin atama uygulama içinden yapılamıyor.** Birini admin yapmak için:
   ```sql
   update public.profiles set is_admin = true where id = (select id from auth.users where email = 'ADRES@ORNEK.com');
   ```
4. **`league_standings.week` kolonu şu an kullanılmıyor** (front-end hep `.select('*')` ile tüm satırları çekiyor, week'e göre filtrelemiyor). Sezon ilerledikçe "haftalık snapshot" isteniyorsa bu davranış bilerek gözden geçirilmeli.
5. **`renderMcFlow` (Maç Akışı sekmesi)** şu an `match_events` tablosunu hiç sorgulamıyor, sabit boş metin döndürüyor — canlı veri bağlanınca burası gerçek sorguya çevrilmeli.
6. **Yük testi:** `scripts/load-test-predictions.mjs` yalnız staging JWT'si ve kilitlenmemiş test maçıyla çalıştırılmalıdır; canlı kullanıcı verisine karşı çalıştırılmamalıdır.

---

## 7. Güvenlik Notları

- Tüm çekirdek ve editoryal tablolarda RLS migration içinde zorunludur. Canlı ortam doğrulaması migration sonrası advisor ve SQL kontrolleriyle ayrıca yapılmalıdır.
- `is_admin()` ve `get_match_prediction_consensus()` fonksiyonlarında `search_path` sabitlendi (Supabase advisor uyarısı giderildi).
- `service_role` key hiçbir yerde yok.
- Kilitlenmemiş tahminler istemciye hiç inmiyor (RLS seviyesinde, sadece UI seviyesinde değil).

---

## 8. Önerilen İlk Adımlar (yeni yazılımcı için)

1. Dosyayı bir tarayıcıda aç, konsolu açık tut. `boot()` hata verirse `[XYZSkor veri hatası]` etiketiyle hangi tablonun neden başarısız olduğunu gösterir.
2. Kendine bir hesap aç, sonra yukarıdaki SQL ile kendini admin yap → "Yönetim" sekmesi Tahmin Ligi'nde görünecek.
3. Supabase SQL Editor'den `league_standings`'e gerçek maç sonuçları girildikçe elle güncelleme yap (veya bir admin panel inşa et — madde 5'te bahsedilen boşluk burada).
4. 360/390/430px gerçek cihaz/emulator testini yap — bu hiç yapılmadı.
5. Canlı veri sağlayıcısı entegrasyonunda önce `data-provider-architecture.md` içindeki güvenli sunucu akışı uygulanmalı; `match_events` tablosu ve `renderMcFlow` fonksiyonu ön yüzdeki doğru bağlantı noktalarıdır.

---

*Bu doküman, bu konuşma boyunca yapılan tüm değişikliklerin (Supabase kurulumu → mobil-first tasarım → Maç Merkezi/hafta sistemi → gerçek veri doldurma) özetidir. Kod içi yorumlar (`/* ===== BAŞLIK ===== */`) dosyanın kendisinde bölüm bulmayı kolaylaştırır.*
