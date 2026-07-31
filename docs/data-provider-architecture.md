# XYZSKOR Veri Sağlayıcı Mimarisi

**Karar tarihi:** 31 Temmuz 2026  
**Durum:** Kabul edildi  
**Bugünkü entegrasyon:** API-Football (ücretsiz başlangıç)  
**Üretim hedefi:** Sportmonks  
**Gölge karşılaştırma:** Goalserve, 2–3 hafta  
**Geçiş yöntemi:** Ortam değişkeni; ön yüz değişmez  

## 1. Karar

XYZSKOR'un ilk canlı bağlantısı API-Football ücretsiz kotasıyla yapılır. Uygulama sağlayıcının ham alanlarını kullanmaz; `football-live` Edge Function bütün yanıtları ortak XYZSKOR şemasına çevirir. Üretimde Sportmonks'a geçmek için yalnızca `FOOTBALL_DATA_PROVIDER=sportmonks` ayarı ve Sportmonks secret'ları değiştirilir. Ön yüz, canlı kartlar ve puanlama kodu değişmez.

Uzun vadeli birinci tercih Sportmonks'tur. Goalserve aynı maçlarda kullanıcıya gösterilmeyen bir gölge akış olarak çalıştırılacak; canlı olay gecikmesi, kadro zamanı ve oyuncu uygunluk verisi Sportmonks ile ölçülecektir.

Sportmonks; Süper Lig, canlı skor, kadro, sakatlık/ceza, puan durumu ve gelişmiş istatistikleri aynı REST/JSON modeliyle sunuyor. V3 canlı skor uçları; katılımcılar, skorlar, olaylar, kadrolar, istatistikler, sidelined ve xG verilerini `include` ile aynı yanıta ekleyebiliyor. Sportmonks belgeleri `livescores/latest` akışının son 10 saniyede değişen maçları verdiğini, resmî kadroların genellikle başlama vuruşundan 60–75 dakika önce geldiğini belirtiyor.

Kaynaklar:

