# Baseline — 25 Ağustos 2026

- Dal: `integration/latest-zip-2026-08-17`; başlangıç commit’i `e71311d`.
- Başlangıçta çalışma ağacı temizdi.
- `check`, demand-scope, worker-hardening (68/68) ve live-architecture (43/43) geçti.
- Ölçüm referansı: commit `e71311d` raporunda FCP 556 ms, beş-lig dolumu 1509 ms, Premier League geçişi 450 ms, direkt lig kabuğu 681 ms, direkt lig dolumu 1460 ms ve en uzun görev 187 ms. Profil 390×844, Fast 3G, 4× CPU.
- Mevcut talep sahipliği korunacak: root yalnız home/live-all; lig yalnız kendi season/live verisi; yeni haftalık uçlar yalnız görünür tek-lig genel bakışında.

Bu dosya production verisi veya secret içermez.
