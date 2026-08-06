# XYZSKOR — Max Capacity Görsel Teşhis ve Tasarım Yönü

Tarih: 2 Ağustos 2026

## Mevcut Tasarımdaki En Kritik 10 Problem

1. Maç, manşet, haber, transfer ve puan durumu aynı lacivert kart diliyle sunuluyor; önem sırası kayboluyor.
2. İçerik ayrı ayrı çerçevelendiği için gerçek spor portalı yerine dashboard/widget hissi oluşuyor.
3. Masaüstü, mobil kartların genişletilmiş hali gibi; geniş ekranın editoryal kolon kapasitesi kullanılmıyor.
4. Header’daki Futbol/Predict geçişi büyük beyaz butonlar gibi duruyor; ürün modu hissi vermiyor.
5. Mobil header 131 px; ilk gerçek futbol içeriği gereğinden geç başlıyor.
6. Maçlar satır yerine küçük kartların içine konuyor; lig/skor tarama alışkanlığı zayıflıyor.
7. Öne çıkan gelişme güçlü başlık taşısa da boş koyu kutu gibi; editoryal manşet kompozisyonu yok.
8. Haber ve transfer alanları gerçek akış yerine eş boyutlu modül; kaynak ve zaman hiyerarşisi geri planda.
9. Banner, sponsor, ticari envanter ve sağ rail için kullanılabilir kompozisyon alanı yok.
10. Predict özetinde metrikler kutu içinde kutu; Futbol’dan yeterince farklı bir yarışma kimliği oluşmuyor.

## Değerlendirilen Üç Yaklaşım

1. **Editoryal spor yayını:** güçlü manşet, açık okuma yüzeyi, kolon ritmi ve reklam/sponsor envanteri. Haber için güçlü; maç taraması tek başına zayıf kalabilir.
2. **Veri ağırlıklı canlı skor:** yoğun maç listeleri, hızlı tablo ve tarih kontrolü. Kullanışlı; tek başına kullanılırsa mekanik ve eski görünebilir.
3. **Modern futbol topluluğu/oyun:** kişiselleştirme, takım filtresi ve Predict motivasyonu güçlü. Gerçek backend olmayan sosyal alanlarda sahte metrik riski taşır.

## Seçilen Tasarım Yönü

**Editoryal spor portalı + yoğun canlı skor rail’i + ayrı yarışma modu.**

- Koyu, premium global header.
- Futbol için açık kırık-beyaz editoryal çalışma yüzeyi.
- Solda kompakt maç rail’i, ortada manşet ve gündem akışı, sağda transfer/puan/sponsor rail’i.
- Kart yerine beyaz kolon yüzeyleri, bölüm çizgileri ve satır listeleri.
- Gerçek görsel yoksa büyük boş görsel kutusu yerine tipografik manşet yüzeyi.
- Futbol içinde Maçlar, Gündem, Transfer ve Puan Durumu erişimi; ana navigasyonda yine yalnız Futbol/Predict.
- Gerçek takım verileriyle çalışan takım filtresi; sahte takipçi veya sosyal sayaç yok.
- Predict için daha koyu, enerjik ve ilerleme odaklı ayrı yüzey; bahis estetiği yok.
- Mythos yalnız gerçek ödül sponsoru olarak ticari/sponsor alanını doldurur.

## Design System Özeti

- Açık editoryal yüzey: kırık beyaz ve soğuk gri.
- Global kabuk: gece laciverti ve morumsu kömür.
- Etkileşim: kontrollü mercan/kırmızı; canlı/success: sınırlı yeşil.
- Radius yalnız ana yüzeylerde; maç/haber satırları bölücülerle ayrılır.
- Skor/saat için tabular numerals; haber metinlerinde okunabilir sans serif.
- Desktop: 340 / esnek ana kolon / 280 px portal grid.
- Mobil: tarih → maçlar → manşet → gündem → transfer → puan durumu.
- Focus görünür; dokunma hedefleri en az 44 px; reduced motion destekli.

## Baseline Görsel Bulgular

- 360/390/430 px: taşma yok fakat header 131 px ve ilk içerik geç başlıyor.
- 768/1024/1280/1440 px: taşma yok; 1280 px üzeri container kontrolü iyi fakat kolonlar eş kartlara dönüşüyor.
- 1280 px Futbol: ana odak iki eş panel arasında bölünüyor.
- 1280 px Predict: özet daha iyi fakat dev koyu çerçeve ve metrik kutuları hâlâ dashboard hissi veriyor.
- 360 px Predict: ilk viewport yalnız özet paneli gösteriyor; maç eylemi görünmüyor.
