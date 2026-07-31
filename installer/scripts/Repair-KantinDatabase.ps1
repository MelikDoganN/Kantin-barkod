# One-shot repair for machines where Setup copied files but migrate never ran.
# Does NOT wipe data. Safe seed skips if users already exist.
#
# Usage (Admin PowerShell):
#   cd "C:\Program Files\KantinBarkod"
#   powershell -ExecutionPolicy Bypass -File "C:\path\to\Repair-KantinDatabase.ps1"

param(
  [string]$AppDir = 'C:\Program Files\KantinBarkod',
  [string]$EnvFile = ''
)

$ErrorActionPreference = 'Stop'

if (-not $EnvFile) {
  $EnvFile = Join-Path $env:APPDATA 'Kantin POS\config\.env'
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

$nodeExe = Join-Path $AppDir 'resources\runtime\node\node.exe'
$backendDir = Join-Path $AppDir 'resources\backend'
$prismaCli = Join-Path $backendDir 'node_modules\prisma\build\index.js'
$tsxCli = Join-Path $backendDir 'node_modules\tsx\dist\cli.mjs'
$seedFile = Join-Path $backendDir 'prisma\seed.ts'

if (-not (Test-Path -LiteralPath $nodeExe)) { throw "Node missing: $nodeExe" }
if (-not (Test-Path -LiteralPath $prismaCli)) { throw "Prisma missing: $prismaCli" }

# Load DATABASE_URL from .env
Get-Content -LiteralPath $EnvFile | ForEach-Object {
  if ($_ -match '^\s*DATABASE_URL=(.*)$') {
    $env:DATABASE_URL = $Matches[1].Trim().Trim('"')
  }
}
if (-not $env:DATABASE_URL) { throw "DATABASE_URL missing in $EnvFile" }

$env:DOTENV_CONFIG_PATH = $EnvFile
$env:ELECTRON_USER_DATA_PATH = Join-Path $env:APPDATA 'Kantin POS'
$env:NODE_ENV = 'production'

Write-Host "Using DATABASE_URL from $EnvFile"
Write-Host 'Running prisma migrate deploy...'
Push-Location $backendDir
try {
  & $nodeExe $prismaCli migrate deploy
  if ($LASTEXITCODE -ne 0) { throw "migrate deploy failed: $LASTEXITCODE" }

  Write-Host 'Running safe seed...'
  if (Test-Path -LiteralPath $tsxCli) {
    & $nodeExe $tsxCli $seedFile
  } else {
    # Avoid `prisma db seed` (needs tsx on PATH). Prefer local tsx binary.
    $tsxBin = Join-Path $backendDir 'node_modules\.bin\tsx.cmd'
    if (Test-Path -LiteralPath $tsxBin) {
      & $tsxBin $seedFile
    } else {
      & $nodeExe $prismaCli db seed
    }
  }
  if ($LASTEXITCODE -ne 0) { throw "seed failed: $LASTEXITCODE" }
}
finally {
  Pop-Location
}

Write-Host 'Repair completed. Login: admin / admin123'
exit 0
