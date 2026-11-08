; Kantin Barkod POS — Inno Setup installer
; AppData remains "%APPDATA%\Kantin POS" (Electron productName / setName)
;
; Build: npm run dist:installer

#define MyAppName "Kantin Barkod POS"
#define MyAppVersion "1.0.1"
#define MyAppPublisher "Kantin Barkod"
#define MyAppExeName "Kantin Barkod POS.exe"
#define MyAppId "com.kantinbarkod.sistemi"

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\KantinBarkod
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=..\release
OutputBaseFilename=KantinBarkodPOS-Setup-x64
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
WelcomeLabel1=Kantin Barkod POS Kurulumuna Hoş Geldiniz
WelcomeLabel2=Bu sihirbaz Kantin Barkod POS uygulamasını bilgisayarınıza kuracaktır. PostgreSQL veritabanınıza dokunulmayacak veya veritabanı değiştirilmeden bırakılacaktır.%n%nİlk açılışta PostgreSQL bağlantı şifresi güvenli şekilde istenir.
FinishedLabel=Kantin Barkod POS başarıyla kuruldu.
ButtonNext=İleri >
ButtonBack=< Geri
ButtonFinish=Bitir
ButtonCancel=İptal

[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Ek görevler:"; Flags: checkedonce

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Kaldır {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{#MyAppName} uygulamasını başlat"; Flags: nowait postinstall skipifsilent runasoriginaluser
