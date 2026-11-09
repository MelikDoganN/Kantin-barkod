# Kantin Barkod POS v3.0.1

Barkod okutunca pencerenin görev çubuğuna küçülmesi için Electron düzeltmesi.

Electron 33 varsayılan menüsünde Ctrl+M küçültme kısayoludur. Önceki sürümde menü yalnızca gizleniyordu; kısayollar etkin kalıyordu. CR sonlandırıcısını Ctrl+M olarak ileten bir okuyucu bu davranışı tetikleyebilir. Kullanıcının fiziksel cihazının gönderdiği tuşlar henüz ölçülmedi; bu nedenle cihazın kesin olarak Ctrl+M gönderdiği iddia edilmez.

- Windows/Linux üzerinde gizli varsayılan menü kaldırılır.
- Ctrl+M/Ctrl+J, Electron'un renderer öncesi tuş işleme katmanında yakalanır; küçültme komutu olarak çalışmaz.
- Satış/ürün ekranında hızlı barkod dizisinden sonra gelen bu sonlandırıcılar Enter'a dönüştürülür. CR+LF çift sonlandırıcısında ikinci ekleme engellenir.
- Normal Enter/Tab okutma desteği korunur. Başlık çubuğundaki küçültme düğmesi çalışmaya devam eder.
- Pencere küçülmesi ve renderer kapanması tanılama için app.log dosyasına yazılır. Barkod veya parola tuşları kaydedilmez.
- Ürün barkod alanı Enter değerini anlık input değerinden okur.

Kaynak: https://github.com/electron/electron/blob/v33.4.11/lib/browser/api/menu-item-roles.ts#L75

Testler: gerçek Electron penceresinde eski Ctrl+M davranışını yeniden üretme; satışta Ctrl+M sonlandırıcısıyla ürün ekleme; ürün formunda Ctrl+M ve Ctrl+J; manuel küçültme. Ayrıca mevcut tarayıcı, SQLite/POS ve Windows paket/native runtime kontrolleri çalıştırılır. Fiziksel okuyucu ile müşteri bilgisayarında test yapılmadı. v3 raporundaki özellik ve bağımlılık sınırları geçerlidir.

Kullanıcı hesapları ve SQLite verisi değiştirilmez. Mevcut kurulumun üzerine yüklenebilir.
