import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, HandCoins, Plus, Save, UserPlus } from 'lucide-react'
import { Modal, SearchInput } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { ApiError } from '@/services/api'
import { createCustomer, fetchCustomers } from '@/services/sales'
import type { Customer } from '@/types'
import { formatCurrency } from '@/utils/format'

interface DebtSaleModalProps {
  open: boolean
  total: number
  onClose: () => void
  onConfirm: (customer: Customer) => void | Promise<void>
}

type Step = 'select' | 'new' | 'confirm'

export function DebtSaleModal({ open, total, onClose, onConfirm }: DebtSaleModalProps) {
  const [step, setStep] = useState<Step>('select')
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selected, setSelected] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    void fetchCustomers()
      .then((list) => {
        if (!cancelled) setCustomers(list)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Müşteriler yüklenemedi.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return customers
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.phone.replace(/\s/g, '').includes(query.replace(/\s/g, '')),
    )
  }, [customers, search])

  function reset() {
    setStep('select')
    setSearch('')
    setSelected(null)
    setName('')
    setPhone('')
    setNote('')
    setError(null)
    setSaving(false)
    setConfirming(false)
  }

  function handleClose() {
    if (confirming || saving) return
    reset()
    onClose()
  }

  function handleSelect(customer: Customer) {
    setSelected(customer)
    setStep('confirm')
  }

  async function handleCreate() {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const created = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || undefined,
        note: note.trim() || undefined,
      })
      setCustomers((prev) => [created, ...prev])
      setSelected(created)
      setStep('confirm')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Müşteri oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    if (!selected || confirming) return
    setConfirming(true)
    setError(null)
    try {
      await onConfirm(selected)
      reset()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Borç satışı tamamlanamadı.')
      setConfirming(false)
    }
  }

  if (step === 'new') {
    return (
      <Modal
        open={open}
        title="Yeni Borçlu Ekle"
        description="Yeni bir müşteri/personel kaydı oluşturun."
        onClose={handleClose}
        footer={
          <>
            <Button
              variant="outline"
              icon={<ArrowLeft size={16} />}
              onClick={() => setStep('select')}
              disabled={saving}
            >
              Geri
            </Button>
            <Button icon={<Save size={16} />} onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Ad Soyad"
            placeholder="Örn. Ahmet Demir"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Telefon"
            placeholder="0532 000 00 00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Not"
            placeholder="İsteğe bağlı açıklama"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    )
  }

  if (step === 'confirm' && selected) {
    const newTotal = selected.totalDebt + total
    return (
      <Modal
        open={open}
        title="Borç Onayı"
        description="Satış borç olarak kaydedilecek."
        onClose={handleClose}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setStep('select')}
              disabled={confirming}
            >
              İptal
            </Button>
            <Button
              variant="warning"
              icon={<HandCoins size={16} />}
              onClick={() => void handleConfirm()}
              disabled={confirming}
            >
              {confirming ? 'Devam ediliyor...' : 'Devam Et'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-600">
              {selected.name.charAt(0)}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-800">{selected.name}</p>
              <p className="text-xs text-slate-400">{selected.phone}</p>
            </div>
          </div>

          <dl className="space-y-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
            <Row label="Mevcut Borç" value={formatCurrency(selected.totalDebt)} />
            <Row label="Yeni Satış" value={formatCurrency(total)} />
            <div className="border-t border-slate-100 pt-2">
              <Row label="Yeni Toplam Borç" value={formatCurrency(newTotal)} highlight />
            </div>
          </dl>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      title="Borçlu Seç"
      description="Borcuna işlenecek kişiyi seçin."
      onClose={handleClose}
      size="lg"
      footer={
        <Button variant="outline" icon={<UserPlus size={16} />} onClick={() => setStep('new')}>
          Yeni Borçlu
        </Button>
      }
    >
      <div className="space-y-3">
        <SearchInput value={search} onChange={setSearch} placeholder="İsim veya telefon ara..." />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Müşteriler yükleniyor...</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto scrollbar-thin">
            {filtered.map((customer) => (
              <li
                key={customer.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                  {customer.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{customer.name}</p>
                  <p className="text-xs text-slate-400">{customer.phone || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Toplam Borç</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatCurrency(customer.totalDebt)}
                  </p>
                </div>
                <Button size="sm" icon={<Plus size={14} />} onClick={() => handleSelect(customer)}>
                  Seç
                </Button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
                Kayıt bulunamadı.
              </li>
            )}
          </ul>
        )}
      </div>
    </Modal>
  )
}

interface RowProps {
  label: string
  value: string
  highlight?: boolean
}

function Row({ label, value, highlight }: RowProps) {
  return (
    <div className="flex items-center justify-between">
      <dt className={highlight ? 'font-semibold text-slate-700' : 'text-slate-500'}>{label}</dt>
      <dd className={highlight ? 'text-lg font-bold text-amber-600' : 'font-medium text-slate-700'}>
        {value}
      </dd>
    </div>
  )
}
