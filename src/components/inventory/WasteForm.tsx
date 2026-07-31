import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button, Input, Select } from '@/components/ui'
import { SelectedProductPreview } from '@/components/inventory/SelectedProductPreview'
import { ApiError } from '@/services/api'
import { postWaste, type InventoryItem } from '@/services/inventory'

interface WasteFormProps {
  products: InventoryItem[]
  onSuccess: () => Promise<void> | void
}

const reasonOptions = [
  { value: 'Bozuk', label: 'Bozuk' },
  { value: 'Kayıp', label: 'Kayıp' },
  { value: 'Son Kullanma', label: 'Son Kullanma' },
  { value: 'Diğer', label: 'Diğer' },
]

export function WasteForm({ products, onSuccess }: WasteFormProps) {
  const activeProducts = products.filter((p) => p.isActive)
  const productOptions = activeProducts.map((p) => ({
    value: String(p.productId),
    label: p.product.name,
  }))

  const [productId, setProductId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('Bozuk')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (activeProducts.length === 0) return
    if (productId && activeProducts.some((p) => String(p.productId) === productId)) return
    setProductId(String(activeProducts[0].productId))
  }, [activeProducts, productId])

  const selected = activeProducts.find((p) => String(p.productId) === productId)

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
      await postWaste({
        productId: Number(productId),
        quantity: qty,
        reason,
        description: note.trim() || undefined,
      })
      setSuccessMsg('Fire kaydı oluşturuldu.')
      setQuantity('')
      setNote('')
      await onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fire kaydı oluşturulamadı.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="Ürün"
          options={productOptions}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <SelectedProductPreview product={selected} />
        <Input
          label="Miktar"
          type="number"
          placeholder="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <Select
          label="Sebep"
          options={reasonOptions}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Input
          label="Açıklama"
          placeholder="İsteğe bağlı not"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {successMsg && <p className="text-sm text-emerald-600">{successMsg}</p>}
      <div className="flex justify-end">
        <Button
          variant="danger"
          icon={<Trash2 size={16} />}
          disabled={loading || !productId}
          onClick={() => void handleSave()}
        >
          {loading ? 'Kaydediliyor...' : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}
