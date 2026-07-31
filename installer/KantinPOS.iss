; Kantin Barkod Sistemi — Inno Setup installer
; AppData remains "%APPDATA%\Kantin POS" (Electron productName / setName)
;
; Build: npm run dist:installer

#define MyAppName "Kantin Barkod Sistemi"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Kantin Barkod"
#define MyAppExeName "Kantin POS.exe"
#define MyAppId "com.kantinbarkod.sistemi"

#ifexist "vendor\postgresql-windows-x64.exe"
  #define HAS_PG_VENDOR "1"
#else
  #define HAS_PG_VENDOR "0"
#endif

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\KantinBarkod
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\dist-installer
OutputBaseFilename=Kantin-Barkod-Setup
#ifexist "..\build\icon.ico"
SetupIconFile=..\build\icon.ico
#endif
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=yes
RestartIfNeededByRun=no

[Languages]
Name: "en"; MessagesFile: "compiler:Default.isl"

[Messages]
WelcomeLabel1=Kantin Barkod Sistemi Kurulumuna Hoş Geldiniz
WelcomeLabel2=Bu sihirbaz Kantin Barkod Sistemi uygulamasını, veritabanını ve gerekli bileşenleri bilgisayarınıza kuracaktır.%n%nKuruluma devam etmeden önce diğer uygulamaları kapatmanız önerilir.
FinishedLabel=Kantin Barkod Sistemi başarıyla kuruldu.%n%nGiriş bilgileri:%n  Kullanıcı: admin%n  Şifre: admin123%n%nİlk girişten sonra şifrenizi değiştirmeniz önerilir.
ButtonNext=İleri >
ButtonBack=< Geri
ButtonFinish=Bitir
ButtonCancel=İptal

