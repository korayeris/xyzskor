# Predict mini oyun güvenlik modeli

Ödül claim akışı; sunucu üretimli nonce, session sahipliği, minimum süre, monoton
olay ofsetleri, olaylar arası minimum süre ve terminal durum replay kontrolü uygular.
Authenticated günlük claim işlemleri kullanıcı ve UTC gün anahtarına göre PostgreSQL
transaction advisory lock ile seri hale getirilir.

Bu kontroller otomatik ve basit sahte POST isteklerini engelleyen suistimal
heuristic'leridir. Tarayıcı tarafından gönderilen olay kaydı, fiziksel oyunun gerçekten
oynandığını kriptografik olarak kanıtlamaz; değiştirilmiş bir istemci makul görünen bir
kayıt üretebilir.

Backlog: ödül riski veya ödül değeri arttığında her atış için kısa ömürlü, tek kullanımlık
sunucu challenge üreten ve challenge sırasını sunucuda tüketen bir protokol tasarlanmalı.
Bu protokol nonce/session kontrollerinin yerine geçmemeli, onların üzerine eklenmelidir.
