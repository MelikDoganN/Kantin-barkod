import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'
import { execFileSync } from 'node:child_process'

let directory: string
let application: ElectronApplication

test.beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kantin-electron-scanner-'))
  const source = fs.readFileSync('electron/scanner-input.ts', 'utf8')
  fs.writeFileSync(path.join(directory, 'scanner.cjs'), ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText)
  fs.writeFileSync(path.join(directory, 'main.cjs'), `
    const { app, BrowserWindow, Menu } = require('electron')
    app.setPath('userData', ${JSON.stringify(path.join(directory, 'profile'))})
    app.whenReady().then(() => {
      Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Window', submenu: [
        { role: 'minimize', accelerator: 'Control+M' }
      ] }]))
      const window = new BrowserWindow({ width: 1440, height: 1000, autoHideMenuBar: true, webPreferences: { contextIsolation: true } })
      if (process.env.SCANNER_GUARD === '1') require('./scanner.cjs').configureScannerInput(window, console.log)
      window.loadURL('http://127.0.0.1:4173')
    })
    app.on('window-all-closed', () => app.quit())
  `)
})

test.afterEach(async () => {
  await application?.close()
  fs.rmSync(directory, { recursive: true, force: true })
})

async function launch(guard: boolean) {
  const environment = { ...process.env, SCANNER_GUARD: guard ? '1' : '0' }
  delete environment.ELECTRON_RUN_AS_NODE
  application = await electron.launch({ args: [path.join(directory, 'main.cjs')], env: environment })
  const page = await application.firstWindow()
  await page.getByLabel('Kullanıcı Adı').fill('admin')
  await page.getByLabel('Şifre', { exact: true }).fill('admin123')
  await page.getByRole('button', { name: 'Giriş Yap' }).click()
  return page
}

async function minimized() {
  return application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized())
}

async function nativeScan(barcode: string, suffix = 'm') {
  await application.evaluate(async ({ BrowserWindow, app }, { barcode, suffix }) => {
    const window = BrowserWindow.getAllWindows()[0]
    app.focus({ steal: true })
    window.focus()
    const contents = window.webContents
    for (const key of barcode) {
      contents.sendInputEvent({ type: 'keyDown', keyCode: key })
      contents.sendInputEvent({ type: 'char', keyCode: key })
      contents.sendInputEvent({ type: 'keyUp', keyCode: key })
      await new Promise(resolve => setTimeout(resolve, 5))
    }
    contents.sendInputEvent({ type: 'keyDown', keyCode: suffix.toUpperCase(), modifiers: ['control'] })
    contents.sendInputEvent({ type: 'keyUp', keyCode: suffix.toUpperCase(), modifiers: ['control'] })
  }, { barcode, suffix })
}

// Menu accelerators go through the native Windows message loop, not CDP key injection.
test('legacy hidden-menu Ctrl+M reproduces minimization', async () => {
  test.skip(process.platform !== 'win32', 'Windows native menu accelerator regression')
  await launch(false)
  const pid = application.process().pid
  const command = `$shell = New-Object -ComObject WScript.Shell; if (-not $shell.AppActivate(${pid})) { exit 1 }; Start-Sleep -Milliseconds 150; $shell.SendKeys('^m')`
  execFileSync('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')])
  await expect.poll(minimized).toBe(true)
})

test('scanner Ctrl+M adds a sale item without minimizing; manual minimize still works', async () => {
  const page = await launch(true)
  await page.getByRole('link', { name: 'Satış', exact: true }).click()
  const input = page.getByPlaceholder('Barkod okutun veya ürün arayın...')
  await expect(input).toBeFocused()
  await nativeScan('8690000000001')
  await expect(input).toHaveValue('')
  await expect(page.locator('aside').last().getByText('Test Su', { exact: true })).toBeVisible()
  expect(await minimized()).toBe(false)
  await nativeScan('')
  expect(await minimized()).toBe(false)
  await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
  await expect.poll(minimized).toBe(true)
})

test('product form accepts Ctrl+M and Ctrl+J scanner terminators without minimizing', async () => {
  const page = await launch(true)
  await page.getByRole('link', { name: 'Ürünler', exact: true }).click()
  await page.getByRole('button', { name: 'Yeni Ürün' }).click()
  const dialog = page.getByRole('dialog', { name: 'Yeni Ürün' })
  const barcode = dialog.getByPlaceholder('Barkod okutun veya yazın')
  for (const suffix of ['Control+m', 'Control+j']) {
    await barcode.fill('')
    await barcode.focus()
    await nativeScan('8690000000019', suffix.endsWith('m') ? 'm' : 'j')
    await expect(barcode).toHaveValue('8690000000019')
    await expect(dialog.getByPlaceholder('Örn. Su 0.5 L')).toBeFocused()
    expect(await minimized()).toBe(false)
  }
})