[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Ek görevler:"; Flags: checkedonce

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

Source: "scripts\Detect-PostgreSQL.ps1"; Flags: dontcopy
Source: "scripts\Install-PostgreSQL.ps1"; Flags: dontcopy
Source: "scripts\Initialize-Database.ps1"; Flags: dontcopy
Source: "scripts\Write-AppConfig.ps1"; Flags: dontcopy
Source: "scripts\Invoke-PrismaSetup.ps1"; Flags: dontcopy
Source: "scripts\Test-ApiHealth.ps1"; Flags: dontcopy
Source: "scripts\Install-PostSteps.ps1"; Flags: dontcopy

#ifexist "vendor\postgresql-windows-x64.exe"
Source: "vendor\postgresql-windows-x64.exe"; Flags: dontcopy
#endif

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Kaldır {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{#MyAppName} uygulamasını başlat"; Flags: nowait postinstall skipifsilent

[Code]
var
  PgPasswordPage: TInputQueryWizardPage;
  ProgressPage: TOutputProgressWizardPage;
  StatusFile: String;
  ScriptsReady: Boolean;

function InstallLogPath(): String;
begin
  Result := ExpandConstant('{userappdata}\Kantin POS\logs\install.log');
end;

procedure EnsureSetupScripts;
begin
  if ScriptsReady then Exit;
  ExtractTemporaryFile('Detect-PostgreSQL.ps1');
  ExtractTemporaryFile('Install-PostgreSQL.ps1');
  ExtractTemporaryFile('Initialize-Database.ps1');
  ExtractTemporaryFile('Write-AppConfig.ps1');
  ExtractTemporaryFile('Invoke-PrismaSetup.ps1');
  ExtractTemporaryFile('Test-ApiHealth.ps1');
  ExtractTemporaryFile('Install-PostSteps.ps1');
  ScriptsReady := True;
end;

function ScriptPath(const Name: String): String;
begin
  Result := ExpandConstant('{tmp}\' + Name);
end;

{ Inno Setup uses FileCopy; wrap with clear name for readability }
function CopyFileTo(const SourceFile, DestFile: String): Boolean;
begin
  Result := FileCopy(SourceFile, DestFile, False);
end;

function ResolvePostgresInstaller(): String;
var
  Dest: String;
begin
  Result := '';
  Dest := ExpandConstant('{tmp}\kantin-setup\postgresql-windows-x64.exe');
  ForceDirectories(ExpandConstant('{tmp}\kantin-setup'));

  if '{#HAS_PG_VENDOR}' = '1' then
  begin
    ExtractTemporaryFile('postgresql-windows-x64.exe');
    if CopyFileTo(ExpandConstant('{tmp}\postgresql-windows-x64.exe'), Dest) then
      Result := Dest;
  end;

  if (Result = '') and FileExists(ExpandConstant('{src}\postgresql-windows-x64.exe')) then
  begin
    if CopyFileTo(ExpandConstant('{src}\postgresql-windows-x64.exe'), Dest) then
      Result := Dest
    else
      Result := ExpandConstant('{src}\postgresql-windows-x64.exe');
  end;
end;

function HasPostgresInstallerAvailable(): Boolean;
begin
  Result :=
    ('{#HAS_PG_VENDOR}' = '1') or
    FileExists(ExpandConstant('{src}\postgresql-windows-x64.exe'));
end;

function IsPostgresInstalled(): Boolean;
var
  ResultCode: Integer;
  OutputFile: String;
  Lines: TArrayOfString;
  Json: String;
  Cmd: String;
begin
  Result := False;
  EnsureSetupScripts;
  OutputFile := ExpandConstant('{tmp}\pg-detect.json');
  Cmd :=
    '-NoProfile -ExecutionPolicy Bypass -Command ' +
    '"& ''' + ScriptPath('Detect-PostgreSQL.ps1') + ''' | ' +
    'Set-Content -Encoding UTF8 ''' + OutputFile + '''"';

  if Exec('powershell.exe', Cmd, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    if LoadStringsFromFile(OutputFile, Lines) and (GetArrayLength(Lines) > 0) then
    begin
      Json := Lines[0];
      Result :=
        (Pos('"Installed":true', Json) > 0) or
        (Pos('"Installed": true', Json) > 0) or
        (Pos('"installed":true', Json) > 0) or
        (Pos('"installed": true', Json) > 0);
    end;
  end;
end;

procedure InitializeWizard;
begin
  ScriptsReady := False;
  EnsureSetupScripts;

  PgPasswordPage := CreateInputQueryPage(wpSelectDir,
    'PostgreSQL hazırlığı',
    'Veritabanı süper kullanıcı şifresi',
    'Kurulum adımları:' + #13#10 +
    '  1) Hoş geldiniz' + #13#10 +
    '  2) PostgreSQL hazırlanıyor' + #13#10 +
    '  3) Database hazırlanıyor' + #13#10 +
    '  4) Sistem kuruluyor' + #13#10 +
    '  5) Tamamlandı' + #13#10#13#10 +
    'PostgreSQL "postgres" hesabı şifresini girin.' + #13#10 +
    '• Yeni kurulum: bu şifre postgres kullanıcısına atanır.' + #13#10 +
    '• Mevcut kurulum: bilgisayarınızdaki postgres şifresini yazın.');
  PgPasswordPage.Add('PostgreSQL postgres şifresi:', True);

  ProgressPage := CreateOutputProgressPage('Sistem kuruluyor', 'Lütfen bekleyin…');
  StatusFile := ExpandConstant('{tmp}\kantin-setup-status.txt');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PgPasswordPage.ID then
  begin
    if Trim(PgPasswordPage.Values[0]) = '' then
    begin
      MsgBox('PostgreSQL şifresi zorunludur.', mbError, MB_OK);
      Result := False;
      exit;
    end;

    if not IsPostgresInstalled() then
    begin
      if not HasPostgresInstallerAvailable() then
      begin
        MsgBox(
          'Bu bilgisayarda PostgreSQL bulunamadı.' + #13#10#13#10 +
          'Şunlardan birini yapın:' + #13#10 +
          '1) PostgreSQL kurun ve kurulumu yeniden çalıştırın, veya' + #13#10 +
          '2) EDB PostgreSQL Windows x64 installer dosyasını Setup.exe yanına' + #13#10 +
          '   postgresql-windows-x64.exe adıyla koyun.',
          mbError, MB_OK);
        Result := False;
      end;
    end;
  end;
end;

procedure RunPostSteps;
var
  ResultCode: Integer;
  Args: String;
  PassFile: String;
  PgInstaller: String;
  SetupDir: String;
begin
  EnsureSetupScripts;

  SetupDir := ExpandConstant('{tmp}\kantin-setup');
  ForceDirectories(SetupDir);
  CopyFileTo(ScriptPath('Detect-PostgreSQL.ps1'), SetupDir + '\Detect-PostgreSQL.ps1');
  CopyFileTo(ScriptPath('Install-PostgreSQL.ps1'), SetupDir + '\Install-PostgreSQL.ps1');
  CopyFileTo(ScriptPath('Initialize-Database.ps1'), SetupDir + '\Initialize-Database.ps1');
  CopyFileTo(ScriptPath('Write-AppConfig.ps1'), SetupDir + '\Write-AppConfig.ps1');
  CopyFileTo(ScriptPath('Invoke-PrismaSetup.ps1'), SetupDir + '\Invoke-PrismaSetup.ps1');
  CopyFileTo(ScriptPath('Test-ApiHealth.ps1'), SetupDir + '\Test-ApiHealth.ps1');
  CopyFileTo(ScriptPath('Install-PostSteps.ps1'), SetupDir + '\Install-PostSteps.ps1');

  PassFile := ExpandConstant('{tmp}\kantin-pg-pass.txt');
  SaveStringToFile(PassFile, PgPasswordPage.Values[0], False);

  PgInstaller := ResolvePostgresInstaller();

  Args :=
    '-NoProfile -ExecutionPolicy Bypass -File "' + SetupDir + '\Install-PostSteps.ps1"' +
    ' -AppDir "' + ExpandConstant('{app}') + '"' +
    ' -PostgresSuperPasswordFile "' + PassFile + '"' +
    ' -StatusFile "' + StatusFile + '"';

  if PgInstaller <> '' then
    Args := Args + ' -PostgresInstaller "' + PgInstaller + '"';

  ProgressPage.SetText('PostgreSQL hazırlanıyor…', '');
  ProgressPage.SetProgress(1, 4);
  ProgressPage.Show;
  try
    ProgressPage.SetText('Database ve sistem kuruluyor…', 'Migration, seed, sağlık kontrolü');
    ProgressPage.SetProgress(2, 4);

    if not Exec('powershell.exe', Args, '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      RaiseException(
        'Kurulum sonrası betik başlatılamadı.' + #13#10#13#10 +
        'Log: ' + InstallLogPath());
    end;

    if ResultCode <> 0 then
    begin
      RaiseException(
        'Kurulum sonrası yapılandırma başarısız oldu.' + #13#10#13#10 +
        'Ayrıntılar için log dosyasına bakın:' + #13#10 +
        InstallLogPath());
    end;

    ProgressPage.SetText('Tamamlandı', 'Kantin Barkod Sistemi hazır');
    ProgressPage.SetProgress(4, 4);
  finally
    ProgressPage.Hide;
    DeleteFile(PassFile);
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  { Single failure path: RaiseException only (no prior MsgBox) }
  if CurStep = ssPostInstall then
    RunPostSteps;
end;
