# Kantin Barkod POS v3.0.0

## Düzeltilenler

- Satış ekranı açıldığında, yeni satışa geçildiğinde ve ödeme penceresi kapandığında barkod alanı otomatik odaklanır.
- Menünün veya bir düğmenin odakta kaldığı durumda hızlı USB klavye tipi barkod okutma satış ekranı genelinde yakalanır; Enter/Tab menüyü çalıştırıp ana sayfaya göndermez.
- Enter ve sayısal barkodlar için Tab sonlandırıcısı desteklenir. Elle ürün arama ve indirim girişi korunur.
- Ödeme penceresinde barkod okutmak ödeme onayı vermez. Art arda okutmalar sırayla işlenir; adet ve taslak kaydetme istekleri birbirinin üzerine yazılmaz.
- Sayfadan ayrılırken bekleyen sepet kaydı gönderilir. Yeni satış ve iptal sırasında tekrar tıklama kilitlenir.
- Stok sayımı farkı artık miktar birimiyle saklanır. v2'nin kuruş gibi ölçeklediği eski sayım farkları, yedek alınarak bir defalık migration ile düzeltilir. Kullanıcılar, parolalar, ürünler ve satışlar korunur.
- Kullanılmamış ürün ve kategoriler silinebilir. Ürün silme ile işlem günlüğü aynı transaction içindedir. Satış/stok geçmişi olan ürün kalıcı silinmez, pasife alınabilir.
- Kullanıcının pasifliği ve güncel rolü her API isteğinde doğrulanır; eski token yetkiyi koruyamaz.
- Zamanlanmış yedekler uygulama açıkken de kontrol edilir. Aynı saniyedeki yedekler benzersiz dosya adları alır.

## Doğrulama

- `npm run lint`, frontend/Electron build ve Prisma/backend build.
- Backend entegrasyonları: kurulum, giriş, ürün/barkod, stok/satış rollback, foreign key, kuruş hassasiyeti, raporlar, taslak/kart/borç/iptal, kasa/gün sonu, WAL yedek/geri yükleme, kalıcılık, HTTP erişimi ve yetki değişimi, silme/pasife alma, sayım farkı, v2 migration, yedek silme ve hatalı migration/bozuk veritabanı koruması.
- 8 Chromium testi: otomatik odak, menü odaktayken okutma, hızlı tekrar okutma ve sayfa geçişinde kalıcılık, bulunamayan barkod/ödeme onayı koruması, nakit satış ve sonraki okutma, tüm ana ekranların açılması, arayüzden silme, Tab barkodu ve elle indirim girişi.
- Windows Actions aynı testlerden sonra Inno Setup EXE üretir ve paketlenen Windows x64 Node runtime ile Prisma, better-sqlite3, argon2 ve WAL yedeğini doğrular.

## Sınırlar

Fiziksel barkod okuyucu ve müşteri bilgisayarındaki Windows kurulum sihirbazı uzaktan denenmedi. Klavye tipi okuyucu davranışı gerçek tarayıcıda otomatik olarak test edilir. Okuyucunun Enter veya Tab sonlandırıcısı göndermesi gerekir.

Eski arayüzde görünen tam iade ve satışa not ekleme düğmelerinin işlem altyapısı bulunmuyor. Yanıltıcı boş tıklamalar yerine düğmeler açıklamalı olarak devre dışıdır. Tamamlanmış satış iptali mevcut Gün Sonu satış detayı ekranından yapılabilir. Bu sürüm kısmi ürün iadesi veya satış notu özelliği eklemez.

PostgreSQL verileri değiştirilmez; eski PostgreSQL kayıtlarının aktarılması ayrı işlemdir. SQLite verisi `%APPDATA%\Kantin POS\data\kantin.db` altında korunur. Başlangıç hesabı yalnızca boş kurulumda `admin` / `admin123`.

## Bağımlılık kontrolü

`npm audit fix --ignore-scripts` ile mevcut sürüm aralıklarındaki uyumlu düzeltmeler uygulandı (HTTP/multipart doğrulama bağımlılıkları dahil). Kontrol tamamen temiz değildir: backend araç zincirindeki Prisma 6 → @prisma/config → deepmerge-ts için 3 yüksek seviye kayıt ve kök geliştirme/paketleme zincirinde 22 kayıt (7 orta, 14 yüksek, 1 kritik; Electron/Electron Builder/Vite ve React Router dahil) kalmaktadır. Bunların otomatik düzeltmesi büyük sürüm değişiklikleri gerektiriyor; `--force` kullanılmadı. Bu sürüm için “güvenlik açığı yok” iddiası yapılmaz; büyük runtime/araç zinciri yükseltmesi ayrı uyumluluk çalışmasıdır.
