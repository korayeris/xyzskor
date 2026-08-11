# XYZSKOR API ve Otomasyon Planı

Bu belge, XYZSKOR'un tüm branşlarda güncel kalırken API kotasını ve aylık maliyeti kontrollü tutması için uygulanacak veri mimarisini tanımlar.

## 1. Temel ilkeler

1. Her branşın kendi sağlayıcısı ve cache anahtarı vardır.
2. Futbol verisi voleybol, basketbol veya UFC sayfasına taşınamaz.
3. Son doğrulanmış veri korunabilir; sahte canlı veri üretilemez.
4. Canlı polling yalnızca gerçekten canlı etkinlik varken hızlanır.
5. Takvim ve profil verileri gereksiz yere tekrar çekilmez.
6. Tüm kayıtlarda `sport`, `competition`, `provider`, `provider_id`, `updated_at` ve `status` bulunur.
7. Secret'lar yalnızca Worker/Supabase/Sites sunucu ortamında tutulur.

## 2. Sağlayıcı görev dağılımı

### Sportmonks Football

Ana futbol kaynağıdır.

- Ligler ve sezonlar
- Fikstür ve sonuçlar
- Canlı skor ve dakika
- Gol, kart, oyuncu değişikliği ve VAR olayları
- Kadro, diziliş ve oyuncu bilgileri
- Maç istatistikleri
- Puan durumu
- Takım, lig ve mevcutsa oyuncu görselleri
- Hakem, saha, hava ve sakatlık alanları (paket kapsamına göre)

Canlı route: `/api/football/live`

Sezon route: `/api/football/season`

Maç route: `/api/football/fixture?id=...`

### API-Sports

Çoklu spor kapsamı için kullanılır.

- Basketbol: NBA, EuroLeague, Basketbol Süper Ligi ve sağlayıcı paketindeki diğer ligler
- Voleybol: Sultanlar Ligi, Efeler Ligi, CEV ve uluslararası organizasyonlar
- Buz hokeyi
- Hentbol
- Beyzbol
- Amerikan futbolu
- Rugby ve desteklenen diğer branşlar

Her endpoint yanıtı ortak XYZSKOR etkinlik şemasına normalize edilir. Branşa ait veri yoksa sayfa son doğrulanmış kaydı veya açık bir “veri bekleniyor” durumunu gösterir.

### Cito UFC

UFC merkezinin ana kaynağıdır.

- Yaklaşan ve son etkinlikler
- UFC numaralı etkinlik sayfaları
- Dövüş kartı ve bout detayları
- Dövüşçü profil, boy, kilo, reach, stance ve record
- Dövüş geçmişi
- Striking ve grappling istatistikleri
- Sıralamalar
- Round istatistikleri
- Sağlayıcı planı uygunsa canlı state, SSE veya WebSocket
- Oranlar yalnız Predict/model girdisi olarak

REST cache günlük kullanım için yeterlidir. WebSocket yalnız etkinlik gecesinde ve ücretli erişim aktifse açılır.

### OpenBlacktop

Motor sporları veri katmanıdır.

- Formula 1
- Formula E
- IndyCar
- MotoGP, Moto2 ve Moto3
- WRC
- WEC ve Le Mans
- NASCAR Cup Series
- Takvim, sonuç, sıralama, sürücü ve takım verileri (paket kapsamına göre)

Hobby planında önce tam bir snapshot alınır. Kullanıcı açıkça yenileme istemedikçe tarihsel veri tekrar çekilmez. Yaklaşan yarış haftasında yalnız gerekli endpoint'ler yenilenir.

### Sosyal ve medya API'leri

`X_BEARER_TOKEN`:

- Lig başına sınırlı sayıda resmî hesap
- Başarılı yanıtlar 24 saat cache
- Kredi biterse son doğrulanmış içerik korunur

`YOUTUBE_API_KEY`:

- Resmî kanal videoları
- Video başlığı, yayın tarihi ve kapak görseli
- Günlük kontrollü yenileme

Instagram Graph API:

- Yalnız izinli Business/Creator hesabı
- Bağlı Facebook sayfası
- Desteklenen hashtag veya hesaba ait medya
- Başka kulüplerin özel verisini aşan scraping yapılmaz

## 3. Akıllı polling ve cache

