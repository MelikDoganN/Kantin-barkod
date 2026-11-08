# Kantin Barkod POS — Windows x64 Installer

Inno Setup installs the Electron application and bundled Node.js/backend. No separate database server or internet connection is required. The installer does not reset or overwrite existing SQLite records.

## Build on Windows x64

Install Node.js 22 and Inno Setup 6, then run:

```text
npm ci
npm ci --prefix backend
npm run dist:installer
```

Output: `release/KantinBarkodPOS-Setup-x64.exe`. The GitHub Actions workflow at `.github/workflows/windows-installer.yml` runs the same build on `windows-latest` and publishes it as an artifact.

## Local SQLite database

On first launch the app creates `%APPDATA%\Kantin POS\data\kantin.db`, enables SQLite foreign-key enforcement and WAL journaling, applies the bundled schema, then creates the default admin only when the user table is empty.

Before a later schema migration, the app creates a SQLite online-backup under `%APPDATA%\Kantin POS\backups` before applying changes. Existing database files with data but without migration history are not reset; setup stops and reports the issue. Migration and integrity errors are recorded in `%APPDATA%\Kantin POS\logs\db-setup.log`.

User files, logs, backups, and the SQLite database remain under `%APPDATA%\Kantin POS` when the app is uninstalled or updated.
