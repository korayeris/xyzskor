# XYZSKOR Test Tools

Bu klasor, `xyzskortestaraclari.zip` icinden alinan QA araclarini repo icine kalici olarak baglar.

## Kurulum

Yeni bilgisayarda once proje bagimliliklarini kur:

```powershell
npm install
```

Playwright tarayici binary eksikse:

```powershell
npx playwright install chromium
```

Playwright proje bağımlılıklarında varsa test araçları paketi otomatik olarak kullanır.

## Komutlar

```powershell
npm run qa:api
npm run qa:visual
npm run qa:visual:data
npm run qa:chat
npm run qa:instagram
npm run qa:match-center
npm run qa:perf
npm run qa:dist
```

## Port Beklentisi

`qa:visual`, `qa:chat`, `qa:instagram`, `qa:match-center` ve `qa:perf` icin yerel site `http://127.0.0.1:4173` adresinde acik olmali.

`qa:dist` icin production build `http://127.0.0.1:4180` adresinde acik olmali.

## Kapsam

- `qa:api`: Worker API endpointlerini Sportmonks, X, YouTube ve Instagram mock cevaplariyla test eder.
- `qa:visual`: Desktop ve mobil DOM, console ve network hata kontrolu yapar.
- `qa:visual:data`: Dolu mock data ile gorsel akisi test eder.
- `qa:chat`: Chat panelinin bos servis ve dolu Supabase senaryolarini test eder.
- `qa:instagram`: Instagram panelinin dolu, eksik config ve hata senaryolarini test eder.
- `qa:match-center`: Canli mac merkezi refresh/cache davranisini test eder.
- `qa:perf`: Mobil performansi CPU ve ag yavaslatma ile olcer.
- `qa:dist`: Production build sonrasinda kritik sekme ve UI davranislarini kontrol eder.
