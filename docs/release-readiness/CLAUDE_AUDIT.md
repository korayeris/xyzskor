# Bağımsız denetim — 25 Ağustos 2026

## Karar

**Koşullu geçti.** Uygulama, API izolasyonu, haftalık futbol algoritması,
responsive davranış ve yerel/stub kota testleri yeşildir. Hukuki gate ve gerçek
PostgreSQL migration/RLS koşusu kapanmadan production yayını önerilmez. Gerçek
bir canlı Süper Lig maçı baştan sona izlenmediği için bu kapsam başarı olarak
yazılmaz.

## Bulunan ve düzeltilen hatalar

1. Son tamamlanan maçlardan tur seçimi aynı turdaki ertelenmiş veya oynanmamış
   maçı görmüyordu; eksik tur published olabilirdi. Tüm turu kapsayan seçim
   sözleşmesi eklendi.
2. Yinelenen Topscorers oyuncusunda ilk kayıt korunuyordu. Metric+player bazında
   en güçlü doğrulanmış toplam seçiliyor.
3. İkinci sarı ihraç provider tarafından yellow/second-yellow/red satırlarıyla
   verilirse kart cezası çift yazılabiliyordu. Dismissal normalizasyonu eklendi.
4. Test yalnız 4-3-3 ve dar bir skor örneğini kapsıyordu. Üç diziliş, bilinmeyen
   pozisyon, skor bileşenleri, 0/10 sınırı, determinism, eksik havuz,
   incomplete/postponed tur ve dört kapalı feature flag eklendi.
5. UI stale ile degraded/verified-empty durumlarını ayırmıyordu. Durumlar ayrı
   etiketlere bağlandı.
6. Sportmonks lig/sezon sorgusu 500 verdiğinde hata 403 `plan_restricted`
   olarak yanlış sınıflandırılıyordu; upstream 500 artık 502 olarak korunuyor.
7. Bazı public hata gövdeleri sağlayıcı mesajını veya dahili hata metnini
   yansıtabiliyordu. Hata gövdeleri genel makine kodlarıyla sınırlandı.
8. Emekli spor yollarının erişilemez renderer/CSS kodu ve 264 KB kullanılmayan
   Kayak/saha görseli repository'de kalmıştı; aktif branşlara dokunmadan kaldırıldı.

## Doğrulanan iddialar

- Sportmonks Playground, Süper Lig sezon 28203 için Topscorers ile `player`,
  `participant`, `type`; fixture 19746646 için lineup verisini gerçek hesapta
  döndürdü. Hazır rating veya resmî Team of the Week doğrulanmadı ve kullanılmıyor.
- 100 aynı-lig liderlik isteği tek Topscorers upstream çağrısına birleşti.
- 429/500/HTML/timeout cache yokken doğrulanmış boş başarıya çevrilmedi.
- Doğrulanmış lider payload'ı provider 500 durumunda stale+degraded korundu.
- Root lider/weekly uçlarını çağırmıyor; tek-lig yalnız kendi kapsamını çağırıyor.
- 11 oyuncu benzersiz, tam bir kaleci zorunlu; geçersiz havuz yayınlanmıyor.

## Kanıt türleri

- Gerçek provider: yalnız yukarıdaki Playground GET doğrulaması.
- Yerel stub/integration: puanlama, concurrency, provider hata ve responsive.
- Gerçek PostgreSQL/Supabase: migration, RLS, idempotent upsert ve rollback → yeniden apply doğrulandı; gerçek 20-paralel oturum testi tamamlanmadı.
- Gerçek canlı maç: çalıştırılmadı; replay veya mock canlı kanıt sayılmadı.

## Test özeti

- `qa:weekly-football`, `qa:weekly-load`, `qa:demand-scope`, `qa:football-ia`,
  `qa:matchday`, `check`, `build`: PASS
- `qa:hardening`: 68/68; `qa:live-architecture`: 43/43; `qa:api`: 161/161
- Ana sayfa + beş lig × 320/360/375/390/430/768/1440: 974/974,
  0 console/page error ve 0 lig/branş API sızıntısı
- Son performans: FCP 516 ms, beş-lig dolumu 1410 ms, lig geçişi 393 ms,
  direkt lig kabuğu 619 ms, direkt lig dolumu 1336 ms, en uzun görev 184 ms. Başlangıç commit'ine göre
  hiçbir ana metrikte %10 kötüleşme yok; tamamı iyileşti.
- `qa:db`: PARTIAL; gerçek Supabase apply/RLS/rollback/re-apply geçti. Yerel Bash/`psql`
  olmadığı ve Dashboard paralel editörleri zaman aşımına uğradığı için 20-paralel kanıt açık
- `check:legal`: FAIL; hukuki placeholder yayın engeli

## Kanıta dayalı puan kartı

| Alan | Puan | Kanıt / sınır |
|---|---:|---|
| API ve lig izolasyonu | 9/10 | 974 responsive kontrol, demand-scope ve 161 API kontrolü yeşil |
| Performans | 9/10 | Release perf gate yeşil; FCP 516 ms, lig geçişi 393 ms |
| Canlı skor mimarisi | 8/10 | 43/43 mimari testi yeşil; gerçek maç uçtan uca izlenmedi |
| Güvenlik ve kota koruması | 9/10 | Single-flight/stale hata testleri yeşil; gerçek trafik alarmı henüz ölçülmedi |
| Haftalık futbol özellikleri | 9/10 | Liderler, yıldız ve takım unit/integration/yük testleri yeşil |
| XYZSkor puanlama güvenilirliği | 9/10 | Bileşen, kart, duplicate, sınır ve determinism testleri yeşil |
| Arayüz ve mobil uyum | 9/10 | 7 viewport, 974/974; console/page error yok |
| Veritabanı kanıtı | 8/10 | Gerçek Supabase migration/RLS/rollback döngüsü geçti; 20-paralel kanıt açık |
| Production gözlemlenebilirliği | 7/10 | Yerel makine-okunur yük raporu ve alarm eşikleri var; production ölçümü yok |
| Hukuki yayın hazırlığı | 2/10 | `check:legal` kırmızı; uzman onayı ve lisans teyidi yok |

## Nihai yayın engelleri

1. Hukuki mekanizma ve kuruluş bilgileri uzman/onaylı içerikle doldurulmalı.
2. Migration apply → rollback → re-apply ve RLS gerçek Supabase üzerinde geçti.
   Kalan 20 paralel idempotency testi `psql` bulunan bir runner üzerinden çalıştırılmalı.
3. İlk uygun gerçek canlı Süper Lig maçında `LIVE_MATCH_RUNBOOK.md` uygulanmalı;
   tamamı izlenmeden uçtan uca canlı doğrulama iddiası kurulamaz.
