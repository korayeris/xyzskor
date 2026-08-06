# XYZSKOR — Prompt 1 Repo Analizi ve Koruma Haritası

Tarih: 2 Ağustos 2026  
Analiz edilen kaynak: `Thecetinn/xyzskor`, `main`, son görülen commit `62d9a283857c3b1f427dc3c627c3c2cbfb1583de`  
Canlı kontrol: `https://xyzskor-tr.korayeris2002.chatgpt.site/`

## Kapsam ve doğrulanabilirlik

- İstenen `korayeris/xyzskor` yolu GitHub bağlantısında 404 döndürdü. Bağlı hesapta erişilebilen güncel XYZSKOR deposu `Thecetinn/xyzskor` olduğu için analiz bu depo üzerinden yapıldı.
- Depoda `AGENTS.md` yok. Çalışma alanı kökündeki `AGENTS.md` okundu; `sources/` salt okunur kuralına uyuldu.
- GitHub deposu özel olduğu ve yerel Git kimlik bilgisi bulunmadığı için dosyalar GitHub bağlantısı üzerinden salt okunur incelendi. Ürün kodu değiştirilmedi.
- Canlı sitenin hangi committen dağıtıldığı depoda kanıtlanmıyor. Görsel bulgular canlı siteye, kod bulguları yukarıdaki commit’e aittir; birebir deploy eşleşmesi varsayılmadı.
- Core Supabase şema ve RLS migration’ları repoda yok. Devir teslim belgesindeki RLS iddiaları repo kaynak kodundan bağımsız doğrulanamadı.

## 1. Mevcut mimari

- Vanilla HTML/CSS/JavaScript, framework yok.
- Ana uygulama `index.html` içinde: 178.938 bayt, 2.373 satır, inline CSS ve inline JavaScript.
- Supabase JS CDN üzerinden yükleniyor; istemci publishable/anon anahtarı kullanıyor.
- Global mutable state: `MATCHES`, `ANALYSIS`, `PROFILES`, `ALL_PREDICTIONS`, `ALL_RESULTS`, `REWARDS`, `STANDINGS`, `WEEKLY_STORIES`, `currentUser`, hafta/sekme/modal state’leri.
- Statik build `scripts/build.mjs` ile `dist/client` ve `dist/server` oluşturuyor. Worker statik varlık sunuyor ve SPA fallback sağlıyor.
- Canlı veri `football-live` Supabase Edge Function üzerinden API-Football veya Sportmonks adaptörüne gidiyor; `live_feed_cache` sunucu önbelleği var.

## 2. Dosya ve modül haritası

| Yol | Sorumluluk | Durum |
|---|---|---|
| `index.html` | Tüm UI, CSS, state, Supabase istemcisi, auth, tahmin, puanlama, routing ve render | Aşırı büyük/tek parça |
| `README.md` | Yerel çalışma, check/build ve güvenlik özeti | Build yok ifadesi güncel `build` scriptiyle kısmen eski |
| `docs/XYZSKOR-devir-teslim.md` | Mimari, şema ve operasyon notları | Bazı dosya/satır bilgileri eski; RLS iddialarının SQL kaynağı yok |
| `docs/data-provider-architecture.md` | Sağlayıcı soyutlama, veri doğruluğu ve gölge test planı | Korunmalı |
| `docs/provider-comparison-scorecard.csv` | Sağlayıcı karşılaştırma şablonu | Fixture örnekleri açıkça örnek |
| `scripts/check.mjs` | Sözdizimi, puanlama, sağlayıcı ve sponsor kuralları için assert’ler | Dar kapsamlı; DOM/auth/RLS testi yok |
| `scripts/check.ps1` | Windows check çalıştırıcısı | macOS/Linux’ta doğrudan çalışmaz |
| `scripts/dev.ps1` | Windows yerel sunucu | macOS/Linux’ta doğrudan çalışmaz |
| `scripts/build.mjs` | Statik production çıktısı | Basit ve davranış koruyan |
| `supabase/functions/football-live/index.ts` | CORS, sağlayıcı adaptörü, cache, stale fallback | Public endpoint; rate limit yok |
| `supabase/migrations/20260731_live_feed_cache.sql` | Sadece canlı cache tablosu ve RLS | Core şema/RLS eksik |
| `worker/index.js` | Statik servis, SPA fallback, temel güvenlik/cache header’ları | CSP/HSTS yok |
| `.openai/hosting.json` | Hosting proje kimliği | Deployment kaynağı |
| `assets/**` | Kampanya ve top görselleri | Lisans/provenance ayrıca doğrulanmalı |

