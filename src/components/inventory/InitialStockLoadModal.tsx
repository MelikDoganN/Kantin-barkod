import { useEffect, useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { ConfirmModal, Modal } from '@/components/common'
import { Button, Input } from '@/components/ui'
import { ProductThumb } from '@/components/products/ProductThumb'
import { ApiError } from '@/services/api'
import {
  postInitialStockLoad,
  type InventoryItem,
} from '@/services/inventory'

interface RowDraft {
  productId: number
  productName: string
  category: string
  imageUrl: string | null
  imagePath: string | null
  depot: string
  shelf: string
  originalDepot: number
  originalShelf: number
}

interface InitialStockLoadModalProps {
  open: boolean
  onClose: () => void
  products: InventoryItem[]
  onSuccess: () => Promise<void> | void
}

function toDigits(value: string): string {
  return value.replace(/\D/g, '')
}

export function InitialStockLoadModal({
  open,
  onClose,
  products,
  onSuccess,
}: InitialStockLoadModalProps) {
  const [rows, setRows] = useState<RowDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setRows(
      products
        .slice()
        .sort((a, b) => a.product.name.localeCompare(b.product.name, 'tr'))
        .map((p) => ({
          productId: p.productId,
          productName: p.product.name,
          category: p.product.category,
          imageUrl: p.product.imageUrl,
          imagePath: p.product.imagePath,
          depot: String(p.warehouseQuantity),
          shelf: String(p.shelfQuantity),
          originalDepot: p.warehouseQuantity,
          originalShelf: p.shelfQuantity,
        })),
    )
    setError(null)
    setLoading(false)
    setConfirmOpen(false)
  }, [open, products])

  const changedRows = useMemo(() => {
    return rows.filter((row) => {
      const depot = Number(row.depot)
      const shelf = Number(row.shelf)
      if (!Number.isInteger(depot) || !Number.isInteger(shelf)) return true
      return depot !== row.originalDepot || shelf !== row.originalShelf
    })
  }, [rows])

  function updateRow(productId: number, field: 'depot' | 'shelf', value: string) {
    const digits = toDigits(value)
    setRows((prev) =>
      prev.map((row) => (row.productId === productId ? { ...row, [field]: digits } : row)),
    )
  }

  function validatePayload() {
    const payload: Array<{ productId: number; depotQuantity: number; shelfQuantity: number }> = []
    for (const row of changedRows) {
      if (row.depot === '' || row.shelf === '') {
        return { error: `"${row.productName}" için depo ve raf stoku zorunludur.` }
      }
      const depotQuantity = Number(row.depot)
      const shelfQuantity = Number(row.shelf)
      if (
        !Number.isInteger(depotQuantity) ||
        !Number.isInteger(shelfQuantity) ||
        depotQuantity < 0 ||
        shelfQuantity < 0
      ) {
        return { error: `"${row.productName}" için stok değerleri negatif olmayan tam sayı olmalıdır.` }
      }
      payload.push({ productId: row.productId, depotQuantity, shelfQuantity })
    }
    if (payload.length === 0) {
      return { error: 'Değişiklik yapılacak satır yok.' }
    }
    return { payload }
  }

  function handleSaveClick() {
    setError(null)
    const result = validatePayload()
    if (result.error) {
      setError(result.error)
      return
    }
    setConfirmOpen(true)
  }

  async function handleConfirm() {
    const result = validatePayload()
    if (result.error || !result.payload) {
      setError(result.error ?? 'Geçersiz veri.')
      setConfirmOpen(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      await postInitialStockLoad(result.payload)
      setConfirmOpen(false)
      await onSuccess()
      onClose()
    } catch (err) {
      setConfirmOpen(false)
      setError(err instanceof ApiError ? err.message : 'İlk stok girişi kaydedilemedi.')
    } finally {
      setLoading(false)
    }
  }

  function resetAndClose() {
    if (loading) return
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        size="full"
        title="İlk Stok Girişi"
        description="Sistem ilk kurulurken mevcut depo ve raf stoklarını toplu olarak tanımlayın."
        onClose={resetAndClose}
        footer={
          <>
            <Button variant="outline" onClick={resetAndClose} disabled={loading}>
              Vazgeç
            </Button>
            <Button icon={<Save size={16} />} onClick={handleSaveClick} disabled={loading || rows.length === 0}>
              {loading ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Bu işlem günlük Mal Kabul yerine geçmez. İlk kurulum veya başka sistemden geçiş için
            kullanın. Kaydettiğinizde mevcut depo/raf değerlerinin üzerine yazılır.
          </p>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Tanımlı ürün bulunamadı.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-[55vh] overflow-auto scrollbar-thin">
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5">Ürün</th>
                      <th className="px-3 py-2.5">Kategori</th>
                      <th className="w-36 px-3 py-2.5">Depo Stoğu</th>
                      <th className="w-36 px-3 py-2.5">Raf Stoğu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                    <tr key={row.productId} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <ProductThumb
                            src={row.imageUrl ?? row.imagePath}
                            size="sm"
                            className="h-11 w-11 shrink-0"
                          />
                          <span className="font-medium text-slate-700">{row.productName}</span>
                        </div>
                      </td>
                        <td className="px-3 py-2.5 text-slate-500">{row.category}</td>
                        <td className="px-3 py-2">
                          <Input
                            value={row.depot}
                            onChange={(e) => updateRow(row.productId, 'depot', e.target.value)}
                            inputMode="numeric"
                            className="tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={row.shelf}
                            onChange={(e) => updateRow(row.productId, 'shelf', e.target.value)}
                            inputMode="numeric"
                            className="tabular-nums"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-500">
            Değişen satır: {changedRows.length} / {rows.length}
          </p>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        title="Stokları Güncelle"
        message="Bu işlem mevcut stokları değiştirecektir. Devam etmek istiyor musunuz?"
        confirmLabel={loading ? 'Kaydediliyor...' : 'Evet, Devam Et'}
        tone="danger"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
