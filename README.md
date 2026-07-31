# XYZSkor

Süper Lig için matematiksel performans ve veri analiz platformu. Uygulama vanilla JavaScript ve Supabase ile çalışır; derleme adımı yoktur.

Mythos Cards yalnızca ödül sponsorudur. XYZSKOR üzerinde ürün satışı, sepet veya ödeme akışı bulunmaz; sponsor ürünleri yarışma kazananlarına ücretsiz hediye edilir.

## Yerel çalıştırma

PowerShell üzerinden:

```powershell
npm run dev
```

`npm` PATH üzerinde değilse doğrudan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

Ardından `http://127.0.0.1:4173` adresini açın.

## Kontrol

```powershell
npm run check
```

## Dosyalar

- `index.html`: Uygulamanın tamamı
- `docs/XYZSKOR-devir-teslim.md`: Mimari ve operasyon notları
- `docs/data-provider-architecture.md`: Değiştirilebilir API-Football/Sportmonks katmanı ve veri sınıflandırma sözleşmesi
- `docs/provider-comparison-scorecard.csv`: 2–3 haftalık sağlayıcı karşılaştırma kayıt şablonu
- `supabase/functions/football-live/index.ts`: Canlı skor sağlayıcı adaptörü
- `supabase/migrations/20260731_live_feed_cache.sql`: Canlı API kotasını koruyan sunucu önbelleği
- `scripts/dev.ps1`: Yerel geliştirme sunucusu
- `scripts/check.ps1`: JavaScript sözdizimi kontrolü

Supabase service-role ve spor veri sağlayıcısı anahtarları istemciye veya repoya eklenmemelidir. API-Football/Sportmonks çağrıları yalnızca sunucu tarafındaki Supabase Edge Function üzerinden yapılır. Sağlayıcı, `FOOTBALL_DATA_PROVIDER` secret'ıyla değiştirilir; ön yüz kodu değişmez.
