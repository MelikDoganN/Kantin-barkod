# Kantin Barkod Sistemi — Installer (Faz 1)

Inno Setup ana kurulum yöneticisidir. electron-builder yalnızca
`release/win-unpacked` üretir.

**AppData (değiştirilmedi):** `%APPDATA%\Kantin POS`  
(Electron `productName` / `app.setName('Kantin POS')` ile uyumlu)

## Geliştirici kurulum derleme

```bash
npm run download:node
npm run dist
# opsiyonel: installer/vendor/postgresql-windows-x64.exe
npm run build:installer
# veya hepsi:
npm run dist:installer
```

Çıktı: `dist-installer/Kantin-Barkod-Setup.exe`

| Öğe | Değer |
|---|---|
| Kurulum klasörü | `C:\Program Files\KantinBarkod` |
| Exe | `Kantin POS.exe` (AppData uyumu) |
| Masaüstü kısayolu | Kantin Barkod Sistemi |
| DB | `kantin_pos` |
| Log | `%APPDATA%\Kantin POS\logs\install.log` |

## İlk giriş

- Kullanıcı: `admin`
- Şifre: `admin123`
