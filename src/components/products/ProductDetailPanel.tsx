import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react'
import { Drawer, SectionCard, StatusBadge } from '@/components/common'
import { ProductThumb } from '@/components/products/ProductThumb'
import type { BadgeTone, Product } from '@/types'
import { formatCurrency } from '@/utils/format'

interface ProductDetailPanelProps {
  product: Product | null
  onClose: () => void
}

interface MovementRow {
  id: string
  date: string
  label: string
  quantity: number
  icon: typeof ArrowDownLeft
  tone: string
}

function getStockTone(product: Product): { tone: BadgeTone; label: string } {
  if (product.shelfStock <= product.criticalLevel) return { tone: 'danger', label: 'Kritik' }
  if (product.shelfStock <= product.criticalLevel * 2) return { tone: 'warning', label: 'Düşük' }
  return { tone: 'success', label: 'Yeterli' }
}

export function ProductDetailPanel({ product, onClose }: ProductDetailPanelProps) {
  if (!product) {
    return <Drawer open={false} title="" onClose={onClose} children={null} />
  }

  const profit = product.salePrice - product.purchasePrice
  const margin = product.salePrice > 0 ? Math.round((profit / product.salePrice) * 100) : 0
  const totalStock = product.shelfStock + product.warehouseStock
  const stockStatus = getStockTone(product)

  const recentSales = [
    { id: 's1', date: '13 Tem 2026', quantity: 12 },
    { id: 's2', date: '12 Tem 2026', quantity: 8 },
    { id: 's3', date: '11 Tem 2026', quantity: 15 },
  ]

  const recentMovements: MovementRow[] = [
    {
      id: 'm1',
      date: '13 Tem 2026 09:15',
      label: 'Mal Kabulü',
      quantity: product.casePackSize || 24,
      icon: ArrowDownLeft,
      tone: 'text-emerald-600',
    },
    {
      id: 'm2',
      date: '12 Tem 2026 16:40',
      label: 'Satış',
      quantity: 20,
      icon: ArrowUpRight,
      tone: 'text-brand-600',
    },
    {
      id: 'm3',
      date: '12 Tem 2026 10:05',
      label: 'Depodan Rafa',
      quantity: product.casePackSize || 24,
      icon: ArrowLeftRight,
      tone: 'text-amber-600',
    },
  ]

  return (
    <Drawer
      open={product !== null}
      title="Ürün Detayı"
      description="Ürün bilgileri, satış ve stok özeti"
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4">
          <ProductThumb
            src={product.imageUrl ?? product.imagePath}
            fallback={product.icon}
            size="md"
            className="h-16 w-16 rounded-xl text-4xl"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-800">{product.name}</p>
            <p className="text-sm text-slate-500">{product.categoryName}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {product.status === 'active' ? (
                <StatusBadge tone="success">Aktif</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Pasif</StatusBadge>
              )}
              <span className="text-xs tabular-nums text-slate-400">{product.barcode}</span>
            </div>
          </div>
        </div>

        <SectionCard title="Kâr Bilgisi">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-slate-50 py-3">
              <p className="text-xs text-slate-500">Alış</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">
                {formatCurrency(product.purchasePrice)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 py-3">
              <p className="text-xs text-slate-500">Satış</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">
                {formatCurrency(product.salePrice)}
              </p>
            </div>
            <div className="rounded-xl bg-emerald-50 py-3">
              <p className="text-xs text-emerald-600">Kâr (%{margin})</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-700">
                {formatCurrency(profit)}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Stok Durumu" action={<StatusBadge tone={stockStatus.tone}>{stockStatus.label}</StatusBadge>}>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Depo Stoğu</dt>
              <dd className="font-medium text-slate-700">{product.warehouseStock} adet</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Raf Stoğu</dt>
              <dd className="font-medium text-slate-700">{product.shelfStock} adet</dd>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <dt className="text-slate-500">Toplam Stok</dt>
              <dd className="font-semibold text-slate-800">{totalStock} adet</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Kritik Seviye</dt>
              <dd className="font-medium text-slate-700">{product.criticalLevel} adet</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Koli İçi Adet</dt>
              <dd className="font-medium text-slate-700">
                {product.casePackSize > 0 ? `${product.casePackSize} adet` : '—'}
              </dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Son Satışlar">
          <ul className="space-y-2 text-sm">
            {recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between">
                <span className="text-slate-500">{sale.date}</span>
                <span className="text-slate-600">{sale.quantity} adet</span>
                <span className="font-semibold text-slate-700">
                  {formatCurrency(sale.quantity * product.salePrice)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Son Stok Hareketleri">
          <ul className="space-y-2.5 text-sm">
            {recentMovements.map((movement) => {
              const Icon = movement.icon
              return (
                <li key={movement.id} className="flex items-center gap-3">
                  <Icon size={16} className={movement.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-700">{movement.label}</p>
                    <p className="text-xs text-slate-400">{movement.date}</p>
                  </div>
                  <span className="font-semibold text-slate-700">{movement.quantity} adet</span>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      </div>
    </Drawer>
  )
}
