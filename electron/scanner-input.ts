import type { BrowserWindow } from 'electron'

/** Scanner CR/LF may arrive as Ctrl+M/Ctrl+J, before renderer key handlers can run. */
export function configureScannerInput(window: BrowserWindow, log: (message: string) => void) {
  let length = 0
  let lastCharacterAt = 0
  let lastSuffixAt = 0
  const reset = () => { length = 0; lastCharacterAt = 0; lastSuffixAt = 0 }

  window.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase()
    const controlSuffix = input.control && !input.alt && !input.meta && (key === 'm' || key === 'j')
    if (controlSuffix) {
      // The default Electron menu binds Ctrl+M to Minimize, even with an auto-hidden menu.
      event.preventDefault()
      if (input.type !== 'keyDown' || input.isAutoRepeat) return
      const now = Date.now()
      const scannerBurst = length >= 4 && now - lastCharacterAt <= 200
      const pairedLineFeed = key === 'j' && now - lastSuffixAt <= 200
      length = 0
      if (pairedLineFeed) return // A CR+LF pair must add the product only once.
      if (!scannerBurst) return
      lastSuffixAt = now
      const hash = new URL(window.webContents.getURL()).hash
      if (hash !== '#/sales' && hash !== '#/products') return
      log(`Scanner control suffix Ctrl+${key.toUpperCase()} normalized to Enter`)
      window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' })
      window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' })
      return
    }
    if (input.type !== 'keyDown') return
    if (input.key.length === 1 && !input.control && !input.alt && !input.meta && !input.isAutoRepeat) {
      const now = Date.now()
      length = now - lastCharacterAt <= 200 ? length + 1 : 1
      lastCharacterAt = now
      lastSuffixAt = 0
    } else if (!['Control', 'Shift'].includes(input.key)) {
      length = 0
    }
  })
  window.on('blur', reset)
  window.on('minimize', () => log('Window minimized'))
  window.webContents.on('render-process-gone', (_event, details) => {
    log(`Renderer stopped: reason=${details.reason} exitCode=${details.exitCode}`)
  })
}