| Veri sınıfı | Önerilen yenileme | Cache yaklaşımı |
| --- | --- | --- |
| Futbol canlı skor | 5 saniye | 5 saniye ortak edge cache |
| Canlı olay/istatistik | 5-10 saniye | Etkinlik kimliği bazlı |
| Yaklaşan futbol fikstürü | 2-15 dakika | Sezon + lig anahtarı |
| Puan durumu | 5-15 dakika, maç sonrası zorla yenile | Lig + sezon |
| Takım/sporcu profili | 12-24 saat | Provider ID bazlı |
| Basketbol/voleybol canlı | 15-30 saniye | Yalnız canlı liglerde |
| Diğer branş canlı | 30-60 saniye | Yalnız etkinlik sürerken |
| Motor sporları takvimi | 6-24 saat | Seri + sezon |
| Motor sporları canlı | Paket destekliyorsa 15-30 saniye | Yarış hafta sonu açık |
| UFC yaklaşan etkinlik | 6 saat | Etkinlik slug'ı |
| UFC canlı | WebSocket/SSE veya 5-15 saniye REST | Yalnız event night |
| X akışı | 24 saat | Lig + hesap |
| YouTube | 6-24 saat | Kanal + playlist |
| Instagram | 1-6 saat | Hesap/hashtag |
| Görsel metadata | 24 saat-7 gün | URL + lisans kaynağı |

Kullanıcı sayısı artsa bile tarayıcıların tamamı sağlayıcıya gitmez. İstekler Worker edge-cache üzerinde birleşir.

## 4. Canlı maç akışı

1. Sezon endpoint'i yaklaşan karşılaşmayı ve provider fixture ID'sini kaydeder.
2. Maçtan 15 dakika önce canlı takip modu hazırlanır.
3. Canlı endpoint yalnız in-play kayıtlarını döndürür.
4. Skor, dakika ve olaylar ID üzerinden mevcut fikstürle birleştirilir.
5. Maç bitince sonuç kalıcı sezon verisine yazılır veya bir sonraki sezon senkronunda kesinleşir.
6. Puan durumu ve Predict puanları sonuç doğrulandıktan sonra güncellenir.

Sağlayıcı gecikmesi ve kapsama seviyesi kullanıcıya yansıtılır. “Canlı” etiketi yalnız canlı endpoint kaydı varsa gösterilir.

## 5. Görsel planı

Önce sağlayıcının verdiği lisanslı takım, lig, sürücü veya sporcu URL'si kullanılır. Görsel yoksa:

1. Resmî izinli embed
2. Açık lisanslı medya
3. Projeye ait/generatif branş arka planı
4. Tipografik placeholder

Sportradar Images gibi ayrı medya ürünleri satın alınmadan kapsam vaat edilmez. Görseller proxy üzerinden çekilecekse sağlayıcı sözleşmesindeki cache ve yeniden dağıtım maddeleri ayrıca onaylanır.

## 6. Yaklaşık 220 USD yükseltme senaryosu

Fiyatlar sağlayıcı, lig kapsamı ve faturalama dönemine göre değişir. Satın alımdan önce panellerden tekrar doğrulanmalıdır.

| Kalem | Hedef pay |
| --- | --- |
| Geniş futbol canlı veri paketi | 80-100 USD |
| Çoklu spor paketi | 30-50 USD |
| UFC profil/istatistik/canlı eklentileri | 20-40 USD |
| Motor sporları Hobby | Yaklaşık 9 USD |
| Görsel/medya veya ek kota | 0-40 USD |
| Beklenmeyen kota ve kur farkı tamponu | Kalan bütçe |

Öncelik sırası:

1. Canlı futbol ve maç istatistikleri
2. Basketbol ve voleybol ana ligleri
3. UFC etkinlik/profil verileri
4. Motor sporları takvim ve sıralama
5. Oyuncu/sürücü görsel lisansları
6. Daha az izlenen branşların canlı eklentileri

## 7. Veri kalite kapıları

Bir kayıt yayına çıkmadan önce:

- Branş eşleşmesi doğru olmalı.
- Takım/sporcu adları nesne olarak değil metin olarak normalize edilmeli.
- Provider ID bulunmalı.
- Tarih UTC saklanıp Türkiye saatinde gösterilmeli.
- Görsel URL'sinin kaynağı ve kullanım hakkı bilinmeli.
- “Canlı” durumu provider state ile doğrulanmalı.
- Eski cache görünüyorsa güncellenme zamanı gösterilmeli.
- Boş veri başka branştan fallback ile doldurulmamalı.

## 8. Operasyon

- Sağlayıcı kota ve hata oranları günlük izlenir.
- 401/403 durumunda secret ve paket kapsamı kontrol edilir.
- 429 durumunda polling yavaşlatılır ve edge-cache süresi artırılır.
- 5xx durumunda son doğrulanmış cache gösterilir.
- X kredisi kontrollü tutulur; günlük limit aşılmaz.
- Production secret değişiklikleri Git dışında kaydedilir.
- Yeni branş önce staging'de branş ayrımı ve veri şeması testinden geçer.

