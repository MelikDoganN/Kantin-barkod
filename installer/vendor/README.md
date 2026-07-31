# PostgreSQL Windows installer (EDB)

Müşteri makinesinde PostgreSQL yoksa Setup bunu sessiz kurar.

## Dosya adı (zorunlu)

Bu klasöre EDB indirmesini şu isimle koyun:

```
installer/vendor/postgresql-windows-x64.exe
```

Örnek kaynak:
https://www.enterprisedb.com/downloads/postgres-postgresql-downloads
(Windows x86-64, örn. PostgreSQL 16)

## Alternatif (harici)

Setup derlemesine gömmek istemezseniz, `Kantin-POS-Setup.exe` ile **aynı klasöre**
`postgresql-windows-x64.exe` koyun. Inno `external` / `{src}` yolundan bulur.

## Notlar

- Dosya boyutu ~250MB+ olabilir; git’e eklemeyin (gitignore).
- Silent install parametreleri `Install-PostgreSQL.ps1` içindedir.
- Mevcut PostgreSQL varsa installer sessiz kurulumu atlar; wizard’da
  mevcut `postgres` şifresi istenir.
