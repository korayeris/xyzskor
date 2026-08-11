# XYZSKOR

XYZSKOR; futbol, basketbol, voleybol, motor sporları, UFC ve diğer spor branşlarını tek bir koyu, teknik ve mobil uyumlu yayın deneyiminde birleştiren canlı spor ve ücretsiz tahmin platformudur.

Canlı site: <https://xyzskor-tr.korayeris2002.chatgpt.site>

## Ürün kapsamı

Ana navigasyon:

1. Futbol
2. Basketbol
3. Voleybol
4. Motor Sporları
5. UFC
6. Amerikan Futbolu
7. Diğer Branşlar
8. Predict

Temel özellikler:

- Canlı skor, dakika, olay, kadro ve maç istatistikleri
- Fikstür, sonuç, puan durumu, takım ve sporcu profilleri
- Formula 1, MotoGP, WRC, WEC ve NASCAR yarış takvimleri
- UFC etkinlikleri, dövüş kartları, dövüşçü profilleri ve sıralamalar
- Resmî sosyal medya ve video akışları
- Ücretsiz Predict yarışması, puanlama ve ödül talepleri
- Üye, admin ve editoryal yetkilendirme
- Mobil ve masaüstü için ortak responsive tasarım

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
| `assets/css/membership.css` | Üyelik, hesap merkezi ve admin paneli görsel katmanı |
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

## Üyelik ve yönetim merkezi

Üyelik sistemi Supabase Auth üzerindeki `auth.users` kayıtlarını, RLS korumalı
`public.profiles` ve üyelik operasyon tablolarıyla ilişkilendirir. Kullanıcı
parolaları uygulama veritabanında tutulmaz ve admin arayüzüne açılmaz.

Üye hesabında bulunan özellikler:

- E-posta doğrulamalı kayıt, giriş, çıkış ve şifre sıfırlama
- Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma onayı
- Profil bilgileri, takım seçimi, takip edilen takımlar ve bildirim tercihleri
- Tahmin geçmişi, puanlar, rozetler ve hak kazanılmış ödüller
- KVKK erişim, düzeltme, silme, kısıtlama, itiraz ve dışa aktarma talepleri

Site içindeki admin yönetim merkezi:

- Üye arama, aktivite özeti ve admin/editoryal rol yönetimi
- Hesabı aktif, askıda veya kapalı duruma alma
- Ödül kampanyası oluşturma ve talep inceleme
- Herkese açık kampanya veya üyeye özel ödül hakkı tanımlama
- KVKK taleplerini inceleme ve üyeye yanıt özeti bırakma
- Hesap güvenliği olaylarını ve sınırlı risk puanlarını izleme

Askıya alınmış üyelerin tahmin, haftalık oyun ve ödül talebi yazma işlemleri
yalnız arayüzde değil, PostgreSQL RLS ve güvenli RPC katmanında da engellenir.
Admin hesap durumu, rol, ödül hakkı ve gizlilik talebi işlemleri audit kayıtlarına
yazılır. Süresi dolan ödül teslimat PII alanlarını temizleyen görev yalnız
`service_role` tarafından çalıştırılabilir.

### Veritabanını günlük yönetme

Günlük üye, rol, kampanya, ödül ve KVKK işlemleri için sitenin admin panelini
kullanın. Supabase Dashboard esas olarak teknik denetim içindir:

- `Authentication → Users`: Auth kullanıcılarını ve doğrulama durumunu görüntüleme
- `Table Editor`: RLS kapsamındaki operasyon tablolarını inceleme
- `Logs`: Auth, API ve Worker hatalarını araştırma
- `Backups`: Yedek durumunu kontrol etme

Canlı şemayı Table Editor veya SQL Editor üzerinden elle değiştirmeyin. Tüm
şema değişiklikleri `supabase/migrations/` altında sürümlenir ve tek sorumlu
tarafından uygulanır.

Bu üyelik sürümünün migration dosyası:

```text
supabase/migrations/20260811170000_membership_management_complete.sql
```

Yerel Supabase ortamında doğrulama ve bağlı canlı projeye uygulama:

```powershell
supabase db reset
supabase db push
```

`db push` öncesinde doğru Supabase projesine bağlı olduğunuzu doğrulayın ve
canlı yedek alın. Aynı anda yalnızca bir kişi migration uygulasın. Service-role
anahtarını tarayıcıya, istemci JavaScript dosyalarına veya Git geçmişine yazmayın.

## Git ve yayın

Kararlı kaynak dalı `main`'dir. Geliştirmeler konu dalında hazırlanıp pull
request ile birleştirilir.

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
