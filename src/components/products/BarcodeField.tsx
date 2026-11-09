import { forwardRef, useImperativeHandle, useRef } from 'react'
import { ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/format'
import { sanitizeBarcodeInput } from '@/utils/barcode'

export interface BarcodeFieldHandle {
  focus: () => void
}

interface BarcodeFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  onEnter?: (value: string) => void
  scannerEnabled?: boolean
  autoFocus?: boolean
  disabled?: boolean
  placeholder?: string
  hint?: string
}

export const BarcodeField = forwardRef<BarcodeFieldHandle, BarcodeFieldProps>(function BarcodeField(
  {
    label = 'Barkod',
    value,
    onChange,
    onEnter,
    scannerEnabled = true,
    autoFocus = false,
    disabled = false,
    placeholder = 'Barkod okutun veya yazın',
    hint,
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  function handleFocusScan() {
    inputRef.current?.focus()
    inputRef.current?.select()
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    event.stopPropagation()
    onEnter?.(sanitizeBarcodeInput(event.currentTarget.value))
  }

  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      )}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(sanitizeBarcodeInput(e.target.value))}
          onKeyDown={handleKeyDown}
          className={cn(
            'h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800',
            'placeholder:text-slate-400 transition-colors',
            'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
            scannerEnabled && 'ring-brand-50',
            disabled && 'cursor-not-allowed bg-slate-50 text-slate-400',
          )}
        />
        <Button
          type="button"
          variant="outline"
          icon={<ScanBarcode size={16} />}
          disabled={disabled || !scannerEnabled}
          onClick={handleFocusScan}
          className="shrink-0 px-3"
        >
          Okut
        </Button>
      </div>
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  )
})
