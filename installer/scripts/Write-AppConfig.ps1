# Writes AppData config .env and optionally backend/.env (packaged resources/backend)
param(
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
  [Parameter(Mandatory = $true)][string]$JwtSecret,
  [int]$Port = 3001,
  [string]$PgDumpPath = '',
  [string]$BackendDir = '',
  [string]$LogFile = ''
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'o'), $Message
  Write-Host $line
  if ($LogFile) { Add-Content -Path $LogFile -Value $line -Encoding UTF8 }
}

function Write-EnvFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Content
  )
  $dir = Split-Path -Parent $Path
  if ($dir) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
  Write-Log ('Wrote env file: {0}' -f $Path)
  Write-Log ('Env file exists after write: {0}' -f (Test-Path -LiteralPath $Path))
  if (Test-Path -LiteralPath $Path) {
    $item = Get-Item -LiteralPath $Path
    Write-Log ('Env file size={0} LastWrite={1}' -f $item.Length, $item.LastWriteTime)
  }
}

try {
  $appDataRoot = Join-Path $env:APPDATA 'Kantin POS'
  $configDir = Join-Path $appDataRoot 'config'
  New-Item -ItemType Directory -Force -Path $configDir | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $appDataRoot 'uploads') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $appDataRoot 'backups') | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $appDataRoot 'logs') | Out-Null

  $pgDumpLine = if ($PgDumpPath -and (Test-Path -LiteralPath $PgDumpPath)) { $PgDumpPath } else { '' }

  $content = @(
    ('DATABASE_URL={0}' -f $DatabaseUrl)
    ('JWT_SECRET={0}' -f $JwtSecret)
    ('PORT={0}' -f $Port)
    ('PG_DUMP_PATH={0}' -f $pgDumpLine)
  ) -join "`n"
  $content = $content + "`n"

  Write-Log ('APPDATA root: {0}' -f $appDataRoot)
  Write-Log ('DATABASE_URL present: {0} (length={1})' -f (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)), $DatabaseUrl.Length)

  $appDataEnv = Join-Path $configDir '.env'
  Write-EnvFile -Path $appDataEnv -Content $content

  if ($BackendDir -and (Test-Path -LiteralPath $BackendDir)) {
    $backendEnv = Join-Path $BackendDir '.env'
    Write-Log ('Also writing backend .env under: {0}' -f $BackendDir)
    Write-EnvFile -Path $backendEnv -Content $content
  }
  else {
    Write-Log ('BackendDir not provided or missing - skipped backend/.env copy. BackendDir={0}' -f $BackendDir)
  }

  exit 0
}
catch {
  Write-Log ('Write-AppConfig FAILED: {0}' -f $_)
  exit 1
}