## 3. Uygulama başlangıç akışı

1. Supabase client oluşturulur.
2. Statik sponsor/transfer alanları ilk HTML ve JavaScript ile hazırlanır.
3. `boot()` çağrılır.
4. `renderMarketPulse()`, `renderMythosProducts()`, sayaç ve skeleton’lar başlatılır.
5. `loadAllData()` sekiz Supabase sorgusunu paralel çalıştırır.
6. Oturum `auth.getSession()` ile okunur; eksik profil `ensureOwnProfile()` ile oluşturulmaya çalışılır.
7. Aktif hafta hash’ten veya ilk mevcut haftadan belirlenir.
8. `renderAll()` tüm ana bölgeleri yeniden çizer.
9. Hash `match` ise Maç Merkezi açılır.
10. Herhangi bir ana veri sorgusu hata verirse bütün ana yükleme `showLoadError()` yoluna düşer.

## 4. Veri çekme ve render zinciri

`loadAllData()` şu tabloları tam liste olarak çeker: `matches`, `match_analysis`, `profiles`, `predictions`, `results`, `rewards`, `league_standings`, `weekly_stories`.

`renderAll()` çağrı zinciri:

`renderMarketPulse` → `renderMythosProducts` → transfer sayacı → `renderNav` → `renderTicker` → `renderStory` → `renderTeamBanner` → `renderProgress` → `renderLeagueMatches` → `renderLeaderTabs` → `renderRewards` → `renderStandings` → `renderProfile` → mobil aktif durum.

Kanıtlanan sorunlar:

- Tek modül hatası tüm `Promise.all` yüklemesini durdurur; Futbol modülleri bağımsız hata sınırlarına sahip değil.
- Yazma sonrası çoğu akış `loadAllData()` + geniş render yapıyor.
- `renderMarketPulse()` ve `renderMythosProducts()` hem `boot()` başında hem `renderAll()` içinde tekrar çağrılıyor.
- 69 adet `innerHTML =` ve 57 inline event handler var; güncelleme alanı gereğinden geniş.

## 5. Auth ve kullanıcı akışı

- Kayıt: `auth.signUp` → oturum varsa `profiles.upsert`; e-posta doğrulaması gerekiyorsa pending mesajı.
- Giriş: `signInWithPassword` → `ensureOwnProfile`; profil kurulamazsa çıkış.
- Oturum: yalnız `loadAllData()` sırasında `getSession`; `onAuthStateChange` yok.
- Takım değişimi: kullanıcı başına sezonda bir kez varsayımı `team_changed` alanıyla istemcide ve beklenen RLS ile korunuyor.
- Profil ve çıkış masaüstünde doğrudan header butonu; mobilde Profil ayrı alt navigasyon öğesi. Bu ürün anayasasına aykırı.
- Auth ve Maç Merkezi dialoglarında focus trap, ilk odak ve odak geri dönüşü yok.

## 6. Tahmin akışı

- `savePrediction()` kullanıcı, maç, durum, 15 dakika kilidi, 1/X/2 ve skor aralığını istemcide doğruluyor.
- Upsert anahtarı `match_id,user_id`.
- Başarılı gönderimden sonra `submitPrediction()` akışı veriyi yeniden yükleyip render ediyor; optimistic state yok.
- Kilit `isLocked(kickoff) = now >= kickoff - 15 dakika`.
- Puanlama `computeMatchPoints`: doğru sonuç 3, kesin skor ek 5, yanlış sonuçta doğru gol farkı 1; haftayı eksiksiz tamamlama 2 puan.
- `scripts/check.mjs` kesin skor toplamının 8 olmasını ve temel tie-break davranışını test ediyor.
- Sunucu tarafı tahmin kilidi/RLS SQL’i repoda bulunmadığından istemci kontrolünün backend karşılığı bu analizde doğrulanamadı.

## 7. Maç verisi akışı

- Ana fikstür ve sonuçlar Supabase tablolarından gelir.
- Canlı akış yalnız Canlı sekmesi açılınca `football-live` Edge Function’ı 60 saniyede bir çağırır.
- Edge Function API-Football/Sportmonks verisini ortak tipe normalize eder, Süper Lig’i filtreler, cache ve stale fallback uygular.
- Maç Merkezi `match_lineups`, `match_absences`, `model_predictions` ve anonim consensus RPC’yi lazy-load eder.
- `match_events` frontend tarafından hiç sorgulanmıyor; Maç Akışı sabit boş durum.
- `modelPred` ve `consensus` yükleniyor fakat görünen `renderMcPredictions()` bunları kullanmıyor; puan durumundan yerel matematik üretir.