- [Sportmonks Süper Lig API](https://www.sportmonks.com/football-api/super-lig-api/)
- [Sportmonks livescores uçları](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/livescores)
- [Sportmonks kadro ve formasyonları](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/lineups-and-formations)
- [Sportmonks rate limit yapısı](https://docs.sportmonks.com/v3/api/rate-limit)
- [Goalserve futbol veri kapsamı](https://www.goalserve.com/itout-us/sport-data-feeds/football-api/description/5)

## 2. Güvenli veri akışı

```text
API-Football ─┐
Sportmonks ───┼─> football-live Edge Function ─> XYZSKOR şeması ─> 15 dk sunucu cache ─> web uygulaması
Goalserve ────┘                                      └─> provider_observations (gölge ölçüm)
```

- Sağlayıcı anahtarları yalnızca Supabase Edge Function secret'larında tutulur.
- Tarayıcı API-Football, Sportmonks veya Goalserve'e doğrudan istek göndermez.
- `service_role` ve sağlayıcı token'ları `index.html`, Git veya istemci loglarına yazılmaz.
- Kullanıcı arayüzü yalnızca normalleştirilmiş Supabase tablolarını okur.
- Goalserve verisi karşılaştırma süresinde kullanıcıya yayımlanmaz; kalite ölçümü için saklanır.
- İlk sürümde bahis oranları ve sağlayıcı tahminleri alınmaz. XYZSKOR matematiği; skor, olay, kadro, puan durumu ve xG gibi ham/spor verileriyle çalışır.

Önerilen Edge Function secret'ları:

```text
FOOTBALL_DATA_PROVIDER=api-football
API_FOOTBALL_KEY
SPORTMONKS_API_TOKEN
SPORTMONKS_LEAGUE_IDS
LIVE_CACHE_SECONDS=900
LIVE_ALLOWED_ORIGINS
```

Uygulama içinde sağlayıcı bağlantısı veya reklamı gösterilmez. API-Football ücretsiz kotasında varsayılan cache 900 saniyedir; böylece açık sekme sayısı yukarı akış çağrı sayısını artırmaz. Ücretli canlı pakete geçildiğinde cache süresi sağlayıcı limitine göre düşürülebilir.

## 3. Sağlayıcı adaptörü

Her sağlayıcı aynı iç sözleşmeye çevrilmelidir:

```ts
type ProviderAdapter = {
  getFixtures(windowStart: string, windowEnd: string): Promise<Fixture[]>;
  getLiveChanges(): Promise<LiveFixture[]>;
  getLineups(providerFixtureId: string): Promise<Lineup[]>;
  getAvailability(providerFixtureId: string): Promise<PlayerAvailability[]>;
  getStandings(seasonId: string): Promise<Standing[]>;
};
```

Sportmonks canlı örnek isteği:

```text
GET /v3/football/livescores/latest
  ?include=participants;scores;events;lineups;formations;statistics;xGFixture;sidelined.sideline
```

Uygulama Sportmonks alan adlarını doğrudan kullanmamalıdır. Dış kimlikler `provider_fixture_map` üzerinden XYZSKOR maç kimliğine bağlanır. Böylece sağlayıcı değişse bile ön yüz ve puanlama mantığı değişmez.

Mevcut kod:

- `supabase/functions/football-live/index.ts`: API-Football ve Sportmonks adaptörleri
- `supabase/migrations/20260731_live_feed_cache.sql`: kota koruyan sunucu önbelleği
- `supabase/functions/.env.example`: gereken secret adları
- `index.html` içindeki `loadLiveFeed()`: yalnızca normalize edilmiş Edge Function yanıtını okur

## 4. Oyuncu uygunluğu — zorunlu sınıflandırma

Tek bir `sakat` etiketi yasaktır. Her kayıt iki ayrı boyutta saklanır:

### Durum

| Kod | Arayüz etiketi | Anlam |
|---|---|---|
| `official_injury` | Resmî sakatlık | Kulüp, lig veya resmî organizasyonca doğrulanmış sakatlık |
| `probable_absence` | Muhtemel eksik | Basın/sağlayıcı kaydı var; resmî doğrulama yok |
| `suspended` | Cezalı | Kart veya disiplin cezası |
| `not_in_squad` | Maç kadrosunda yok | Oyuncu açıklanan kadroda yok; neden henüz belirlenmemiş |
| `technical_decision` | Teknik tercih | Teknik heyet kararı |
| `personal_reason` | Kişisel neden | İzin, ailevi veya benzeri neden |
| `unknown` | Doğrulanıyor | Yeterli bilgi yok |

### Doğrulama

| Kod | Anlam |
|---|---|
| `official` | Kulüp/lig/organizasyonun resmî kaydı |
| `provider` | Veri sağlayıcısı kaydı; resmî kaynak URL'si yok |
| `press_report` | Güvenilir basın kaydı |
| `unverified` | Kaynak veya neden doğrulanmamış |

Her kayıtta en az `source`, `checked_at`, `valid_until` ve varsa `source_url` bulunmalıdır. Eski `status=sakat` kayıtları otomatik olarak `official_injury` yapılmaz; `unknown`/`unverified` kabul edilir.

## 5. Veri doğruluğu kuralları

- Sağlayıcının `null` verdiği istatistik arayüzde `0` yapılmaz; “veri yok” olarak kalır.
- `expected lineup` ile `confirmed lineup` ayrı tutulur. Boş kadro dizisi hata sayılmaz; resmî kadro henüz açıklanmamış olabilir.
- Aynı olay tekrar gelirse `provider + external_event_id` ile idempotent upsert yapılır.
- Skor düzeltmeleri ve iptal edilen olaylar geçmişi ezmeden revizyon olarak kaydedilir.
- Saati sağlayıcıdan UTC al, veritabanında UTC sakla, arayüzde `Europe/Istanbul` göster.
- Puanlama yalnızca doğrulanmış maç sonucu üzerinden çalışır.
- Kaynaklar çelişirse öncelik: resmî organizasyon/kulüp > ana sağlayıcı > gölge sağlayıcı > basın.

## 6. Güncelleme sıklığı

| Zaman | Sportmonks ana akış | Goalserve gölge akış |
|---|---|---|
| Maçtan 24 saatten önce | Takvim/puan durumu 6 saatte bir | Günde 2 kez |
| Maça 24–2 saat | 15 dakikada bir | 15 dakikada bir |
| Maça 2 saat–başlama | 2 dakikada bir; kadro kontrolü | 2 dakikada bir |
| Canlı maç | `livescores/latest` 10 saniyede bir | Sağlayıcının izin verdiği en yakın periyot |
| Maç sonu | Sonuç + olay mutabakatı | Son karşılaştırma snapshot'ı |

Her çağrıda rate-limit başlıkları kaydedilir. Limitin yüzde 80'ine gelindiğinde düşük öncelikli puan durumu/tarihçe işleri ertelenir; canlı maç akışı korunur.

## 7. Goalserve 2–3 haftalık karşılaştırma

Karşılaştırma en az iki tam Süper Lig haftasını ve mümkünse bir yoğun Avrupa maç gününü kapsamalıdır.

| Ölçüm | Hesap |
|---|---|
| Olay gecikmesi p50/p95 | `received_at - observed_at` |
| İlk resmî kadro zamanı | Sağlayıcıda ilk görünme − resmî yayın zamanı |
| Kadro doğruluğu | Doğru oyuncu/rol / resmî kadrodaki toplam |
| Oyuncu uygunluğu kesinliği | Doğru durum sınıfı / incelenen kayıt |
| Yanlış resmî sakatlık | `official_injury` gösterilip resmî kanıtı olmayan kayıt sayısı |
| Canlı kapsam | Beklenen canlı maçlardan veri gelenlerin oranı |
| Düzeltme oranı | Sonradan değişen skor/olay / toplam olay |
| API güvenilirliği | Başarılı çağrı / toplam çağrı; p95 yanıt süresi |

İç kalite kapısı:

- Yanlış “resmî sakatlık” etiketi: **0 tolerans**
- Canlı skor/olay p95 gecikmesi: **15 saniye veya daha iyi**
- Açıklanmış resmî kadronun sağlayıcıda görünmesi: **p95 120 saniye veya daha iyi**
- Maç ve skor kapsamı: **%99,5 veya daha iyi**
- API başarılı çağrı oranı: **%99,9 veya daha iyi**

Eşikler XYZSKOR'un iç hedefidir; sağlayıcı pazarlama taahhüdü olarak yorumlanmaz. Son karar sadece ortalama hıza göre değil, doğruluk, lisans hakkı, çağrı limiti ve toplam yıllık maliyetle verilir.

## 8. Aşamalar

### Aşama 1 — şimdi

1. Sportmonks deneme/üretim hesabı ve Süper Lig + hedef Avrupa ligleri kapsam kontrolü.
2. Sunucu tarafı adapter ve kimlik eşleme tablosu.
3. Goalserve gölge adapteri ve `provider_observations` ölçümü.
4. Maç merkezi için canlı olay, resmî/muhtemel kadro ve oyuncu uygunluk akışı.
5. İki–üç hafta sonunda sağlayıcı karar raporu.

### Aşama 2 — üretim sertleştirme

- Kuyruk/retry, idempotency, hata alarmı, maliyet alarmı ve veri tazelik göstergesi.
- Veri kaynağı ve “son güncelleme” bilgisinin arayüzde görünmesi.
- Sağlayıcı sözleşmesinde web/mobil yayın ve sponsorlu içerik kullanım hakkının yazılı teyidi.

### Aşama 3 — 100.000+ düzenli kullanıcı

Stats Perform/Opta ve Sportradar'dan aynı kapsamla kurumsal teklif istenir: Süper Lig, dört büyük Avrupa ligi, UEFA organizasyonları, canlı gecikme garantisi, kadro/uygunluk, xG, ticari web-mobil yayın, sponsorlu içerik, limit, SLA, destek ve yıllık toplam lisans maliyeti.

## 9. Tamamlanma tanımı

Entegrasyon “bitti” sayılmaz; aşağıdakilerin hepsi gerekir:

- İstemci veya Git geçmişinde sağlayıcı anahtarı bulunmuyor.
- Süper Lig fikstürü iç kimliklerle eşlendi.
- Canlı skor ve olaylar tekrar üretmeden upsert ediliyor.
- Muhtemel ve resmî kadro ayrılıyor.
- Oyuncu uygunluğu yukarıdaki iki boyutlu sınıflandırmayı kullanıyor.
- `null` istatistikler sıfıra çevrilmiyor.
- Goalserve karşılaştırma raporu en az iki tam haftayı kapsıyor.
- Skor/olay gecikme, doğruluk, kapsam, maliyet ve lisans hakları birlikte onaylandı.
