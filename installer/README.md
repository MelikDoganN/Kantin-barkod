# Kantin Barkod POS — Windows x64 Installer

Inno Setup installs the Electron application and bundled Node.js/backend. The installer does not install PostgreSQL, reset databases, or overwrite existing records. On first application launch, the app checks PostgreSQL, creates `kantin_pos` only if it does not exist, and applies the repository's additive Prisma migrations. It adds the default admin/settings only when there are no users.

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

Before serving the API, a setup helper checks the server and database, inspects migration history, and applies only pending project migrations. It refuses to modify non-empty databases that lack migration history. The seed script runs only when the user table is empty, and never invokes the destructive development seed. Errors and migration output are recorded in `%APPDATA%\Kantin POS\logs\db-setup.log`; PostgreSQL outages and invalid passwords are reported in Turkish.

User files, logs, backups, and the encrypted credential remain under `%APPDATA%\Kantin POS` when the app is uninstalled.
