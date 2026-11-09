import { useEffect, useRef } from 'react'
import { MIN_BARCODE_LENGTH } from '@/utils/barcode'

/** Capture keyboard-wedge scans before their Enter/Tab suffix activates a focused link/button. */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled: boolean) {
  const callback = useRef(onScan)
  callback.current = onScan

  useEffect(() => {
    if (!enabled) return
    let buffer = ''
    let lastKeyAt = 0
    const reset = () => { buffer = ''; lastKeyAt = 0 }
    const handleKey = (event: KeyboardEvent) => {
      // A scanner CR suffix may press Control before Electron normalizes Ctrl+M.
      if (event.key === 'Control' || event.key === 'Shift') return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
          target?.closest('input, textarea, select, [contenteditable="true"]')) {
        reset()
        return
      }
      const now = performance.now()
      if (now - lastKeyAt > 100) buffer = ''
      if (event.key === 'Enter' || event.key === 'Tab') {
        const barcode = buffer
        reset()
        if (barcode.length < MIN_BARCODE_LENGTH) return
        event.preventDefault()
        event.stopImmediatePropagation()
        // Swallow scanner suffixes during dialogs; they must never confirm a payment.
        if (!document.querySelector('[role="dialog"]')) callback.current(barcode)
        return
      }
      if (event.key.length === 1 && !event.repeat) {
        buffer += event.key
        lastKeyAt = now
      } else if (event.key !== 'Shift') reset()
    }
    window.addEventListener('keydown', handleKey, true)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', handleKey, true)
      window.removeEventListener('blur', reset)
    }
  }, [enabled])
}
