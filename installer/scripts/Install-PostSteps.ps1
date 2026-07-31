<#
.SYNOPSIS
  Kantin Barkod post-install orchestrator (called by Inno Setup).
  Each step records its own exit code. Successful install always ends with exit 0.
#>
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [string]$PostgresInstaller = '',
  [string]$PostgresSuperPassword = '',
  [string]$PostgresSuperPasswordFile = '',
  [string]$StatusFile = '',
  [int]$PgPort = 5432
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$appDataRoot = Join-Path $env:APPDATA 'Kantin POS'
$logsDir = Join-Path $appDataRoot 'logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$installLog = Join-Path $logsDir 'install.log'

function Write-Status([string]$Message) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'o'), $Message
  Write-Host $line
  Add-Content -Path $installLog -Value $line -Encoding UTF8
  if ($StatusFile) {
    Set-Content -Path $StatusFile -Value $Message -Encoding UTF8
  }
}

function Quote-ProcessArg([string]$Value) {
  if ($null -eq $Value) { return '""' }
  # Start-Process single-string ArgumentList: quote values with whitespace
  if ($Value -match '[\s"]') {
    return '"' + ($Value -replace '"', '\"') + '"'
  }
  return $Value
}

function Invoke-Step {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  Write-Status ("STEP START: {0}" -f $Name)
  Write-Status ("STEP FILE: {0}" -f $FilePath)

  # CRITICAL: Do NOT pass -ArgumentList as a PowerShell array to Start-Process.
  # Paths with spaces (Program Files, Kantin POS) get split and child scripts fail.
  $parts = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', (Quote-ProcessArg $FilePath)
  )
  foreach ($a in $ArgumentList) {
    $parts += (Quote-ProcessArg $a)
  }
  $argString = ($parts -join ' ')

  Write-Status ("STEP ARGS: {0}" -f $argString)

  $proc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList $argString `
    -NoNewWindow -Wait -PassThru

  $code = $proc.ExitCode
  if ($null -eq $code) { $code = 1 }

  Write-Status ("STEP END: {0} -> exit {1}" -f $Name, $code)
  return [int]$code
}

function New-AppSecret([int]$Length = 32) {
  $bytes = New-Object byte[] $Length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return ([BitConverter]::ToString($bytes) -replace '-', '').ToLowerInvariant()
}

function New-DbPassword {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $chars = for ($i = 0; $i -lt 24; $i++) {
    $alphabet[(Get-Random -Maximum $alphabet.Length)]
  }
  return -join $chars
}

function Get-Prop($obj, [string]$Name, [string]$FallbackName = $null) {
  if ($null -eq $obj) { return $null }
  $p = $obj.PSObject.Properties[$Name]
  if ($p) { return $p.Value }
  if ($FallbackName) {
    $p2 = $obj.PSObject.Properties[$FallbackName]
    if ($p2) { return $p2.Value }
  }
  return $null
}

try {
  if ($PostgresSuperPasswordFile -and (Test-Path $PostgresSuperPasswordFile)) {
    $PostgresSuperPassword = (Get-Content -Path $PostgresSuperPasswordFile -Raw).Trim()
  }
  if (-not $PostgresSuperPassword) {
    throw 'PostgreSQL superuser password is required.'
  }
  if (-not (Test-Path $AppDir)) {
    throw "AppDir not found: $AppDir"
  }

  Write-Status "Install log: $installLog"
  Write-Status "AppDir: $AppDir"

  $detectScript = Join-Path $scriptDir 'Detect-PostgreSQL.ps1'
  $installPgScript = Join-Path $scriptDir 'Install-PostgreSQL.ps1'
  $initDbScript = Join-Path $scriptDir 'Initialize-Database.ps1'
  $writeConfigScript = Join-Path $scriptDir 'Write-AppConfig.ps1'
  $prismaScript = Join-Path $scriptDir 'Invoke-PrismaSetup.ps1'
  $healthScript = Join-Path $scriptDir 'Test-ApiHealth.ps1'

  # TEMP DEBUG: which Initialize-Database.ps1 is used by Setup
  Write-Status "ScriptDir: $scriptDir"
  Write-Status "Initialize path: $initDbScript"
  Write-Status "Exists: $(Test-Path -LiteralPath $initDbScript)"
  if (Test-Path -LiteralPath $initDbScript) {
    Write-Status "LastWrite: $((Get-Item -LiteralPath $initDbScript).LastWriteTime)"
  }

  # --- 1) PostgreSQL detect ---
  Write-Status 'PostgreSQL hazırlanıyor…'
  $detectOutFile = Join-Path $env:TEMP 'kantin-pg-detect.json'
  $detectProc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $detectScript) `
    -NoNewWindow -Wait -PassThru `
    -RedirectStandardOutput $detectOutFile `
    -RedirectStandardError (Join-Path $env:TEMP 'kantin-pg-detect.err')

  $detectCode = if ($null -eq $detectProc.ExitCode) { 1 } else { [int]$detectProc.ExitCode }
  Write-Status "STEP END: Detect-PostgreSQL → exit $detectCode"
  if ($detectCode -ne 0) { throw "PostgreSQL detection failed (exit $detectCode)" }

  $detectJson = Get-Content -Path $detectOutFile -Raw -ErrorAction SilentlyContinue
  $detect = $null
  if ($detectJson) {
    try { $detect = $detectJson | ConvertFrom-Json } catch { Write-Status "Detect JSON parse warning: $_" }
  }

  $installed = $false
  if ($detect) {
    $flag = Get-Prop $detect 'Installed' 'installed'
    $installed = ($flag -eq $true -or "$flag" -eq 'True')
  }

  $psqlPath = $null
  $pgDumpPath = ''
  $pgPort = $PgPort

  if ($installed) {
    Write-Status "Mevcut PostgreSQL kullanılıyor (v$(Get-Prop $detect 'Version'))"
    $psqlPath = Get-Prop $detect 'PsqlPath' 'psql'
    $pgDumpPath = Get-Prop $detect 'PgDumpPath' 'pgDump'
    $detectedPort = Get-Prop $detect 'Port'
    if ($detectedPort) { $pgPort = [int]$detectedPort }
  } else {
    if (-not $PostgresInstaller -or -not (Test-Path $PostgresInstaller)) {
      throw 'PostgreSQL kurulu değil ve installer bulunamadı (postgresql-windows-x64.exe).'
    }
    Write-Status 'PostgreSQL sessiz kurulumu başlıyor…'
    $installOut = Join-Path $env:TEMP 'kantin-pg-install.json'
    $installProc = Start-Process -FilePath 'powershell.exe' `
      -ArgumentList @(
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $installPgScript,
        '-InstallerPath', $PostgresInstaller,
        '-SuperPassword', $PostgresSuperPassword,
        '-Port', "$pgPort",
        '-DetectScript', $detectScript
      ) `
      -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $installOut `
      -RedirectStandardError (Join-Path $env:TEMP 'kantin-pg-install.err')

    $installCode = if ($null -eq $installProc.ExitCode) { 1 } else { [int]$installProc.ExitCode }
    Write-Status "STEP END: Install-PostgreSQL → exit $installCode"
    if ($installCode -ne 0) { throw "PostgreSQL install failed (exit $installCode)" }

    $installJson = Get-Content -Path $installOut -Raw -ErrorAction SilentlyContinue
    $installedInfo = $installJson | ConvertFrom-Json
    $psqlPath = Get-Prop $installedInfo 'PsqlPath' 'psql'
    $pgDumpPath = Get-Prop $installedInfo 'PgDumpPath' 'pgDump'
    $detectedPort = Get-Prop $installedInfo 'Port'
    if ($detectedPort) { $pgPort = [int]$detectedPort }
  }

  if (-not $psqlPath -or -not (Test-Path $psqlPath)) {
    throw "psql.exe bulunamadı. Algılanan yol: $psqlPath"
  }
  Write-Status "Using psql: $psqlPath"
  if ($pgDumpPath) { Write-Status "Using pg_dump: $pgDumpPath" }

  # --- 2) Database ---
  Write-Status 'Database hazırlanıyor…'
  $appPassword = New-DbPassword
  $jwtSecret = New-AppSecret 32

  $dbCode = Invoke-Step -Name 'Initialize-Database' -FilePath $initDbScript -ArgumentList @(
    '-PsqlPath', $psqlPath,
    '-SuperPassword', $PostgresSuperPassword,
    '-AppPassword', $appPassword,
    '-Port', "$pgPort",
    '-LogFile', $installLog
  )
  if ($dbCode -ne 0) { throw "Database hazırlama başarısız (exit $dbCode). Log: $installLog" }

  $databaseUrl = "postgresql://kantin:${appPassword}@127.0.0.1:${pgPort}/kantin_pos?schema=public"

  # --- 3) Config ---
  Write-Status 'Yapılandırma yazılıyor…'
  $cfgArgs = @(
    '-DatabaseUrl', $databaseUrl,
    '-JwtSecret', $jwtSecret,
    '-Port', '3001',
    '-BackendDir', (Join-Path $AppDir 'resources\backend'),
    '-LogFile', $installLog
  )
  if ($pgDumpPath) { $cfgArgs += @('-PgDumpPath', $pgDumpPath) }

  $cfgCode = Invoke-Step -Name 'Write-AppConfig' -FilePath $writeConfigScript -ArgumentList $cfgArgs
  if ($cfgCode -ne 0) { throw "Config yazılamadı (exit $cfgCode). Log: $installLog" }

  # --- 4) Prisma ---
  Write-Status 'Sistem kuruluyor (migration + seed)…'
  $prismaCode = Invoke-Step -Name 'Invoke-PrismaSetup' -FilePath $prismaScript -ArgumentList @(
    '-AppDir', $AppDir,
    '-DatabaseUrl', $databaseUrl,
    '-LogFile', $installLog
  )
  if ($prismaCode -ne 0) { throw "Prisma kurulumu başarısız (exit $prismaCode). Log: $installLog" }

  # --- 5) Health ---
  Write-Status 'API sağlık kontrolü…'
  $healthCode = Invoke-Step -Name 'Test-ApiHealth' -FilePath $healthScript -ArgumentList @(
    '-AppDir', $AppDir,
    '-Port', '3001',
    '-LogFile', $installLog
  )
  if ($healthCode -ne 0) { throw "API health check başarısız (exit $healthCode). Log: $installLog" }

  Write-Status 'Kurulum tamamlandı.'
  exit 0
} catch {
  Write-Status "FAILED: $_"
  Write-Status "See log: $installLog"
  exit 1
}
