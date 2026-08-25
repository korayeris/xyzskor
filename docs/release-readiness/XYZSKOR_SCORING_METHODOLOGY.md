# XYZSkor Performans Puanı v1

Bu puan ve haftalık seçimler Sportmonks verilerinden XYZSkor tarafından hesaplandı; sağlayıcının veya ligin resmî ödülü değildir.

Başlangıç 6.0. Süre bonusu 1–59 dk +0.2, 60+ dk +0.5; galibiyet +0.3, beraberlik +0.1. Gol: kaleci +3.0, savunma +2.5, orta saha +2.0, forvet/bilinmeyen +1.7. Asist +1.2. 60+ dk gol yememe: kaleci/savunma +1.0, orta saha +0.3. Sarı −0.5, ikinci sarıdan ihraç −1.5, direkt kırmızı −2.0, kendi kalesine −1.5, kaçan penaltı −1.0, doğrulanmış penaltı kurtarışı +2.0.

Sonuç 0–10 aralığına sıkıştırılır ve bir ondalıkla gösterilir. Event kimliğiyle tekrarlar silinir. Bilinmeyen pozisyon `unknown` kalır. Breakdown: `base`, `minutes`, `goals`, `assists`, `result`, `cleanSheet`, `cards`, `penalties`.

Haftalık eşitlik: puan, gol+asist katkısı, dakika, deterministik `playerId`. Çoklu maçta dakika ağırlıklı ortalama. Yalnız tamamlanan tur published olabilir. Geçerli 11 yoksa takım yayımlanmaz.
