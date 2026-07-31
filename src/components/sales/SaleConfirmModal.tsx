import { Check } from 'lucide-react'
import { Modal, StatusBadge } from '@/components/common'
import { ProductThumb } from '@/components/products/ProductThumb'
import { Button } from '@/components/ui'
import type { BadgeTone, CartItem } from '@/types'
import { formatCurrency } from '@/utils/format'
import type { PaymentTypeApi } from '@/services/sales'

interface SaleConfirmModalProps {
  open: boolean
  cart: CartItem[]
  subtotal: number
  discount: number
  total: number
  paymentType: PaymentTypeApi
  customerName?: string
  confirming: boolean
  onCancel: () => void
  onConfirm: () => void
}

const paymentLabels: Record<PaymentTypeApi, string> = {
  CASH: 'Nakit',
  CARD: 'Kart',
  CREDIT: 'Borç',
}

const paymentTones: Record<PaymentTypeApi, BadgeTone> = {
  CASH: 'success',
  CARD: 'info',
  CREDIT: 'warning',
}

export function SaleConfirmModal({
  open,
  cart,
  subtotal,
  discount,
  total,
  paymentType,
  customerName,
  confirming,
  onCancel,
  onConfirm,
}: SaleConfirmModalProps) {
  return (
    <Modal
      open={open}
      title="Satışı Onayla"
      description="Bu satışı tamamlamak istediğinize emin misiniz?"
      onClose={confirming ? () => undefined : onCancel}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={confirming}>
            İptal
          </Button>
          <Button
            variant="primary"
            icon={<Check size={16} />}
            onClick={onConfirm}
            disabled={confirming || cart.length === 0}
          >
            {confirming ? 'Tamamlanıyor...' : 'Satışı Tamamla'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Ödeme tipi</span>
          <StatusBadge tone={paymentTones[paymentType]}>{paymentLabels[paymentType]}</StatusBadge>
          {paymentType === 'CREDIT' && customerName && (
            <span className="text-sm text-slate-600">· {customerName}</span>
          )}
        </div>

        <div className="overflow-hidden rounded-card border border-slate-200">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[44px_minmax(0,1.4fr)_80px_100px_100px]">
            <span className="sr-only">Görsel</span>
            <span>Ürün</span>
            <span className="hidden text-center sm:block">Adet</span>
            <span className="hidden text-right sm:block">Birim Fiyat</span>
            <span className="text-right">Toplam</span>
          </div>
          <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto scrollbar-thin">
            {cart.map((item) => {
              const lineTotal = item.product.salePrice * item.quantity
              return (
                <li
                  key={item.product.id}
                  className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[44px_minmax(0,1.4fr)_80px_100px_100px]"
                >
                  <ProductThumb
                    src={item.product.imageUrl ?? item.product.imagePath}
                    fallback={item.product.icon}
                    size="sm"
                    className="h-11 w-11 flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-700">{item.product.name}</p>
                    <p className="text-xs text-slate-400 sm:hidden">
                      {item.quantity} × {formatCurrency(item.product.salePrice)}
                    </p>
                  </div>
                  <span className="hidden text-center text-sm font-semibold text-slate-700 sm:block">
                    {item.quantity}
                  </span>
                  <span className="hidden text-right text-sm text-slate-600 sm:block">
                    {formatCurrency(item.product.salePrice)}
                  </span>
                  <span className="text-right text-sm font-semibold text-slate-800">
                    {formatCurrency(lineTotal)}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <dl className="space-y-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Ara Toplam</dt>
            <dd className="font-medium text-slate-700">{formatCurrency(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">İndirim</dt>
            <dd className="font-medium text-slate-700">{formatCurrency(discount)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 pt-2">
            <dt className="font-semibold text-slate-700">Genel Toplam</dt>
            <dd className="text-lg font-bold text-brand-600">{formatCurrency(total)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  )
}
