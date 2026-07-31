# XYZSkor

Süper Lig için ücretsiz tahmin oyunu ve liderlik platformu. Uygulama vanilla JavaScript ve Supabase ile çalışır; derleme adımı yoktur.

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
- `scripts/dev.ps1`: Yerel geliştirme sunucusu
- `scripts/check.ps1`: JavaScript sözdizimi kontrolü

Supabase service-role anahtarı istemciye veya repoya eklenmemelidir.
