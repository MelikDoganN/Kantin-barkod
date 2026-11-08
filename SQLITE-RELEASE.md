# SQLite masaüstü sürümü (2.0.0)

Uygulama Windows 10/11 x64 üzerinde PostgreSQL veya sistem Node.js kurulumu gerektirmez. Electron kendi paketindeki Node runtime ile Express API'yi çalıştırır. Veritabanı `%APPDATA%\Kantin POS\data\kantin.db` dosyasıdır. İlk açılış migration ve güvenli başlangıç verilerini oluşturur; sonraki açılışlar kullanıcıları, parolaları ve işlem kayıtlarını korur. Başlangıç hesabı `admin` / `admin123` (mevcut hesap varsa yeniden oluşturulmaz).

Para alanları veritabanında tam sayı kuruş olarak saklanır. API mevcut TL sözleşmesini korur. İşlemler Prisma üzerinden yürür; better-sqlite3 yalnızca dosya bütünlüğü, WAL yedeği ve bakım için kullanılır. Tek uygulama örneği kilidi aynı dosya üzerinde ikinci masaüstü sürecini engeller.

## Veri güvenliği

- Bekleyen migration öncesinde SQLite online backup API ile `%APPDATA%\Kantin POS\backups` klasörüne tutarlı yedek alınır.
- Eksik migration geçmişi, yarım kalmış migration veya bozuk dosya otomatik sıfırlanmaz; başlangıç durur ve hata gösterilir.
- Ayarlar ekranından yedek alınabilir. Geri yükleme aynı migration geçmişini gerektirir; mevcut dosyanın güvenlik yedeği alınır, diğer HTTP istekleri bakım sırasında reddedilir. Başarısız geri yüklemede önceki dosya korunur.
- Kurulum ve kaldırma kuralları AppData altındaki veritabanını silmez. Güncellemeden önce kullanıcı yedeği alınması önerilir.
- Eski PostgreSQL sunucusu/verileri değiştirilmez. Bu sürüm PostgreSQL verilerini kendiliğinden aktarmıyor. Eski kayıtlar kullanılacaksa ayrıca dışa aktarma, para alanlarını kuruşa çevirme, ilişkileri ve toplamları doğrulama içeren aktarım işlemi gerekir.

## Doğrulama

Yerel kontroller:

```
npm run lint
npm run build
npm run build:backend
npm test --prefix backend
```

Entegrasyon testleri geçici veritabanı kullanır: ilk kurulum, giriş, ürün ekleme/düzenleme, barkod sorgusu, stok yükleme ve satış, yetersiz stokta rollback, foreign key, kuruş hassasiyeti, filtre/güncelleme/aggregate, tarih ve saat raporları, taslak/kart/borç satışı, iptal, kasa/gün sonu, WAL yedeği ve geri yükleme, yeniden açılışta kalıcılık, HTTP API, hatalı migration öncesi yedek, bozuk dosyada koruma. Fiziksel barkod okuyucu ve gerçek Windows kurulum sihirbazında kullanıcı testi ayrıca yapılmalıdır.

Windows Actions aynı testleri çalıştırır, Inno Setup ile `KantinBarkodPOS-Setup-x64.exe` üretir ve paketlenen node.exe ile Prisma, better-sqlite3, argon2, migration ve WAL yedeğini sınar. EXE artifact olarak yüklenir; yeni `v*` etiketi önceki sürümleri silmeden GitHub Release yayımlar.
