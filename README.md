# XYZSKOR

XYZSKOR; koyu, teknik ve mobil uyumlu bir yayın deneyiminde canlı futbol
skorları, ücretsiz tahmin yarışması ve doğrulanmış sağlayıcı kapsamındaki çoklu
spor merkezlerini sunan bir platformdur.

Canlı site: <https://xyzskor-tr.korayeris2002.chatgpt.site>

## Ürün kapsamı

Ana navigasyon:

1. Futbol
2. Basketbol
3. Voleybol
4. Kayak
5. Motor Sporları
6. UFC
7. Amerikan Futbolu
8. Diğer: Buz Hokeyi, Rugby, Beyzbol, Hentbol, Avustralya Futbolu
9. Predict

Branş kabukları `sport-branches.js` tarafından oluşturulur. Çoklu spor sayfaları
yalnızca kendi sağlayıcı verisini gösterir; veri bulunmazsa başka branştan fallback
üretmek yerine açık bir “program bekleniyor” durumu yayınlar.

Temel özellikler (yayında):

- Canlı futbol skoru, dakika, olay, kadro ve maç istatistikleri
- Fikstür, sonuç, puan durumu, takım ve sporcu profilleri
- Resmî sosyal medya ve video akışları
- Ücretsiz Predict yarışması, puanlama ve ödül talepleri
- Üye, admin ve editoryal yetkilendirme
- Mobil ve masaüstü için ortak responsive tasarım

Branş merkezleri:

- Formula 1, Formula E, IndyCar, MotoGP, WRC, WEC, Le Mans ve NASCAR
- UFC etkinlikleri, dövüş kartları, dövüşçü profilleri ve sıralamalar
- Basketbol, voleybol, kayak ve diğer branşların maç, lig ve takım görünümleri

XYZSKOR bahis sitesi değildir. Oranlar yalnızca ücretsiz Predict oyununun istatistiksel girdisi ve karşılaştırma verisi olarak kullanılabilir. Para yatırma, kupon, bahis oynama veya ödeme akışı bulunmaz.

## Teknoloji

- Vanilla JavaScript ve CSS
- Cloudflare uyumlu Worker
- Supabase Auth, PostgreSQL, RLS ve RPC
- OpenAI Sites production dağıtımı
- Esbuild tabanlı production paketi

## Dizin yapısı

| Yol | Açıklama |
| --- | --- |
| `index.html` | Ana erişilebilir HTML kabuğu |
| `assets/css/app.css` | Tasarım sistemi ve responsive düzen |
| `assets/js/data.js` | Veri, Supabase ve sağlayıcı adaptörleri |
| `assets/js/live.js` | Canlı skor ve navigasyon akışı |
| `assets/js/ui.js` | Futbol ve ana arayüz render zinciri |
| `assets/js/multisport.js` | Çoklu spor branşları |
| `assets/js/motorsports.js` | Motor sporları sayfaları |
| `assets/js/ufc-hub.js` | UFC merkezi |
| `worker/index.js` | API proxy, cache, normalizasyon ve statik yayın |
| `supabase/` | Migration ve Edge Function kaynakları |
| `scripts/` | Geliştirme, build ve QA araçları |
| `docs/API-PLANI.md` | Ayrıntılı sağlayıcı, kota ve otomasyon planı |
| `legal/` | Hukuki ve lisans notları |

## Yerel çalıştırma

Gereksinimler:

- Node.js 20 veya üzeri
- npm

```powershell
npm install
npm run dev
```

Ardından `http://127.0.0.1:4173` adresini açın.

Node/npm PATH üzerinde değilse:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

## Production build

```powershell
npm run build
```

Çıktı `dist/` dizinine yazılır. `dist/`, `node_modules/`, loglar ve yayın arşivleri Git'e gönderilmez.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve yalnızca kullandığınız sağlayıcıları doldurun. Production secret'ları Sites/Supabase kontrol panelinde tutulmalıdır.

| Değişken | Amaç |
| --- | --- |
| `SPORTMONKS_API_TOKEN` | Futbol fikstürü, canlı skor ve istatistikler |
| `API_SPORTS_KEY` | Basketbol, voleybol, hokey ve diğer branşlar |
| `CITO_API_KEY` | UFC etkinlik, dövüşçü, sıralama ve istatistik verileri |
| `OCBLACKTOP_API_KEY` | Motor sporları takvim ve sonuç verileri |
| `X_BEARER_TOKEN` | Maliyet kontrollü resmî X akışı |
| `YOUTUBE_API_KEY` | Resmî video ve kapak görselleri |
| `INSTAGRAM_ACCESS_TOKEN` | İzinli Instagram Graph API erişimi |
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | Bağlı Business/Creator hesap kimliği |
| `SUPABASE_URL` | Supabase proje adresi |
| `SUPABASE_ANON_KEY` | İstemciye açık anonim anahtar |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca sunucuda kullanılan yetkili anahtar |

