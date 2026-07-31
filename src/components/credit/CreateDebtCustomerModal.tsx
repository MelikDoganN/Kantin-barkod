import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { ApiError } from '@/services/api'
import { createDebtCustomer } from '@/services/credits'

interface CreateDebtCustomerModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export function CreateDebtCustomerModal({
  open,
  onClose,
  onSuccess,
}: CreateDebtCustomerModalProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [openingDebt, setOpeningDebt] = useState('0')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFullName('')
    setPhone('')
    setOpeningDebt('0')
    setNote('')
    setError(null)
    setLoading(false)
  }, [open])

  function resetAndClose() {
    if (loading) return
    onClose()
  }

  async function handleSave() {
    if (loading) return
    setError(null)

    if (!fullName.trim()) {
      setError('Ad soyad zorunludur.')
      return
    }

    const debt = openingDebt.trim() === '' ? 0 : Number(openingDebt.replace(',', '.'))
    if (!Number.isFinite(debt) || debt < 0) {
      setError('Açılış borcu negatif olamaz.')
      return
    }

    setLoading(true)
    try {
      await createDebtCustomer({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        openingDebt: debt,
        note: note.trim() || undefined,
      })
      await onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Borçlu hesabı oluşturulamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Yeni Borçlu Hesabı"
      description="Satış yapılmadan önce manuel borçlu kaydı oluşturun."
      onClose={resetAndClose}
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button icon={<Save size={16} />} onClick={() => void handleSave()} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4">
        <Input
          label="Ad Soyad"
          placeholder="Örn. Ahmet Yılmaz"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <Input
          label="Telefon"
          placeholder="Opsiyonel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          label="Açılış Borcu"
          type="number"
          min={0}
          step="0.01"
          value={openingDebt}
          onChange={(e) => setOpeningDebt(e.target.value)}
        />
        <Input
          label="Not"
          placeholder="Opsiyonel açıklama"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
