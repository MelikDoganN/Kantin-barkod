import { ProductThumb } from '@/components/products/ProductThumb'
import type { InventoryItem } from '@/services/inventory'

interface SelectedProductPreviewProps {
  product?: InventoryItem
}

export function SelectedProductPreview({ product }: SelectedProductPreviewProps) {
  if (!product) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
      <ProductThumb
        src={product.product.imageUrl ?? product.product.imagePath}
        size="sm"
        className="h-11 w-11 shrink-0"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-700">{product.product.name}</p>
        <p className="text-xs text-slate-500">{product.product.category}</p>
      </div>
    </div>
  )
}