Secret, token, servis rolü anahtarı veya şifre hiçbir zaman kaynak koda, README'ye, `.openai/hosting.json` dosyasına ya da Git geçmişine yazılmaz.

## Canlı veri sözleşmesi

Futbolun kaynak otoritesi Sportmonks'tur. Arayüz sahte skor veya tahmini olay üretmez.

- Canlı maç sırasında istemci yaklaşık 5 saniyede bir XYZSKOR Worker'ına bakar.
- Worker canlı yanıtı 5 saniye edge-cache ile kullanıcılar arasında paylaşır.
- Normal sezon/fikstür paketi istemcide 2 dakika, edge üzerinde kontrollü süreyle tutulur.
- Maç başlamadıysa canlı endpoint'in boş dönmesi normaldir.
- Sağlayıcı kapsamındaki skor, dakika, gol, kart, kadro, diziliş, oyuncu, hakem, hava ve istatistik alanları normalize edilerek sunulur.
- Eksik sağlayıcı verisi başka bir branşın kaydıyla veya uydurma içerikle doldurulmaz.

Galatasaray - Çorum FK örneğinde sistem Sportmonks fikstür kimliği üzerinden karşılaşmayı eşleştirir. Maç sağlayıcı tarafından canlıya alındığında skor ve olaylar otomatik görünür.

## Görsel politikası

Öncelik sırası:

1. API sağlayıcısının lisanslı `image_path`/medya alanları
2. Kulüp, lig ve organizasyonların izinli resmî embed içerikleri
3. Projeye ait veya açık lisanslı görseller
4. Yapay zekâ ile üretilmiş, marka ve gerçek kişi taklidi içermeyen arka planlar
5. Görsel yoksa estetik, branşa özel tipografik placeholder

Sportradar Images veya benzeri ücretli medya paketleri ayrı lisans gerektirir. Lisans doğrulanmadan görsel indirilemez, yeniden dağıtılamaz veya “aktif” gösterilemez.

## Veri otomasyonu

Sistem insan müdahalesi olmadan çalışacak şekilde tasarlanır:

- Canlı etkinlik varken kısa aralık
- Yaklaşan etkinliklerde orta aralık
- Takvim, takım ve sporcu profilinde uzun cache
- X/Instagram/YouTube akışlarında günlük veya kontrollü yenileme
- API başarısızlığında son doğrulanmış cache
- Her kayıtta sağlayıcı, güncellenme zamanı ve branş kimliği

Ayrıntılı plan: [docs/API-PLANI.md](docs/API-PLANI.md)

## Supabase güvenliği

- Tablolarda RLS aktiftir.
- Admin işlemleri sunucu RPC'leri üzerinden yürür.
- Kullanıcı e-postaları yalnızca yetkili admin işlemlerinde döner.
- Admin kendi admin yetkisini arayüzden kaldıramaz.
- Yetki ve ödül işlemleri audit loglarına yazılır.
- Predict puanlama ve ödül talepleri yalnızca sunucu tarafında kesinleşir.

## Git ve yayın

Kaynak dalı: `main`

```powershell
git add .
git commit -m "Açıklayıcı değişiklik mesajı"
git push origin main
```

Production dağıtımı `.openai/hosting.json` içindeki mevcut Sites projesine yapılır. Build arşivleri ve geçici paketler Git'e eklenmez.

## Dokümantasyon

- [API planı](docs/API-PLANI.md)
- [Veri sağlayıcı mimarisi](docs/data-provider-architecture.md)
- [API envanteri ve satın alım notu](docs/api-envanteri-ve-satin-alim-notu-2026-08-04.md)
- [Profesyonel devir teslim](docs/professional-handoff-2026-08-03.md)
- [Supabase migration runbook](docs/supabase-migration-runbook.md)
- [Secret operasyon şablonu](docs/ops-secrets-ledger-template.md)

## Hukuki sınırlar

- Sağlayıcı sözleşmesi izin vermediği veriyi cache'leme veya yeniden dağıtma.
- Oyuncu ve takım görsellerini yalnızca lisanslı/izinli kaynaktan kullan.
- Sosyal medya içeriğini platformun resmî API veya embed sistemiyle göster.
- Oranları bahis çağrısı olarak değil, ücretsiz tahmin verisi olarak sun.
- Kaynak, güncelleme zamanı ve veri durumu kullanıcıya görünür olmalıdır.
