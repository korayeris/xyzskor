# Sportmonks yetenek matrisi

| Yetenek | Durum | Kanıt |
|---|---|---|
| Gol/asist/kart liderleri | Beş lig kapsamı doğrulandı | Süper Lig 28203, Premier League 28083, La Liga 27965 ve Serie A 27895 güncel sezonlarında Topscorers + `player;participant;type` dolu gerçek Playground yanıtı verdi. Bundesliga 28321 sezonu 28 Ağustos 2026'da başlayacağı için 25 Ağustos'ta doğrulanmış boş döndü; lig/sezon erişimi açık. |
| Oyuncu/takım görselleri | Doğrulandı | Dolu Topscorers yanıtlarında oyuncu ve takım adlarıyla CDN `image_path` alanları geldi. |
| Güncel takım kadrosu ve pozisyon | Doğrulandı | Galatasaray takım kadrosu `player;position;detailedPosition` ile dolu döndü. |
| Kadro/diziliş/olay | Doğrulandı | Fixture 19746646 üzerinde lineups/events/statistics |
| Hazır oyuncu rating’i | Doğrulanmadı | Normal lineups cevabında rating yok |
| Sportmonks resmi TOTW beta | Doğrulanmadı | Dokümanda mevcut, hesap Playground’unda endpoint sunulmadı |
| In-play sorgusu | Erişilebilir, o anda sonuç yok/belirsiz | Playground `GET /football/livescores/inplay` 200 ve boş `data`; mesaj boş sonuç ile abonelik kapsamını ayırt etmiyor, bu yüzden canlı maç kanıtı sayılmadı |

Uygulama resmi rating/TOTW’ye bağımlı değildir. Topscorers endpointi 45 dakika cache edilir; kullanıcı başına provider çağrısı yapılmaz.

Playground abonelik metadatası Football `Starter / Advanced` ve Predictions Basic eklentisini gösterdi. Rate-limit sayacı sorgu penceresine göre değiştiği için kalıcı kapasite olarak yorumlanmadı. Bu yalnız 25 Ağustos 2026 anlık gözlemdir; satın alma veya plan değişikliği yapılmadı.
