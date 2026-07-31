import { useEffect, useState } from 'react'
import { Phone, CalendarPlus, HandCoins, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { Drawer, SectionCard, StatusBadge, Modal } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { CreditSaleDetailPanel } from '@/components/credit/CreditSaleDetailPanel'
import {
  collectCreditPayment,
  fetchCreditCustomerDetail,
  fetchCreditSaleDetail,
  type ApiCreditSaleDetail,
} from '@/services/credits'
import { ApiError } from '@/services/api'
import type { CreditTransaction, Customer } from '@/types'
import { cn, formatCurrency } from '@/utils/format'

interface CustomerDetailPanelProps {
  customer: Customer | null
  onClose: () => void
  onPaid?: (customer: Customer) => void
}

export function CustomerDetailPanel({ customer, onClose, onPaid }: CustomerDetailPanelProps) {
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [note, setNote] = useState('')
  const [detail, setDetail] = useState<Customer | null>(null)
  const [history, setHistory] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)
  const [saleDetail, setSaleDetail] = useState<ApiCreditSaleDetail | null>(null)
  const [saleLoading, setSaleLoading] = useState(false)

  useEffect(() => {
    if (!customer) {
      setDetail(null)
      setHistory([])
      setError(null)
      setSaleDetail(null)
      return
    }

    let cancelled = false
    setDetail(customer)
    setLoading(true)
    setError(null)
    setSaleDetail(null)

    ;(async () => {
      try {
        const result = await fetchCreditCustomerDetail(customer.id)
        if (!cancelled) {
          setDetail(result.customer)
          setHistory(result.transactions)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Borç detayı yüklenemedi.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [customer])

  if (!customer || !detail) return null

  const amount = Number(payAmount) || 0
  const remaining = Math.max(detail.totalDebt - amount, 0)

  function closePay() {
    setPayOpen(false)
    setPayAmount('')
    setNote('')
    setPayError(null)
  }

  async function handleSavePayment() {
    setPayError(null)
    if (!(amount > 0)) {
      setPayError('Ödeme tutarı 0’dan büyük olmalıdır.')
      return
    }
    if (amount > detail!.totalDebt) {
      setPayError('Ödeme tutarı mevcut borçtan fazla olamaz.')
      return
    }

    setSaving(true)
    try {
      await collectCreditPayment({
        customerId: Number(detail!.id),
        amount,
        note: note.trim() || undefined,
      })
      const refreshed = await fetchCreditCustomerDetail(detail!.id)
      setDetail(refreshed.customer)
      setHistory(refreshed.transactions)
      onPaid?.(refreshed.customer)
      closePay()
    } catch (err) {
      setPayError(err instanceof ApiError ? err.message : 'Tahsilat kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  async function openSaleDetail(tx: CreditTransaction) {
    if (tx.type !== 'debt' || !tx.saleId || !detail) return
    setSaleLoading(true)
    setError(null)
    try {
      const sale = await fetchCreditSaleDetail(detail.id, tx.saleId)
      setSaleDetail(sale)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Satış detayı yüklenemedi.')
    } finally {
      setSaleLoading(false)
    }
  }

  return (
    <>
      <Drawer open title="Borç Detayı" description="Kişi bilgileri ve borç geçmişi" onClose={onClose} width={520}>
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between rounded-card border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-xl font-semibold text-brand-600">
                {detail.name.charAt(0)}
              </span>
              <div>
                <p className="text-base font-semibold text-slate-800">{detail.name}</p>
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Phone size={13} /> {detail.phone || '—'}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                  <CalendarPlus size={12} /> Kayıt: {detail.createdAt}
                </p>
              </div>
            </div>
            {detail.status === 'open' ? (
              <StatusBadge tone="warning">Açık</StatusBadge>
            ) : (
              <StatusBadge tone="success">Ödendi</StatusBadge>
            )}
          </div>

          <div className="flex items-center justify-between rounded-card border border-amber-200 bg-amber-50 px-5 py-4">
            <div>
              <p className="text-sm text-amber-700">Toplam Borç</p>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(detail.totalDebt)}</p>
            </div>
            <Button
              variant="warning"
              icon={<HandCoins size={16} />}
              disabled={detail.totalDebt === 0}
              onClick={() => setPayOpen(true)}
            >
              Ödeme Al
            </Button>
          </div>

          <SectionCard title="Borç Geçmişi" noPadding>
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Yükleniyor…</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map((tx) => {
                  const clickable = tx.type === 'debt' && Boolean(tx.saleId)
                  return (
                    <li key={tx.id} className="flex items-center gap-3 px-4 py-3">
                      <span
                        className={cn(
                          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg',
                          tx.type === 'payment'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-amber-50 text-amber-600',
                        )}
                      >
                        {tx.type === 'payment' ? (
                          <ArrowDownCircle size={18} />
                        ) : (
                          <ArrowUpCircle size={18} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        {clickable ? (
                          <button
                            type="button"
                            disabled={saleLoading}
                            onClick={() => void openSaleDetail(tx)}
                            className="truncate text-left text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline disabled:opacity-60"
                          >
                            {tx.items}
                          </button>
                        ) : (
                          <p className="truncate text-sm font-medium text-slate-700">{tx.items}</p>
                        )}
                        <p className="text-xs text-slate-400">{tx.date}</p>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-semibold',
                          tx.type === 'payment' ? 'text-emerald-600' : 'text-slate-700',
                        )}
                      >
                        {tx.type === 'payment' ? '-' : '+'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </li>
                  )
                })}
                {history.length === 0 && (
                  <li className="px-4 py-6 text-center text-sm text-slate-400">
                    Borç kaydı bulunmuyor.
                  </li>
                )}
              </ul>
            )}
          </SectionCard>
        </div>
      </Drawer>

      <CreditSaleDetailPanel sale={saleDetail} onClose={() => setSaleDetail(null)} />

      <Modal
        open={payOpen}
        title="Ödeme Al"
        description={`${detail.name} için tahsilat`}
        onClose={closePay}
        footer={
          <>
            <Button variant="outline" onClick={closePay} disabled={saving}>
              Vazgeç
            </Button>
            <Button
              icon={<HandCoins size={16} />}
              onClick={() => void handleSavePayment()}
              disabled={saving}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {payError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {payError}
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-500">Mevcut Borç</span>
            <span className="text-lg font-bold text-slate-800">{formatCurrency(detail.totalDebt)}</span>
          </div>
          <Input
            label="Ödeme Tutarı"
            type="number"
            min={0}
            max={detail.totalDebt}
            step="0.01"
            placeholder="0,00"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <Input
            label="Not (opsiyonel)"
            placeholder="Tahsilat notu"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm font-medium text-emerald-700">Kalan Borç</span>
            <span className="text-lg font-bold text-emerald-700">{formatCurrency(remaining)}</span>
          </div>
        </div>
      </Modal>
    </>
  )
}