## 8. Kritik fonksiyonlar ve çağrıldıkları yerler

| Fonksiyon | Çağrı/etki | Koruma gereği |
|---|---|---|
| `loadAllData` | `boot`, auth/yazma sonrası yenilemeler | Sorgu ve state sözleşmesi korunmalı |
| `renderAll` | `boot`, takım/admin/tahmin yazmaları | Görsel refactor öncesi davranış testi gerekli |
| `registerUser`, `loginUser`, `ensureOwnProfile`, `logoutUser` | Auth modal/header | Auth/RLS ile birlikte korunmalı |
| `savePrediction`, `isLocked` | Predict satırları | Kilit hem UI hem RLS seviyesinde korunmalı |
| `computeMatchPoints` | Haftalık, lifetime, leaderboard | Değişmez çekirdek; mevcut test genişletilmeli |
| `userStatsForWeek`, `lifetimeStats`, `leaderboardFor`, `sortRows` | Predict/profil/liderlik | Tie-break ve performans testleri gerekli |
| `parseHash`, `updateHash`, hashchange listener | Hafta/Maç Merkezi | Geri tuşu ve alias testleri gerekli |
| `ensureMcData`, `openMatchCenter`, `renderMc*` | Maç detay | Gizlilik ve stale async render riski var |
| `loadLiveFeed`, `startLiveFeed`, `stopLiveFeed` | Canlı sekmesi | Adaptör sözleşmesi korunmalı |
| `renderNav`, `switchMainTab`, `switchLeagueSection`, `mbnGo` | Navigasyon | Phase 1 ana değişiklik alanı |

## 9. RLS ve güvenlik yapısı

Doğrulanan:

- İstemcide anon/publishable anahtar var; service-role istemci kodunda görülmedi.
- `live_feed_cache` için RLS açık ve `anon/authenticated` erişimi revoke edilmiş.
- Edge Function service role’ü yalnız sunucuda cache için kullanıyor.
- CORS origin allowlist ve secret’ların environment üzerinden okunması mevcut.
- Worker `nosniff`, referrer ve permissions policy header’ları ekliyor.

Doğrulanamayan/kritik:

- `profiles`, `predictions`, `results`, admin tabloları ve consensus RPC’nin gerçek migration/policy SQL’i repoda yok.
- `supabase/config.toml` içinde `football-live` için `verify_jwt = false`; endpoint public. Bu canlı skor okuma için bilinçli olabilir, ancak rate limiting ve abuse koruması ayrıca gerekir.
- Kullanıcı ve veritabanı alanları (`username`, takım/maç/stadyum/hakem, haber/hikâye, ödül, kadro/oyuncu/kaynak vb.) çok sayıda yerde escape/sanitize edilmeden `innerHTML` içine giriyor. Kullanıcının kendi profil adını yazabilmesi nedeniyle kalıcı XSS olasılığı yüksektir.
- `escapeLiveHTML` yalnız canlı sağlayıcı verisinde kullanılıyor; genel render zincirini korumuyor.
- URL doğrulama ortak bir politika değil. Canlı logo için sınırlı kontrol var; diğer uzak görseller hard-coded.
- CSP ve HSTS worker’da görünmüyor.

## 10. Korunması zorunlu davranışlar

- Vanilla JS + Supabase + hash routing + mevcut hosting.
- Kayıt/giriş/oturum ve kendi profilini oluşturma.
- Takım seçimi ve tek değişim davranışı.
- Tahmin upsert’i, kickoff eksi 15 dakika kilidi ve maç başladıktan sonra değişiklik yasağı.
- Başkalarının tahminlerini erken göstermeyen RLS/RPC davranışı.
- `computeMatchPoints` ve tie-break sırası.
- Haftalık/genel/takım liderlik hesapları.
- Maç Merkezi ve Futbol ekranından bağlamlı açılış.
- Sağlayıcı adaptörü ve secret’ların sunucuda kalması.
- Null veriyi sıfıra çevirmeme ve dürüst boş durumlar.
- Mythos Cards’ın yalnız ücretsiz ödül sponsoru olması.
- Normal kullanıcıdan admin erişimini hem UI hem backend’de kapatma.

## 11. Kullanılmayan veya tekrar eden kodlar

