# Supabase production hazırlığı

Ücretli plana geçiş kararı tahminle değil ölçümle alınır: DB boyutu ve büyüme, eşzamanlı bağlantı, Realtime peak, Edge Function çağrı/süre, egress, Auth e-posta teslimi ve backup/restore kanıtı.

Haftalık tabloların büyümesi lig×tur×oyuncu ve lig×tur kayıtlarıyla hesaplanabilir. Connection pooling serverless trafik için zorunludur; service-role yalnız Worker/Function secret’ıdır.

Önerilen yükseltme eşikleri: kaynak limitinin %70’inin 7 gün sürmesi, bağlantı saturation, egress/Function bütçesinin %70’i, ihtiyaç duyulan PITR/SLA veya ücretsiz planın operasyonel mail limitinin doğrulanmış biçimde yetersiz kalması. Bu çalışma plan satın almaz.
