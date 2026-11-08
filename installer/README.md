# Kantin Barkod POS — Windows x64 Installer

Inno Setup installs the Electron application and bundled Node.js/backend. The installer does not install PostgreSQL, create or reset databases, change database users, run Prisma migrations, or seed data.

## Build on Windows x64

Install Node.js 22 and Inno Setup 6, then run:

```text
npm ci
npm ci --prefix backend
npm run dist:installer
```

Output: `release/KantinBarkodPOS-Setup-x64.exe`. The GitHub Actions workflow at `.github/workflows/windows-installer.yml` runs the same build on `windows-latest` and publishes it as an artifact.

## PostgreSQL first launch

The app connects to `localhost:5432`, database `kantin_pos`, user `postgres`. On first launch, enter the existing PostgreSQL password once. Electron `safeStorage` protects it with the Windows account's DPAPI-backed encryption and saves it under `%APPDATA%\Kantin POS\config\db-credentials.bin`. The password is not embedded in the installer or written to `.env`.

Before serving the API, the backend opens a Prisma connection to the configured database. A connection/database error is reported to the user; no schema migration or seed is run.

User files, logs, backups, and the encrypted credential remain under `%APPDATA%\Kantin POS` when the app is uninstalled.
