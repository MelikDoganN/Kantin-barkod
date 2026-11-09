import { app, BrowserWindow, dialog, Menu } from 'electron'
import path from 'node:path'
import { configureScannerInput } from './scanner-input'
import { startBackendProcess, stopBackendProcess } from './backend-process'
import { appendLog, ensureUserDataDirs, getRendererDist, isPackaged } from './paths'

app.setName('Kantin Barkod POS')
try {
  app.setPath('userData', path.join(app.getPath('appData'), 'Kantin POS'))
} catch {
  // Keep Electron's default if the user-data path is already initialized.
}

const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()
app.on('second-instance', () => {
  if (win?.isMinimized()) win.restore()
  win?.focus()
})

process.env.APP_ROOT = path.join(__dirname, '..')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let win: BrowserWindow | null = null
let backendStartedByUs = false

function createWindow() {
  // Hiding the default menu leaves accelerators active. Remove it on Windows/Linux.
  if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
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

  if (process.platform !== 'darwin') win.removeMenu()
  configureScannerInput(win, (message) => appendLog('app.log', message))

  win.once('ready-to-show', () => win?.show())
  if (VITE_DEV_SERVER_URL) void win.loadURL(VITE_DEV_SERVER_URL)
  else void win.loadFile(path.join(getRendererDist(), 'index.html'))
}

async function bootstrap() {
  ensureUserDataDirs()
  appendLog('app.log', `App start packaged=${isPackaged()} version=${app.getVersion()}`)

  while (true) {
    try {
      const result = await startBackendProcess()
      backendStartedByUs = result.spawned
      appendLog('app.log', `Backend ready port=${result.port} spawned=${result.spawned}`)
      break
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      appendLog('app.log', `Backend start failed: ${message}`)
      const choice = await dialog.showMessageBox({
        type: 'error',
        title: 'Kantin Barkod POS',
        message: 'Yerel veritabanı hazırlanamadı',
        detail:
          `${message}\n\n` +
          'Veritabanı dosyası ve ayrıntılı kayıt:\n' +
          `${path.join(app.getPath('userData'), 'data', 'kantin.db')}\n` +
          `${path.join(app.getPath('userData'), 'logs', 'db-setup.log')}`,
        buttons: ['Tekrar dene', 'Çıkış'],
        defaultId: 0,
        cancelId: 1,
      })
      if (choice.response !== 0) {
        app.quit()
        return
      }
    }
  }

  createWindow()
}

app.whenReady().then(() => { if (singleInstance) void bootstrap() })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  if (backendStartedByUs) stopBackendProcess()
})
