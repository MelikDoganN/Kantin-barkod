import { useEffect, useMemo, useState } from 'react'
import { PackageOpen, Warehouse, LayoutGrid } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { SelectedProductPreview } from '@/components/inventory/SelectedProductPreview'
import { ApiError } from '@/services/api'
import { postOpenCarton, type InventoryItem } from '@/services/inventory'

interface OpenCaseFormProps {
  products: InventoryItem[]
  onSuccess: () => Promise<void> | void
}

export function OpenCaseForm({ products, onSuccess }: OpenCaseFormProps) {
  const caseProducts = products.filter((p) => p.unitsPerCarton > 0 && p.isActive)
  const productOptions = caseProducts.map((p) => ({ value: String(p.productId), label: p.product.name }))

  const [productId, setProductId] = useState('')
  const [caseCount, setCaseCount] = useState('1')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (caseProducts.length === 0) return
    if (productId && caseProducts.some((p) => String(p.productId) === productId)) return
    setProductId(String(caseProducts[0].productId))
  }, [caseProducts, productId])

  const product = useMemo(
    () => caseProducts.find((p) => String(p.productId) === productId) ?? caseProducts[0],
    [caseProducts, productId],
  )

  const availableCases = product
    ? Math.floor(product.warehouseQuantity / Math.max(product.unitsPerCarton, 1))
    : 0
  const movedUnits = (Number(caseCount) || 0) * (product?.unitsPerCarton ?? 0)

  async function handleOpen() {
    if (loading || !product) return
    setError(null)
    setSuccessMsg(null)

    const count = Number(caseCount)
    if (!Number.isFinite(count) || count <= 0) {
      setError("Koli adedi 0'dan büyük olmalıdır.")
      return
    }
    if (count > availableCases) {
      setError('Depodaki koli sayısı yetersiz.')
      return
    }

    setLoading(true)
    try {
      await postOpenCarton({
        productId: product.productId,
        cartonCount: count,
      })
      setSuccessMsg(`Depo -${movedUnits}, Raf +${movedUnits}`)
      setCaseCount('1')
      await onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Koli açılamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <Select
          label="Ürün"
          options={productOptions}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <SelectedProductPreview product={product} />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Depodaki Koli</span>
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              {availableCases} koli
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Koli İçi Adet</span>
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
              {product?.unitsPerCarton ?? 0} adet
            </div>
          </div>
        </div>
        <Input
          label="Açılacak Koli"
          type="number"
          min={1}
          max={availableCases}
          value={caseCount}
          onChange={(e) => setCaseCount(e.target.value)}
        />
      </div>

      <div className="flex flex-col justify-between rounded-card border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Sonuç Önizleme</p>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Warehouse size={18} />
              </span>
              <span className="flex-1 text-sm text-slate-600">Depo Stoğu</span>
              <span className="text-sm font-bold text-red-600">-{movedUnits} adet</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <LayoutGrid size={18} />
              </span>
              <span className="flex-1 text-sm text-slate-600">Raf Stoğu</span>
              <span className="text-sm font-bold text-emerald-600">+{movedUnits} adet</span>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {successMsg && <p className="mt-3 text-sm text-emerald-600">{successMsg}</p>}
        </div>
        <Button
          className="mt-4"
          fullWidth
          icon={<PackageOpen size={16} />}
          disabled={loading || movedUnits === 0 || (Number(caseCount) || 0) > availableCases}
          onClick={() => void handleOpen()}
        >
          {loading ? 'Açılıyor...' : 'Koliyi Aç'}
        </Button>
      </div>
    </div>
  )
}
