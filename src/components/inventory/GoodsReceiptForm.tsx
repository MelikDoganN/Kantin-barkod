import { useEffect, useMemo, useState } from 'react'
import { PackagePlus, ArrowRight } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { SelectedProductPreview } from '@/components/inventory/SelectedProductPreview'
import { ApiError } from '@/services/api'
import { postReceipt, type InventoryItem } from '@/services/inventory'

interface GoodsReceiptFormProps {
  products: InventoryItem[]
  onSuccess: () => Promise<void> | void
}

const unitOptions = [
  { value: 'case', label: 'Koli' },
  { value: 'unit', label: 'Adet' },
]

export function GoodsReceiptForm({ products, onSuccess }: GoodsReceiptFormProps) {
  const productOptions = products.map((p) => ({ value: String(p.productId), label: p.product.name }))

  const [supplier, setSupplier] = useState('')
  const [productId, setProductId] = useState('')
  const [unit, setUnit] = useState<'case' | 'unit'>('case')
  const [quantity, setQuantity] = useState('5')
  const [casePackSize, setCasePackSize] = useState('24')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (products.length === 0) return
    if (productId && products.some((p) => String(p.productId) === productId)) return
    const first = products[0]
    setProductId(String(first.productId))
    setCasePackSize(String(first.unitsPerCarton || 24))
  }, [products, productId])

  const selected = useMemo(
    () => products.find((p) => String(p.productId) === productId),
    [products, productId],
  )

  const totalUnits = useMemo(() => {
    const qty = Number(quantity) || 0
    const pack = selected?.unitsPerCarton || Number(casePackSize) || 0
    return unit === 'case' ? qty * pack : qty
  }, [quantity, casePackSize, unit, selected])

  function handleProductChange(id: string) {
    setProductId(id)
    const found = products.find((p) => String(p.productId) === id)
    if (found) {
      setCasePackSize(String(found.unitsPerCarton || 24))
    }
  }

  async function handleSave() {
    if (loading || !productId) return
    setError(null)
    setSuccessMsg(null)

    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Miktar 0'dan büyük olmalıdır.")
      return
    }

    setLoading(true)
    try {
      await postReceipt({
        productId: Number(productId),
        quantity: qty,
        unitType: unit,
        cartonCount: unit === 'case' ? qty : undefined,
        description: [supplier.trim() && `Tedarikçi: ${supplier.trim()}`, note.trim()]
          .filter(Boolean)
          .join(' — ') || undefined,
      })
      setSuccessMsg(`Depoya ${totalUnits} adet eklendi.`)
      setQuantity(unit === 'case' ? '5' : '1')
      setNote('')
      await onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Mal kabul kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="Tedarikçi"
          placeholder="Örn. Anadolu Dağıtım"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
        <Select
          label="Ürün Seçimi"
          options={productOptions}
          value={productId}
          onChange={(e) => handleProductChange(e.target.value)}
        />
        <SelectedProductPreview product={selected} />
        <Select
          label="Birim"
          options={unitOptions}
          value={unit}
          onChange={(e) => setUnit(e.target.value as 'case' | 'unit')}
        />
        <Input
          label="Gelen Miktar"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Input
          label="Koli İçi Adet"
          type="number"
          value={String(selected?.unitsPerCarton || casePackSize)}
          onChange={(e) => setCasePackSize(e.target.value)}
          disabled
        />
        <Input
          label="Açıklama"
          placeholder="İsteğe bağlı not"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex flex-col justify-between rounded-card border border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Giriş Özeti</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Miktar</dt>
              <dd className="font-medium text-slate-700">
                {quantity || 0} {unit === 'case' ? 'koli' : 'adet'}
              </dd>
            </div>
            {unit === 'case' && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Koli İçi</dt>
                <dd className="font-medium text-slate-700">
                  {selected?.unitsPerCarton || casePackSize} adet
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
              <dt className="text-sm font-semibold text-slate-700">Toplam</dt>
              <dd className="text-lg font-bold text-brand-600">{totalUnits} adet</dd>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <ArrowRight size={13} />
              Depoya eklenir.
            </p>
          </dl>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {successMsg && <p className="mt-3 text-sm text-emerald-600">{successMsg}</p>}
        </div>
        <Button
          className="mt-4"
          fullWidth
          icon={<PackagePlus size={16} />}
          disabled={loading || !productId}
          onClick={() => void handleSave()}
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}
