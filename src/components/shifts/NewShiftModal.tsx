import { useState } from 'react'
import { Play } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { ApiError } from '@/services/api'
import { openShift } from '@/services/shifts'
import { useAuth } from '@/context/AuthContext'
import { roleLabel } from '@/config/permissions'

interface NewShiftModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export function NewShiftModal({ open, onClose, onSuccess }: NewShiftModalProps) {
  const { user } = useAuth()
  const [openingCash, setOpeningCash] = useState('1000')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function resetAndClose() {
    if (loading) return
    setOpeningCash('1000')
    setNote('')
    setError(null)
    onClose()
  }

  async function handleSave() {
    if (loading) return
    setError(null)
    const cash = Number(openingCash)
    if (!Number.isFinite(cash) || cash < 0) {
      setError('Açılış kasası 0 veya daha büyük olmalıdır.')
      return
    }

    setLoading(true)
    try {
      await openShift({
        openingCash: cash,
        note: note.trim() || undefined,
      })
      setOpeningCash('1000')
      setNote('')
      await onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vardiya açılamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Yeni Vardiya"
      description="Kendi vardiyanızı başlatın ve kasayı açın."
      onClose={resetAndClose}
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button icon={<Play size={16} />} onClick={() => void handleSave()} disabled={loading}>
            {loading ? 'Açılıyor...' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-400">Personel</p>
          <p className="text-sm font-semibold text-slate-800">{user?.fullName ?? '—'}</p>
          <p className="text-xs text-slate-500">
            {user ? roleLabel(user.role) : ''} · Vardiya sizin adınıza açılır
          </p>
        </div>
        <Input
          label="Açılış Kasası (₺)"
          type="number"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
        />
        <div className="md:col-span-2">
          <Input
            label="Not"
            placeholder="İsteğe bağlı not"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}
