import { app, BrowserWindow, dialog } from 'electron'
import path from 'node:path'
import { startBackendProcess, stopBackendProcess } from './backend-process'
import {
  appendLog,
  ensureUserDataDirs,
  getRendererDist,
  isPackaged,
} from './paths'

// Must match installer Write-AppConfig path: %APPDATA%\Kantin POS
app.setName('Kantin POS')
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'Kantin POS'))
} catch {
  // ignore if called too late in some edge cases
}

process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let win: BrowserWindow | null = null
let backendStartedByUs = false

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: true,
    title: 'Kantin POS',
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

  try {
    const result = await startBackendProcess()
    backendStartedByUs = result.spawned
    appendLog('app.log', `Backend ready port=${result.port} spawned=${result.spawned}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    appendLog('app.log', `Backend start failed: ${message}`)
    await dialog.showMessageBox({
      type: 'error',
      title: 'Kantin POS',
      message: 'Backend başlatılamadı',
      detail:
        `${message}\n\n` +
        'Kontrol edin:\n' +
        '- backend derlenmiş mi? (cd backend && npm run build)\n' +
        '- PostgreSQL çalışıyor mu?\n' +
        '- config/.env veya backend/.env içinde DATABASE_URL doğru mu?\n' +
        `- Log: ${path.join(app.getPath('userData'), 'logs', 'backend.log')}`,
    })
    app.quit()
    return
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
