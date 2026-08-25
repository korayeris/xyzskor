# Gözlemlenebilirlik

Önerilen düşük-kardinaliteli event alanları: `request_id`, endpoint sınıfı, lig anahtarı, provider sonucu, cache sonucu, stale/degraded, süre ve abort nedeni. Token, e-posta, kullanıcı adı ve ham payload gönderilmez.

İzlenecek ölçüler: provider çağrısı, cache hit/miss/stale, single-flight birleşmesi, lock beklemesi, 429/5xx/HTML/timeout, verified-empty, home/live/season/leaders/weekly süreleri ve haftalık job sonucu.

Sentry/PostHog credentials oluşturulmadı. Pazarlama analitiği consent olmadan başlamaz; operasyonel sunucu metrikleri kişisel veri taşımaz.

Yerel kota/yük kanıtı `reports/performance/weekly-football-load-report.json` içindedir. Son ölçümde 100 aynı-lig istemci isteği 1 Topscorers çağrısına, 100 kullanıcının beş lig isteği lig başına 1 Topscorers çağrısına ve 50 aynı-tur hesabı 1 fixture çağrısına birleşti. Rapor p50/p95/p99, toplam provider zinciri, 429/500/HTML/timeout ve birleştirme sayılarını taşır. Database lock bekleme süresi ancak `qa:db` çalışan PostgreSQL ortamında ölçülebilir; yerel stub sonucu bu değeri uydurmaz.