- `model_predictions` ve consensus verisi `ensureMcData` ile çekiliyor ama mevcut görünümde kullanılmıyor.
- `match_events` şeması belgede var; frontend sorgusu yok.
- `renderMarketPulse`/`renderMythosProducts` boot sırasında iki kez çalışıyor.
- Statik Mythos ilk markup’ı JavaScript render’ıyla yeniden yazılıyor.
- `VIDEO_CONFIG` tamamen boş; video bölümü fiilen boş durum.
- 57 inline handler ve ayrıca dinamik `.onclick` atamaları bakım ve erişilebilirlik yükü yaratıyor.
- Devir teslim belgesindeki ana dosya adı/satır sayısı güncel değil.

## 12. Production ortamında görünen mock/statik içerikler

Kritik production blocker:

- `MARKET_DATA.transfers`: oyuncu, kulüp ve bonservis bedelleri hard-coded.
- `MARKET_DATA.watchlist`: transfer söylentileri ve durum etiketleri hard-coded.
- `MARKET_DATA.performers`: oyuncu puanları hard-coded.
- Sabit 2026 transfer kapanış sayacı.
- `VERIFIED` tek bir sabit kaynak/tarih nesnesi; doğrulanmış her maçta aynı kaynak gösterilebiliyor.
- Hard-coded Mythos ödül adları, içerikleri, nadirlik/garanti iddiaları ve kampanya koşulları veritabanı doğrulamasına bağlı değil.
- Hero ve kampanya alanlarında gerçekliği veritabanıyla doğrulanmayan ödül/çekiliş vaatleri var.

Bu alanlar test fixture olarak işaretli değil ve production build’e dahil.

## 13. Çalışmayan butonlar ve rotalar

- Ana ürün sekmeleri hash’e yazılmıyor; doğrudan bağlantı ve browser back yalnız `week`/`match` için var.
- `Hikâyeler` yeni route değil; aynı sayfaya scroll ediyor.
- Maç Akışı sekmesi her zaman placeholder.
- Video config boş; video deneyimi aktif değil.
- Chat, haber detayı, gerçek haber akışı ve takım/oyuncu sayfaları mevcut değil.
- `modelPred/consensus` yüklenmesine rağmen Veri Modeli görünümü gerçek bu kayıtları göstermiyor.
- Canlı site görsel kontrolünde console error ve yatay document overflow görülmedi; butonların tamamı bu salt okunur aşamada tek tek tetiklenmedi.

## 14. UX problemleri

- Ürün anayasasına rağmen desktop ana navigasyonda `Maç Merkezi`, `Tahmin Ligi`, `Hikâyeler`, `Canlı` olmak üzere 4 alan var.
- Mobil alt navigasyonda `Hikâye`, `Tahmin`, `Liderlik`, `Canlı`, `Profil` olmak üzere 5 alan var.
- Futbol içeriğinden önce sponsor hero ve çok sayıda kampanya/ürün vitrini geliyor.
- 1440×900’de gerçek ana içerik yaklaşık 523 px, 390×844’te yaklaşık 550 px aşağıda başlıyor.
- Aynı ekranda üst ana sekmeler ve mobil alt sekmeler bilgi mimarisini tekrar ediyor.
- Sponsor içeriği futbol veri ürününden daha baskın.
- Genel `loadAllData` hatası modül bazlı iyileşmeye izin vermiyor.
- Profil, ödüller, liderlik ve canlı ayrı ana deneyim gibi sunuluyor.

## 15. Görsel problemler

- İlk viewport büyük sponsor hero tarafından domine ediliyor; gerçek futbol içeriği ikincil.
- Çok sayıda büyük, yuvarlak, iç içe kampanya/kart yüzeyi var.
- Görsel dil premium olsa da e-ticaret/kampanya vitrini çağrışımı ürün vaadini gölgeliyor.
- Altın/ödül vurgusu kontrolsüz biçimde tekrarlanıyor.
- Masaüstünde yatay taşma yok; 1440 genişlikte yapı teknik olarak oturuyor.

## 16. Performans problemleri

