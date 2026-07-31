# Runs prisma migrate deploy + safe seed using portable Node.
# Safe seed skip (users already exist) is SUCCESS (exit 0).
param(
  [Parameter(Mandatory = $true)][string]$AppDir,
  [Parameter(Mandatory = $true)][string]$DatabaseUrl,
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

function Invoke-LoggedProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()
  try {
    # Single argument string with quotes - Start-Process array form breaks "Program Files"
    $argString = ($ArgumentList | ForEach-Object { Quote-Arg $_ }) -join ' '
    Write-Log ('EXEC: {0} {1}' -f $FilePath, $argString)

    $proc = Start-Process -FilePath $FilePath `
      -ArgumentList $argString `
      -WorkingDirectory $WorkingDirectory `
      -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $stdoutFile `
      -RedirectStandardError $stderrFile

    $stdout = Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue
    $stderr = Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue
    if ($stdout) { Write-Log $stdout.TrimEnd() }
    if ($stderr) { Write-Log ('[stderr] {0}' -f $stderr.TrimEnd()) }

    if ($null -eq $proc.ExitCode) { return 1 }
    return [int]$proc.ExitCode
  }
  finally {
    Remove-Item -LiteralPath $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
  }
}

$nodeExe = Join-Path $AppDir 'resources\runtime\node\node.exe'
$backendDir = Join-Path $AppDir 'resources\backend'
$prismaCli = Join-Path $backendDir 'node_modules\prisma\build\index.js'
$seedProd = Join-Path $backendDir 'prisma\seed-prod.mjs'
$tsxCli = Join-Path $backendDir 'node_modules\tsx\dist\cli.mjs'
$seedTs = Join-Path $backendDir 'prisma\seed.ts'

if (-not (Test-Path -LiteralPath $nodeExe)) { Write-Log ('Portable Node missing: {0}' -f $nodeExe); exit 1 }
if (-not (Test-Path -LiteralPath $backendDir)) { Write-Log ('Backend missing: {0}' -f $backendDir); exit 1 }
if (-not (Test-Path -LiteralPath $prismaCli)) { Write-Log ('Prisma CLI missing: {0}' -f $prismaCli); exit 1 }

$env:DATABASE_URL = $DatabaseUrl
$env:DOTENV_CONFIG_PATH = Join-Path $env:APPDATA 'Kantin POS\config\.env'
$env:ELECTRON_USER_DATA_PATH = Join-Path $env:APPDATA 'Kantin POS'
$env:NODE_ENV = 'production'

try {
  Write-Log 'Running prisma migrate deploy...'
  $migrateCode = Invoke-LoggedProcess -FilePath $nodeExe -ArgumentList @($prismaCli, 'migrate', 'deploy') -WorkingDirectory $backendDir
  if ($migrateCode -ne 0) {
    Write-Log ('prisma migrate deploy failed ({0})' -f $migrateCode)
    exit $migrateCode
  }
  Write-Log 'prisma migrate deploy OK'

  Write-Log 'Running production seed (safe mode)...'
  $seedCode = 1
  if (Test-Path -LiteralPath $seedProd) {
    $seedCode = Invoke-LoggedProcess -FilePath $nodeExe -ArgumentList @($seedProd) -WorkingDirectory $backendDir
  }
  elseif (Test-Path -LiteralPath $tsxCli) {
    $seedCode = Invoke-LoggedProcess -FilePath $nodeExe -ArgumentList @($tsxCli, $seedTs) -WorkingDirectory $backendDir
  }
  else {
    Write-Log 'No seed-prod.mjs or tsx found'
    exit 1
  }

  if ($seedCode -ne 0) {
    Write-Log ('seed failed ({0})' -f $seedCode)
    exit $seedCode
  }

  Write-Log 'Prisma setup completed.'
  exit 0
}
catch {
  Write-Log ('Invoke-PrismaSetup FAILED: {0}' -f $_)
  exit 1
}
