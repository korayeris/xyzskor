# Canlı maç gözlem runbook’u

Gerçek canlı maç yoksa replay testi gerçek gözlem olarak raporlanmaz.

1. `SPORTMONKS_API_TOKEN`, Supabase server değişkenleri ve hedef fixture kimliği yalnız yerel/hosted secret olarak ayarlanır.
2. `npm run qa:live-architecture`, `npm run qa:live-details`, `npm run qa:matchday` çalıştırılır.
3. Maç sırasında `/api/football/live?league=super-lig` ve `/api/football/matchday?fixture=<id>` zaman damgalı JSONL olarak gözlenir.
4. Listeye giriş, dakika, skor, olay, kart, değişiklik, kadro, devre ve final; ardından in-play listesinden çıkışta fixture kesinleştirmesi kontrol edilir.
5. Sekme gizleme/gösterme ve 429/500/HTML/timeout replay senaryoları ayrı etiketlenir.

Gerçek canlı gözlem tamamlanmadıkça release checklist’te P0 açık kalır.
