# Detects PostgreSQL 14–18 on Windows (registry, services, Program Files).
# Output: single JSON object on stdout. Always exit 0 when detection completes.

$ErrorActionPreference = 'Continue'

$PreferredVersions = @('18', '17', '16', '15', '14')

function Get-VersionFromPath([string]$Path) {
  if ($Path -match '\\PostgreSQL\\(\d+)\\') { return $Matches[1] }
  return $null
}

function New-DetectionResult {
  param(
    [bool]$Installed,
    [string]$Version = $null,
    [string]$BinPath = $null,
    [string]$PsqlPath = $null,
    [string]$PgDumpPath = $null,
    [string]$PgIsReadyPath = $null,
    [string]$ServiceName = $null,
    [int]$Port = 5432
  )

  [ordered]@{
    Installed     = $Installed
    Version       = $Version
    BinPath       = $BinPath
    PsqlPath      = $PsqlPath
    PgDumpPath    = $PgDumpPath
    PgIsReadyPath = $PgIsReadyPath
    ServiceName   = $ServiceName
    Port          = $Port
  } | ConvertTo-Json -Compress
}

function Find-ServiceForVersion([string]$Version) {
  $patterns = @(
    "postgresql*-$Version*",
    "postgresql-x64-$Version*",
    "postgresql-x64-$Version",
    "postgresql*$Version*"
  )
  foreach ($pattern in $patterns) {
    $svc = Get-Service -Name $pattern -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc) { return $svc.Name }
  }
  return $null
}

function Complete-BinPaths([string]$BinPath, [string]$Version) {
  $psql = Join-Path $BinPath 'psql.exe'
  if (-not (Test-Path $psql)) { return $null }

  $pgDump = Join-Path $BinPath 'pg_dump.exe'
  if (-not (Test-Path $pgDump)) { $pgDump = $null }

  $pgIsReady = Join-Path $BinPath 'pg_isready.exe'
  if (-not (Test-Path $pgIsReady)) { $pgIsReady = $null }

  $service = Find-ServiceForVersion $Version
  $port = 5432

  return @{
    Version       = $Version
    BinPath       = $BinPath
    PsqlPath      = $psql
    PgDumpPath    = $pgDump
    PgIsReadyPath = $pgIsReady
    ServiceName   = $service
    Port          = $port
  }
}

$candidates = @()

# 1) Registry (EDB installer keys)
$regRoots = @(
  'HKLM:\SOFTWARE\PostgreSQL\Installations',
  'HKLM:\SOFTWARE\WOW6432Node\PostgreSQL\Installations'
)
foreach ($root in $regRoots) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem $root -ErrorAction SilentlyContinue | ForEach-Object {
    $base = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).'Base Directory'
    if (-not $base) { $base = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).BaseDirectory }
    if (-not $base) { return }
    $bin = Join-Path $base 'bin'
    $ver = Get-VersionFromPath $base
    if (-not $ver) { $ver = Get-VersionFromPath $_.PSChildName }
    if ($bin -and (Test-Path (Join-Path $bin 'psql.exe'))) {
      $candidates += [pscustomobject]@{ Version = $ver; BinPath = $bin; Source = 'registry' }
    }
  }
}

# 2) Windows services → infer version
Get-Service -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match 'postgres' } |
  ForEach-Object {
    $ver = $null
    if ($_.Name -match '(\d{2})$') { $ver = $Matches[1] }
    elseif ($_.DisplayName -match 'PostgreSQL\s+(\d+)') { $ver = $Matches[1] }
    if ($ver) {
      $bin = Join-Path ${env:ProgramFiles} "PostgreSQL\$ver\bin"
      if (Test-Path (Join-Path $bin 'psql.exe')) {
        $candidates += [pscustomobject]@{ Version = $ver; BinPath = $bin; Source = 'service' }
      }
    }
  }

# 3) Program Files\PostgreSQL\{14..18}
$pf = ${env:ProgramFiles}
if ($pf) {
  foreach ($ver in $PreferredVersions) {
    $bin = Join-Path $pf "PostgreSQL\$ver\bin"
    if (Test-Path (Join-Path $bin 'psql.exe')) {
      $candidates += [pscustomobject]@{ Version = $ver; BinPath = $bin; Source = 'programfiles' }
    }
  }
  # Any other version folders
  $pgRoot = Join-Path $pf 'PostgreSQL'
  if (Test-Path $pgRoot) {
    Get-ChildItem $pgRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      $ver = $_.Name
      $bin = Join-Path $_.FullName 'bin'
      if (Test-Path (Join-Path $bin 'psql.exe')) {
        $candidates += [pscustomobject]@{ Version = $ver; BinPath = $bin; Source = 'programfiles' }
      }
    }
  }
}

# 4) PATH
$cmd = Get-Command psql.exe -ErrorAction SilentlyContinue
if ($cmd) {
  $bin = Split-Path -Parent $cmd.Source
  $ver = Get-VersionFromPath $bin
  $candidates += [pscustomobject]@{ Version = $ver; BinPath = $bin; Source = 'path' }
}

if ($candidates.Count -eq 0) {
  New-DetectionResult -Installed $false
  exit 0
}

# Prefer highest known version (18→14), then any other
$selected = $null
foreach ($ver in $PreferredVersions) {
  $selected = $candidates | Where-Object { $_.Version -eq $ver } | Select-Object -First 1
  if ($selected) { break }
}
if (-not $selected) {
  $selected = $candidates |
    Sort-Object { if ($_.Version -match '^\d+$') { [int]$_.Version } else { 0 } } -Descending |
    Select-Object -First 1
}

$info = Complete-BinPaths -BinPath $selected.BinPath -Version $selected.Version
if (-not $info) {
  New-DetectionResult -Installed $false
  exit 0
}

New-DetectionResult `
  -Installed $true `
  -Version $info.Version `
  -BinPath $info.BinPath `
  -PsqlPath $info.PsqlPath `
  -PgDumpPath $info.PgDumpPath `
  -PgIsReadyPath $info.PgIsReadyPath `
  -ServiceName $info.ServiceName `
  -Port $info.Port

exit 0