- Tek 179 KB HTML içinde tüm CSS/JS; cache ayrımı ve kod bölme yok.
- Her açılışta sekiz tam tablo sorgusu; filtre/kolon seçimi sınırlı değil (`select('*')`).
- Tüm profiller ve RLS’nin izin verdiği tüm tahminler istemciye çekilip liderlik yerelde hesaplanıyor.
- Liderlikte her profil için tekrar `lifetimeStats` → haftalar → maçlar dolaşılıyor; veri büyüdükçe maliyet hızla artar.
- Geniş `innerHTML` yeniden oluşturmaları ve inline handler’lar var.
- Maç Merkezi dört sorguyu birlikte çalıştırıyor; model/consensus sonucu kullanılmadığı halde ağ maliyeti yaratıyor.
- `ensureMcData` başarısız sonucu cache’lemiyor; tekrar sekme açılışında yeniden sorgu riski var.
- Görsellerin çoğunda lazy loading var; üst hero dış kaynak görselleri ağ/lisans bağımlılığı taşıyor.

## 17. Mobil problemler

- 360, 390, 430 ve 768 px ölçümlerde document düzeyinde yatay taşma görülmedi.
- 390 px ekran görüntüsünde üst navigasyon sağdan kesiliyor; `Canlı` kısmen görünür.
- Mobilde üstte 4 ve altta 5 navigasyon öğesi aynı anda var.
- Ürün takım filtreleri yaklaşık 30 px yükseklik; 44 px dokunma hedefini karşılamıyor.
- Alt bar safe-area hesabı mevcut ve viewport altına oturuyor.
- 360×800’de ana `.wrap` içerik başlangıcı yaklaşık 592 px; ilk ekranda ürünün asıl verisi yok.

## 18. Erişilebilirlik problemleri

- Auth ve Maç Merkezi modalında focus trap yok; açılış odağı ve kapanışta odak geri dönüşü yok.
- Sekmelerin çoğunda `tablist/tab/aria-selected/aria-controls` semantiği yok.
- Bazı tıklanabilir öğeler `div role=button`; global keydown ile telafi ediliyor.
- `authSwitch` tıklanabilir `span`; doğal klavye kontrolü değil.
- Dinamik hata ve kayıt durumlarının çoğunda `aria-live` yok.
- 30 px yüksekliğindeki ürün filtreleri dokunma erişilebilirliğini karşılamıyor.
- Focus ring tanımlı ve form/düğmelerin çoğu en az 44 px; bu olumlu davranış korunmalı.

## 19. İki ana ekran mimarisine geçişte değişecek dosyalar

Birincil:

- `index.html`: header, ana sekmeler, mobil alt bar, route state, hesap drawer’ı, Futbol/Predict içerik yerleşimi, güvenli render yardımcıları.
- `scripts/check.mjs`: iki ana alan, route alias, admin görünürlüğü, XSS kaçışlama, 44 px hedefler ve korunan puanlama testleri.

İkincil:

- `README.md` ve `docs/XYZSKOR-devir-teslim.md`: yeni bilgi mimarisi ve güncel dosya/komutlar.
- `worker/index.js`: CSP/HSTS değerlendirmesi; davranış değişmeden önce harici kaynak envanteri.
- `package.json` / scriptler: platform bağımsız check/dev komutları.

Bu phase’de doğrudan değişmemesi gerekenler:

- `supabase/migrations/**`, core RLS/auth/policy.
- `supabase/functions/football-live/index.ts` adaptör sözleşmesi.
- `computeMatchPoints`, tahmin kilidi ve liderlik sıralama davranışı.

## 20. Risk matrisi

| Risk | Olasılık | Etki | Seviye | Phase 1 kararı |
|---|---:|---:|---|---|
| Stored XSS: DB/kullanıcı alanlarının raw `innerHTML` kullanımı | Yüksek | Kritik | Kritik | Önce ortak escape/safe DOM katmanı ve test |
| Core RLS/policy SQL’inin repoda olmaması | Orta | Kritik | Yüksek | Şema değiştirme; export/audit iste |
| Production statik transfer/söylenti/puan verisi | Kesin | Yüksek | Kritik | Kaldır veya gerçek backend’e bağlanana kadar dürüst boş durum |
| 4/5 ana navigasyon ve profil/canlı/liderlik ayrı sekmeleri | Kesin | Yüksek | Kritik | Futbol/Predict’e indir, alias koru |
| Tüm veri yüklemenin tek hata sınırı | Orta | Yüksek | Yüksek | Modül bazlı settled sonuç ve bağlamsal hata |
| Tahmin kilidinin backend karşılığının doğrulanamaması | Orta | Kritik | Yüksek | RLS SQL görülmeden değiştirme/yayınlama |
| Public Edge Function’da rate limit olmaması | Orta | Orta/Yüksek | Yüksek | Bu phase’de değiştirme; güvenlik planına al |
| Profil/admin UI DOM görünürlüğü | Kesin | Orta | Orta | Hesap drawer; admin DOM’u sadece admin için üret |
| Maç Merkezi async stale render | Orta | Orta | Orta | Açık match id kontrolü/abort koruması |
| Liderlik istemci hesaplama ölçeklenmesi | Orta | Orta | Orta | Önce ölç; davranışı değiştirmeden memoize |
| Harici görsel lisans/provenance | Orta | Yüksek | Yüksek | Kaynak/lisans envanteri olmadan production’da kullanma |
| Windows-only dev/check wrapper’ları | Yüksek | Düşük/Orta | Orta | Cross-platform npm script ekle |

