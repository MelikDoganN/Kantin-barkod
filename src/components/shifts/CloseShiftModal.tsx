import { useEffect, useMemo, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button } from '@/components/ui'
import { ApiError } from '@/services/api'
import { closeShift, type CurrentShift } from '@/services/shifts'
import { formatCurrency, cn } from '@/utils/format'

interface CloseShiftModalProps {
  open: boolean
  shift: CurrentShift
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export function CloseShiftModal({ open, shift, onClose, onSuccess }: CloseShiftModalProps) {
  const [countedCash, setCountedCash] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cashSales = shift.salesSummary.cashSales
  const expectedCash = shift.openingCash + cashSales

  useEffect(() => {
    if (open) {
      setCountedCash(String(expectedCash))
      setNote('')
      setError(null)
    }
  }, [open, expectedCash])

  const diff = useMemo(() => {
    if (countedCash === '') return null
    const value = Number(countedCash)
    if (!Number.isFinite(value)) return null
    return value - expectedCash
  }, [countedCash, expectedCash])

  function handleClose() {
    if (loading) return
    setCountedCash('')
    setNote('')
    setError(null)
    onClose()
  }

  async function handleConfirm() {
    if (loading) return
    const cash = Number(countedCash)
    if (!Number.isFinite(cash) || cash < 0) {
      setError('Fiili kasa 0 veya daha büyük olmalıdır.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await closeShift(shift.id, {
        closingCash: cash,
        note: note.trim() || undefined,
      })
      await onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vardiya kapatılamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Vardiyayı Kapat"
      description="Kasa sayımını girin ve vardiyayı sonlandırın."
      onClose={handleClose}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            icon={<LockKeyhole size={16} />}
            onClick={() => void handleConfirm()}
            disabled={loading || countedCash === ''}
          >
            {loading ? 'Kapatılıyor...' : 'Vardiyayı Kapat'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">Kasa Hesabı</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Başlangıç Kasa</dt>
              <dd className="font-medium text-slate-700">{formatCurrency(shift.openingCash)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">+ Nakit Satış</dt>
              <dd className="font-medium text-slate-700">{formatCurrency(cashSales)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <dt className="font-semibold text-slate-700">= Beklenen Kasa</dt>
              <dd className="text-base font-bold text-brand-600">{formatCurrency(expectedCash)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            Kart ve borç satışları kasa hesabına dahil edilmez.
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Fiili Kasa (₺)</span>
          <input
            type="number"
            value={countedCash}
            onChange={(e) => setCountedCash(e.target.value)}
            placeholder="0,00"
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">Kasa Farkı</span>
          {diff === null ? (
            <span className="text-sm font-semibold text-slate-400">—</span>
          ) : (
            <span
              className={cn(
                'text-base font-bold',
                diff === 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-amber-600',
              )}
            >
              {diff > 0 ? '+' : ''}
              {formatCurrency(diff)}
            </span>
          )}
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Açıklama</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Kasa farkı veya vardiya ile ilgili not"
            className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
