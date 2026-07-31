import { Drawer, StatusBadge } from '@/components/common'
import { ProductThumb } from '@/components/products/ProductThumb'
import { paymentLabels, paymentTones } from '@/components/dayend/helpers'
import type { ApiCreditSaleDetail } from '@/services/credits'
import { formatCurrency } from '@/utils/format'

interface CreditSaleDetailPanelProps {
  sale: ApiCreditSaleDetail | null
  onClose: () => void
}

export function CreditSaleDetailPanel({ sale, onClose }: CreditSaleDetailPanelProps) {
  if (!sale) return null

  const dateTime = `${sale.date} ${sale.time}`

  return (
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
          <InfoCell label="Tarih / Saat" value={dateTime} />
          <InfoCell label="Müşteri" value={sale.customer.name} />
          <InfoCell label="Telefon" value={sale.customer.phone || '—'} />
          <InfoCell label="Personel" value={sale.personnel} />
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">Ödeme</p>
            <div className="mt-1">
              <StatusBadge tone={paymentTones.debt}>{paymentLabels.debt}</StatusBadge>
            </div>
          </div>
        </div>

        <div className="rounded-card border border-slate-200">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Ürünler ({sale.itemCount})
          </div>
          <ul className="divide-y divide-slate-100">
            {sale.items.map((item, index) => (
              <li key={`${item.productId}-${index}`} className="flex items-center gap-3 px-4 py-3">
                <ProductThumb
                  src={item.imageUrl ?? item.imagePath}
                  fallback="📦"
                  size="sm"
                  className="h-9 w-9 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{item.productName}</p>
                  <p className="text-xs text-slate-400">
                    {item.quantity} adet × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-slate-700">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 bg-brand-50 px-4 py-3">
            <span className="text-sm font-medium text-slate-600">Toplam</span>
            <span className="text-lg font-bold text-brand-700">{formatCurrency(sale.total)}</span>
          </div>
        </div>
      </div>
    </Drawer>
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