## Phase 1 — dosya bazlı uygulanabilir plan

| Dosya yolu | Değişiklik amacı | Korunacak fonksiyonlar/sistemler | Risk | Test yöntemi |
|---|---|---|---|---|
| `scripts/check.mjs` | Değişiklik öncesi karakterizasyon testlerini genişlet | `computeMatchPoints`, tie-break, `isLocked`, hash parsing | Düşük | Node assert: kilit sınırları, puanlama, alias, admin görünürlüğü |
| `index.html` | Ana navigasyonu yalnız Futbol/Predict yap | `switchMainTab` çağrıları için geriye uyumlu alias; hash week/match | Orta | Desktop/mobile DOM assert + back/forward tarayıcı testi |
| `index.html` | Profil/ayar/çıkış/admin’i avatar hesap drawer’ına taşı | Auth, team change, admin RLS | Orta/Yüksek | Normal/admin oturum senaryoları; DOM’da admin yokluğu; focus trap/Escape |
| `index.html` | Statik transfer/söylenti/puan/kampanya vaatlerini production’dan kaldır | Gerçek Supabase ve live adapter verisi | Düşük | Build içinde `MARKET_DATA` ve doğrulanmamış sayı/metin denylist’i |
| `index.html` | Ortak `escapeHTML`, güvenli URL ve sınırlı renderer ekle | Canlı feed’in mevcut escape davranışı | Yüksek | XSS payload fixture’ları: username, team, reward, story, lineup/source |
| `index.html` | Futbol altında maç, haber/boş durum, transfer/boş durum ve puan özeti düzeni | Maç Merkezi, tarih/hafta state’i | Orta | 360/390/430/768/1280/1440 görsel ve iki dokunuş testi |
| `index.html` | Predict altında tahmin, liderlik, ödül, profil bağlantılarını yeniden hiyerarşile | save/lock/points/leaderboard | Orta | Misafir/kullanıcı, açık/kilitli/iptal maç senaryoları |
| `index.html` | Modül bazlı veri hata sınırları; `Promise.allSettled` benzeri kontrollü akış | Başarılı modüllerin verisi | Orta | Her tablo sorgusunu tek tek fail eden stub testleri |
| `index.html` | Maç Merkezi async guard ve kullanılmayan veri çağrılarını düzelt | Consensus gizliliği ve cache | Orta | Hızlı maç/sekme geçişi, kapatma sonrası stale yazma testi |
| `package.json`, `scripts/*` | Platform bağımsız `npm run check` ve yerel sunucu | Mevcut build çıktısı | Düşük | macOS/Linux/Windows komut matrisi |
| `worker/index.js` | CSP için önce report-only/uyumluluk planı | Supabase, font, arma ve sponsor görselleri | Orta | Header snapshot ve tarayıcı console/network kontrolü |
| `README.md`, `docs/XYZSKOR-devir-teslim.md` | İki alan mimarisi ve güncel komutları belgelemek | Sağlayıcı ve güvenlik ilkeleri | Düşük | Doküman link/komut doğrulaması |

## Phase 1 kabul kapısı

- Desktop ve mobilde görünür ana ürün seçenekleri yalnız `Futbol` ve `Predict`.
- Profil ve admin ana sekme değil; normal kullanıcı DOM’unda admin kontrolü yok.
- Statik transfer, söylenti, oyuncu puanı ve doğrulanmamış ödül vaatleri production’da yok.
- `computeMatchPoints`, tahmin kilidi, auth, takım seçimi ve Maç Merkezi karakterizasyon testleri geçiyor.
- DB’den gelen metinlerde XSS fixture’ları çalışmıyor.
- 360/390/430/768/1280/1440 genişliklerinde yatay taşma yok; dokunma hedefleri en az 44 px.
- Core şema/RLS/auth migration’ları görülmeden bu alanlarda değişiklik yapılmıyor.
