import { useState } from 'react'
import { Drawer, StatusBadge, Modal } from '@/components/common'
import { ProductThumb } from '@/components/products/ProductThumb'
import { Button, Input } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { hasPermission } from '@/config/permissions'
import { ApiError } from '@/services/api'
import { cancelCompletedSale } from '@/services/sales'
import type { SaleRecord } from '@/types'
import { formatCurrency } from '@/utils/format'
import { paymentLabels, paymentTones } from './helpers'

interface SaleDetailPanelProps {
  sale: SaleRecord | null
  personnel: string
  onClose: () => void
  onCancelled?: () => void
}

export function SaleDetailPanel({ sale, personnel, onClose, onCancelled }: SaleDetailPanelProps) {
  const { user } = useAuth()
  const canCancel = hasPermission(user?.role, 'sale.cancel')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [forceAfterDayEnd, setForceAfterDayEnd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!sale) return null

  const isCancelled = sale.status === 'CANCELLED'
  const showCancelButton = canCancel && !isCancelled && sale.status === 'COMPLETED'

  async function handleCancel() {
    if (!sale || saving) return
    setSaving(true)
    setError(null)
    try {
      await cancelCompletedSale(Number(sale.id), {
        reason,
        forceAfterDayEnd: sale.dayEndTaken ? forceAfterDayEnd : false,
      })
      setCancelOpen(false)
      setReason('')
      setForceAfterDayEnd(false)
      onCancelled?.()
      onClose()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DAY_END_LOCKED') {
        setError('Gün sonu alınmış. Onay kutusunu işaretleyerek iptal edebilirsiniz.')
        setForceAfterDayEnd(false)
      } else {
        setError(err instanceof ApiError ? err.message : 'Satış iptal edilemedi.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer
        open
        title="Satış Detayı"
        description={`${sale.saleNo} · ${sale.time}`}
        onClose={onClose}
        width={420}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InfoCell label="Satış No" value={sale.saleNo} />
            <InfoCell label="Saat" value={sale.time} />
            <InfoCell label="Personel" value={personnel} />
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Ödeme</p>
              <div className="mt-1">
                <StatusBadge tone={paymentTones[sale.payment]}>{paymentLabels[sale.payment]}</StatusBadge>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <p className="text-xs text-slate-500">Durum</p>
              <div className="mt-1">
                {isCancelled ? (
                  <StatusBadge tone="danger">İptal edildi</StatusBadge>
                ) : (
                  <StatusBadge tone="success">Tamamlandı</StatusBadge>
                )}
              </div>
            </div>
          </div>

          {isCancelled && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm">
              <p className="font-medium text-red-700">İptal bilgisi</p>
              <p className="text-red-700">
                <span className="text-red-500">İptal eden: </span>
                {sale.cancelledByName ?? '—'}
              </p>
              <p className="text-red-700">
                <span className="text-red-500">Tarih: </span>
                {sale.cancelledAt
                  ? new Date(sale.cancelledAt).toLocaleString('tr-TR')
                  : '—'}
              </p>
              <p className="text-red-700">
                <span className="text-red-500">Neden: </span>
                {sale.cancelReason ?? '—'}
              </p>
            </div>
          )}

          <div className="rounded-card border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ürünler ({sale.itemCount})
            </div>
            <ul className="divide-y divide-slate-100">
              {sale.items.map((item, index) => (
                <li key={`${item.productName}-${index}`} className="flex items-center gap-3 px-4 py-3">
                  <ProductThumb
                    src={item.imageUrl ?? item.imagePath}
                    fallback={item.icon}
                    size="sm"
                    className="h-9 w-9 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{item.productName}</p>
                    <p className="text-xs text-slate-400">
                      {item.quantity} adet × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{formatCurrency(item.total)}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-slate-200 bg-brand-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-600">Toplam</span>
              <span className="text-lg font-bold text-brand-700">{formatCurrency(sale.total)}</span>
            </div>
          </div>

          {showCancelButton && (
            <Button
              variant="danger"
              fullWidth
              onClick={() => {
                setError(null)
                setForceAfterDayEnd(false)
                setCancelOpen(true)
              }}
            >
              Satışı İptal Et
            </Button>
          )}
        </div>
      </Drawer>

      <Modal
        open={cancelOpen}
        title="Satışı İptal Et"
        description="Stoklar geri eklenecek. Bu işlem audit kaydına yazılır."
        onClose={() => !saving && setCancelOpen(false)}
        footer={
          <>
            <Button variant="outline" disabled={saving} onClick={() => setCancelOpen(false)}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={saving || reason.trim().length < 3 || (sale.dayEndTaken && !forceAfterDayEnd)}
              onClick={() => void handleCancel()}
            >
              {saving ? 'İptal ediliyor…' : 'İptali Onayla'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="İptal nedeni"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Örn. Yanlış ürün okutuldu"
          />
          {sale.dayEndTaken && (
            <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={forceAfterDayEnd}
                onChange={(e) => setForceAfterDayEnd(e.target.checked)}
              />
              <span>
                Gün sonu alınmış. Yönetici olarak yine de iptal etmek istiyorum. (Gün sonu özet
                tutarları değişmez; işlem audit’e yazılır.)
              </span>
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </>
  )
}

interface InfoCellProps {
  label: string
  value: string
}

function InfoCell({ label, value }: InfoCellProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}
