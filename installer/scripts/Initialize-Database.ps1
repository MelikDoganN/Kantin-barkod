# Creates application role + database (idempotent).
param(
  [Parameter(Mandatory = $true)][string]$PsqlPath,
  [Parameter(Mandatory = $true)][string]$SuperPassword,
  [Parameter(Mandatory = $true)][string]$AppPassword,
  [string]$SuperUser = 'postgres',
  [string]$HostName = '127.0.0.1',
  [int]$Port = 5432,
  [string]$AppUser = 'kantin',
  [string]$AppDatabase = 'kantin_pos',
  [string]$LogFile = ''
)

$ErrorActionPreference = 'Stop'

function Write-Log {
  param([Parameter(Mandatory = $true)][string]$Message)
  $line = '[{0}] {1}' -f (Get-Date -Format 'o'), $Message
  Write-Host $line
  if ($LogFile) {
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
  }
}

if (-not (Test-Path -LiteralPath $PsqlPath)) {
  Write-Log -Message ('psql not found: {0}' -f $PsqlPath)
  exit 1
}

$env:PGPASSWORD = $SuperPassword

function Invoke-Psql {
  param(
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$Sql
  )

  # Write SQL to a temp file and run: psql -f file
  # Avoids Start-Process -ArgumentList splitting on spaces inside -c "CREATE USER ..."
  $sqlFile = [System.IO.Path]::ChangeExtension([System.IO.Path]::GetTempFileName(), '.sql')
  $stderrFile = [System.IO.Path]::GetTempFileName()
  $stdoutFile = [System.IO.Path]::GetTempFileName()

  try {
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($sqlFile, $Sql.TrimEnd() + [Environment]::NewLine, $utf8NoBom)

    $argList = @(
      '-h', $HostName,
      '-p', "$Port",
      '-U', $SuperUser,
      '-d', $Database,
      '-v', 'ON_ERROR_STOP=1',
      '-t', '-A',
      '-f', $sqlFile
    )

    $proc = Start-Process -FilePath $PsqlPath -ArgumentList $argList `
      -NoNewWindow -Wait -PassThru `
      -RedirectStandardOutput $stdoutFile `
      -RedirectStandardError $stderrFile

    $stdout = Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue
    $stderr = Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue

    if ($proc.ExitCode -ne 0) {
      Write-Log -Message ('psql failed (db={0}, code={1})' -f $Database, $proc.ExitCode)
      if ($stderr) {
        Write-Log -Message ('psql stderr: {0}' -f $stderr.Trim())
      }
      if ($stdout) {
        Write-Log -Message ('psql stdout: {0}' -f $stdout.Trim())
      }
      Write-Log -Message ('psql sql file was: {0}' -f $sqlFile)
      throw ('psql failed with exit code {0}' -f $proc.ExitCode)
    }

    if ($null -eq $stdout) {
      return ''
    }
    return $stdout.Trim()
  }
  finally {
    Remove-Item -LiteralPath $stderrFile, $stdoutFile, $sqlFile -Force -ErrorAction SilentlyContinue
  }
}

try {
  Write-Log -Message ('Preparing database {0} / user {1} via {2}' -f $AppDatabase, $AppUser, $PsqlPath)

  $roleExists = Invoke-Psql -Database 'postgres' -Sql ("SELECT 1 FROM pg_roles WHERE rolname = '{0}'" -f $AppUser)
  $pwdLiteral = $AppPassword.Replace("'", "''")

  if ($roleExists -ne '1') {
    Invoke-Psql -Database 'postgres' -Sql ("CREATE USER {0} WITH PASSWORD '{1}';" -f $AppUser, $pwdLiteral) | Out-Null
    Write-Log -Message ('Created role {0}' -f $AppUser)
  }
  else {
    Invoke-Psql -Database 'postgres' -Sql ("ALTER USER {0} WITH PASSWORD '{1}';" -f $AppUser, $pwdLiteral) | Out-Null
    Write-Log -Message ('Role {0} already exists - password updated' -f $AppUser)
  }

  $dbExists = Invoke-Psql -Database 'postgres' -Sql ("SELECT 1 FROM pg_database WHERE datname = '{0}'" -f $AppDatabase)
  if ($dbExists -ne '1') {
    Invoke-Psql -Database 'postgres' -Sql ("CREATE DATABASE {0} OWNER {1};" -f $AppDatabase, $AppUser) | Out-Null
    Write-Log -Message ('Created database {0}' -f $AppDatabase)
  }
  else {
    Write-Log -Message ('Database {0} already exists - skipped CREATE' -f $AppDatabase)
  }

  Invoke-Psql -Database 'postgres' -Sql ("GRANT ALL PRIVILEGES ON DATABASE {0} TO {1};" -f $AppDatabase, $AppUser) | Out-Null

  try {
    Invoke-Psql -Database $AppDatabase -Sql ("GRANT ALL ON SCHEMA public TO {0};" -f $AppUser) | Out-Null
    Invoke-Psql -Database $AppDatabase -Sql ("ALTER SCHEMA public OWNER TO {0};" -f $AppUser) | Out-Null
  }
  catch {
    Write-Log -Message ('Schema grant warning (non-fatal): {0}' -f $_)
  }

  Write-Log -Message 'Database preparation completed.'
  exit 0
}
catch {
  Write-Log -Message ('Database preparation FAILED: {0}' -f $_)
  exit 1
}
finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
