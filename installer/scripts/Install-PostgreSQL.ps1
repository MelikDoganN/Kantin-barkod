# Silent-installs PostgreSQL from a vendor installer EXE when not already running.
# After install, re-detects the real bin path (does NOT assume PostgreSQL\16).
param(
  [Parameter(Mandatory = $true)][string]$InstallerPath,
  [Parameter(Mandatory = $true)][string]$SuperPassword,
  [int]$Port = 5432,
  [string]$DetectScript = ''
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $InstallerPath)) {
  throw "PostgreSQL installer not found: $InstallerPath"
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $DetectScript) {
  $DetectScript = Join-Path $scriptDir 'Detect-PostgreSQL.ps1'
}

function Invoke-Detect {
  $outFile = Join-Path $env:TEMP 'kantin-pg-detect-after-install.json'
  $errFile = Join-Path $env:TEMP 'kantin-pg-detect-after-install.err'
  $proc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $DetectScript) `
    -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $outFile `
    -RedirectStandardError $errFile
  if ($proc.ExitCode -ne 0) { return $null }
  $json = Get-Content -Path $outFile -Raw -ErrorAction SilentlyContinue
  if (-not $json) { return $null }
  try { return ($json | ConvertFrom-Json) } catch { return $null }
}

# Already installed & usable → do not reinstall
$existing = Invoke-Detect
if ($existing -and ($existing.Installed -eq $true -or $existing.installed -eq $true)) {
  $psql = if ($existing.PsqlPath) { $existing.PsqlPath } else { $existing.psql }
  if ($psql -and (Test-Path $psql)) {
    Write-Host "PostgreSQL already installed (v$($existing.Version)). Skipping silent install."
    $existing | ConvertTo-Json -Compress
    exit 0
  }
}

# Infer version from installer filename when possible (postgresql-18-... / postgresql_18...)
$inferredVersion = $null
$name = [System.IO.Path]::GetFileNameWithoutExtension($InstallerPath)
if ($name -match '(?:^|[-_])(1[4-8])(?:[-_]|$)') {
  $inferredVersion = $Matches[1]
}

$versionFolder = if ($inferredVersion) { $inferredVersion } else { '18' }
$installDir = Join-Path ${env:ProgramFiles} "PostgreSQL\$versionFolder"
$serviceName = "postgresql-x64-$versionFolder"

Write-Host "Installing PostgreSQL silently → $installDir (service $serviceName)…"

$argList = @(
  '--mode', 'unattended',
  '--unattendedmodeui', 'none',
  '--superpassword', $SuperPassword,
  '--servicename', $serviceName,
  '--serviceaccount', 'NT AUTHORITY\NetworkService',
  '--serverport', "$Port",
  '--prefix', $installDir,
  '--datadir', (Join-Path $installDir 'data'),
  '--enable-components', 'server,commandlinetools'
)

$proc = Start-Process -FilePath $InstallerPath -ArgumentList $argList -Wait -PassThru -WindowStyle Hidden
if ($null -eq $proc.ExitCode -or $proc.ExitCode -ne 0) {
  throw "PostgreSQL silent install failed with exit code $($proc.ExitCode)"
}

# Wait until detection finds psql (real path may differ slightly)
$deadline = (Get-Date).AddMinutes(4)
$detected = $null
do {
  Start-Sleep -Seconds 2
  $detected = Invoke-Detect
  $psqlPath = $null
  if ($detected) {
    $psqlPath = if ($detected.PsqlPath) { $detected.PsqlPath } else { $detected.psql }
  }
  if ($psqlPath -and (Test-Path $psqlPath)) { break }
} while ((Get-Date) -lt $deadline)

if (-not $detected -or -not (($detected.Installed -eq $true) -or ($detected.installed -eq $true))) {
  throw 'PostgreSQL installed but detection failed afterward.'
}

# Allow service to accept connections
Start-Sleep -Seconds 5

$detected | ConvertTo-Json -Compress
exit 0
