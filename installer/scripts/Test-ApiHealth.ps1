# Starts backend with portable Node and waits for /api/health -> 200.
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [int]$Port = 3001,
  [int]$TimeoutSec = 90,
  [string]$LogFile = ''
)

$ErrorActionPreference = 'Stop'

function Write-Log([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'o'), $Message
  Write-Host $line
  if ($LogFile) { Add-Content -Path $LogFile -Value $line -Encoding UTF8 }
}

function Quote-Arg([string]$Value) {
  if ($null -eq $Value) { return '""' }
  if ($Value -match '[\s"]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }
  return $Value
}

$nodeExe = Join-Path $AppDir 'resources\runtime\node\node.exe'
$entry = Join-Path $AppDir 'resources\backend\dist\index.js'
$backendDir = Join-Path $AppDir 'resources\backend'
$configEnv = Join-Path $env:APPDATA 'Kantin POS\config\.env'

if (-not (Test-Path -LiteralPath $nodeExe)) { Write-Log ('Portable Node missing: {0}' -f $nodeExe); exit 1 }
if (-not (Test-Path -LiteralPath $entry)) { Write-Log ('Backend entry missing: {0}' -f $entry); exit 1 }

try {
  $existing = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/api/health" -f $Port) -TimeoutSec 2
  if ($existing.StatusCode -ge 200 -and $existing.StatusCode -lt 300) {
    Write-Log ('API already healthy on port {0} - spawn skipped' -f $Port)
    exit 0
  }
}
catch {
  # not running yet
}

try {
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($listener) {
    Write-Log ('Port {0} is in use (PID {1}) but /api/health did not respond.' -f $Port, $listener.OwningProcess)
    exit 1
  }
}
catch {
  # Get-NetTCPConnection may be unavailable; continue
}

$env:ELECTRON_USER_DATA_PATH = Join-Path $env:APPDATA 'Kantin POS'
$env:DOTENV_CONFIG_PATH = $configEnv
$env:PORT = "$Port"
$env:NODE_ENV = 'production'

# Load DATABASE_URL into this process so child inherits it
if (Test-Path -LiteralPath $configEnv) {
  Get-Content -LiteralPath $configEnv | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      Set-Item -Path ("Env:{0}" -f $Matches[1]) -Value $Matches[2].Trim().Trim('"')
    }
  }
}

Write-Log ('Starting backend: {0} {1}' -f $nodeExe, $entry)
$proc = Start-Process -FilePath $nodeExe `
  -ArgumentList (Quote-Arg $entry) `
  -WorkingDirectory $backendDir `
  -PassThru -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$ok = $false
$lastError = ''

try {
  while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) {
      Write-Log ('Backend exited early with code {0}. Check %APPDATA%\Kantin POS\logs\backend.log' -f $proc.ExitCode)
      exit 1
    }
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/api/health" -f $Port) -TimeoutSec 2
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 300) {
        $ok = $true
        break
      }
      $lastError = ('Unexpected status {0}' -f $resp.StatusCode)
    }
    catch {
      $lastError = $_.Exception.Message
      Start-Sleep -Milliseconds 500
    }
  }
}
finally {
  if ($proc -and -not $proc.HasExited) {
    try { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue } catch { }
  }
}

if (-not $ok) {
  Write-Log ('API health check timed out on port {0} after {1}s. Last error: {2}' -f $Port, $TimeoutSec, $lastError)
  exit 1
}

Write-Log ('API health OK on port {0}' -f $Port)
exit 0
