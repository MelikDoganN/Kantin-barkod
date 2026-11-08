import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'node:path'
import { startBackendProcess, stopBackendProcess } from './backend-process'
import {
  loadDatabaseCredentials,
  saveDatabasePassword,
  toDatabaseUrl,
} from './database-credentials'
import {
  appendLog,
  ensureUserDataDirs,
  getRendererDist,
  isPackaged,
} from './paths'

// Keep existing user data under %APPDATA%\Kantin POS across upgrades.
app.setName('Kantin Barkod POS')
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'Kantin POS'))
} catch {
  // ignore if called too late in some edge cases
}

process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let win: BrowserWindow | null = null
let setupWindow: BrowserWindow | null = null
let backendStartedByUs = false

function showDatabaseSetup(): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false
    const finish = (saved: boolean) => {
      if (finished) return
      finished = true
      ipcMain.removeHandler('db-credentials:save')
      setupWindow = null
      resolve(saved)
    }

    setupWindow = new BrowserWindow({
      width: 520,
      height: 480,
      resizable: false,
      title: 'PostgreSQL bağlantısı',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    })

    ipcMain.handle('db-credentials:save', (event, password: unknown) => {
      if (event.sender !== setupWindow?.webContents) {
        return { ok: false, error: 'İstek doğrulanamadı.' }
      }
      if (typeof password !== 'string' || !password.trim()) {
        return { ok: false, error: 'PostgreSQL şifresini girin.' }
      }
      try {
        saveDatabasePassword(password)
        const currentWindow = setupWindow
        finish(true)
        currentWindow?.close()
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    setupWindow.once('ready-to-show', () => setupWindow?.show())
    setupWindow.on('closed', () => finish(false))
    const html = `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PostgreSQL bağlantısı</title><style>
      *{box-sizing:border-box}body{margin:0;background:#f1f5f9;color:#0f172a;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:grid;min-height:100vh;place-items:center}.card{width:100%;padding:36px 40px;background:#fff}.badge{color:#2563eb;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase}h1{font-size:25px;margin:10px 0 8px}p{color:#475569;line-height:1.55;margin:0 0 20px}.details{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:13px 15px;margin-bottom:20px;line-height:1.7;color:#334155}.details b{color:#0f172a}label{display:block;font-weight:600;margin:0 0 8px}input{width:100%;height:44px;border:1px solid #cbd5e1;border-radius:8px;padding:0 12px;font-size:16px;outline:none}input:focus{border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}button{width:100%;margin-top:16px;height:44px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;cursor:pointer}button:disabled{opacity:.6;cursor:wait}.note{font-size:12px;color:#64748b;margin-top:14px}.error{color:#b91c1c;min-height:20px;margin-top:8px}
      </style><body><main class="card"><div class="badge">İlk kurulum · Kantin Barkod POS</div><h1>PostgreSQL bağlantısı</h1><p>Veritabanı bağlantısını etkinleştirmek için PostgreSQL şifresini bir kez girin.</p><div class="details"><b>Sunucu:</b> localhost:5432<br><b>Veritabanı:</b> kantin_pos<br><b>Kullanıcı:</b> postgres</div><form id="form"><label for="password">PostgreSQL şifresi</label><input id="password" type="password" autocomplete="current-password" required autofocus><div class="error" id="error" role="alert"></div><button id="submit" type="submit">Güvenli kaydet ve bağlan</button></form><div class="note">Şifre Windows DPAPI ile bu Windows hesabına bağlı olarak şifrelenir. Kaynak kodda veya kurulum dosyasında saklanmaz.</div></main><script>
      const form=document.getElementById('form'),input=document.getElementById('password'),error=document.getElementById('error'),button=document.getElementById('submit');form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;error.textContent='';try{const result=await window.kantinPos.saveDatabasePassword(input.value);if(!result.ok)throw new Error(result.error||'Kaydedilemedi');input.value='';document.body.innerHTML='<main class="card"><h1>Bağlantı deneniyor…</h1><p>Şifre güvenli olarak kaydedildi.</p></main>'}catch(err){error.textContent=err.message;button.disabled=false}})
      </script></body></html>`
    void setupWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  })
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    title: 'Kantin Barkod POS',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    void win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    void win.loadFile(path.join(getRendererDist(), 'index.html'))
  }
}

async function bootstrap() {
  ensureUserDataDirs()
  appendLog('app.log', `App start packaged=${isPackaged()} version=${app.getVersion()}`)

  let databaseUrl: string | undefined
  if (isPackaged()) {
    try {
      let credentials = loadDatabaseCredentials()
      if (!credentials) {
        if (!(await showDatabaseSetup())) {
          app.quit()
          return
        }
        credentials = loadDatabaseCredentials()
      }
      if (!credentials) throw new Error('Güvenli veritabanı yapılandırması okunamadı.')
      databaseUrl = toDatabaseUrl(credentials)
    } catch (err) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Kantin Barkod POS',
        message: 'Veritabanı yapılandırması açılamadı',
        detail: err instanceof Error ? err.message : String(err),
      })
      app.quit()
      return
    }
  }

  while (true) {
    try {
      const result = await startBackendProcess(databaseUrl)
      backendStartedByUs = result.spawned
      appendLog('app.log', `Backend ready port=${result.port} spawned=${result.spawned}`)
      break
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      appendLog('app.log', `Backend start failed: ${message}`)
      const choice = await dialog.showMessageBox({
        type: 'error',
        title: 'Kantin Barkod POS',
        message: 'PostgreSQL bağlantısı veya veritabanı hazırlığı başarısız',
        detail:
          `${message}\n\n` +
          'PostgreSQL 18 kurulu ve hizmeti çalışır durumda olmalıdır. Uygulama kantin_pos veritabanını yalnızca yoksa oluşturur; mevcut kayıtları silmez.\n\n' +
          `Ayrıntılı log: ${path.join(app.getPath('userData'), 'logs', 'db-setup.log')}`,
        buttons: isPackaged() ? ['Tekrar dene', 'Şifreyi değiştir', 'Çıkış'] : ['Çıkış'],
        defaultId: 0,
        cancelId: isPackaged() ? 2 : 0,
      })
      if (!isPackaged() || choice.response === 2) {
        app.quit()
        return
      }
      if (choice.response === 1) {
        if (!(await showDatabaseSetup())) {
          app.quit()
          return
        }
        const credentials = loadDatabaseCredentials()
        if (!credentials) {
          app.quit()
          return
        }
        databaseUrl = toDatabaseUrl(credentials)
      }
    }
  }

  createWindow()
}

app.whenReady().then(() => {
  void bootstrap()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  if (backendStartedByUs) {
    stopBackendProcess()
  }
})
