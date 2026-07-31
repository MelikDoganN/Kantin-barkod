import { useEffect, useRef, useState } from 'react'
import { ImageOff, ImagePlus, Save } from 'lucide-react'
import { Modal } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import { BarcodeField, type BarcodeFieldHandle } from '@/components/products/BarcodeField'
import { ProductThumb } from '@/components/products/ProductThumb'
import type { Product } from '@/types'
import type { ApiCategory, ProductPayload } from '@/services/catalog'
import { ApiError } from '@/services/api'
import { fetchSettings } from '@/services/settings'
import { isBarcodeTooShort, normalizeBarcode } from '@/utils/barcode'

export interface ProductFormExtras {
  imageFile: File | null
  removeImage: boolean
}

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  categories: ApiCategory[]
  product?: Product | null
  existingProducts?: Product[]
  onSubmit: (payload: ProductPayload, extras: ProductFormExtras) => Promise<void>
}

const unitOptions = [
  { value: 'unit', label: 'Adet' },
  { value: 'case', label: 'Koli' },
]

const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

export function ProductFormModal({
  open,
  onClose,
  categories,
  product = null,
  existingProducts = [],
  onSubmit,
}: ProductFormModalProps) {
  // Yeni üründe yalnızca aktif kategoriler; düzenlemede mevcut (pasif) kategori seçeneklere eklenir.
  const categoryOptions = categories
    .filter((c) => c.isActive || (product != null && String(c.id) === product.categoryId))
    .map((c) => ({
      value: String(c.id),
      label: c.isActive ? c.name : `${c.name} (Pasif)`,
    }))
  const fileRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<BarcodeFieldHandle>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [barcodeScannerEnabled, setBarcodeScannerEnabled] = useState<boolean | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [casePackSize, setCasePackSize] = useState('')
  const [criticalLevel, setCriticalLevel] = useState('')
  const [unitType, setUnitType] = useState('unit')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [removeImage, setRemoveImage] = useState(false)

  useEffect(() => {
    if (!open) return
    if (product) {
      setName(product.name)
      setBarcode(product.barcode)
      setCategoryId(product.categoryId)
      setPurchasePrice(String(product.purchasePrice))
      setSalePrice(String(product.salePrice))
      setCasePackSize(String(product.casePackSize))
      setCriticalLevel(String(product.criticalLevel))
      setUnitType(product.unitType)
      setPreviewUrl(product.imageUrl ?? product.imagePath ?? null)
    } else {
      setName('')
      setBarcode('')
      setCategoryId(categoryOptions[0]?.value ?? '')
      setPurchasePrice('')
      setSalePrice('')
      setCasePackSize('1')
      setCriticalLevel('0')
      setUnitType('unit')
      setPreviewUrl(null)
    }
    setImageFile(null)
    setRemoveImage(false)
    setError(null)
    setLoading(false)
  }, [open, product])

  useEffect(() => {
    if (!open) return
    setBarcodeScannerEnabled(null)
    void fetchSettings()
      .then((settings) => setBarcodeScannerEnabled(settings.barcode.barcodeEnabled))
      .catch(() => setBarcodeScannerEnabled(true))
  }, [open])

  useEffect(() => {
    if (!open || product || barcodeScannerEnabled !== true) return
    const timer = window.setTimeout(() => barcodeRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [open, product, barcodeScannerEnabled])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function resetAndClose() {
    if (loading) return
    onClose()
  }

  function handlePickFile(file: File | undefined) {
    if (!file) return
    if (!ALLOWED_TYPES.has(file.type) || file.name.toLowerCase().endsWith('.svg')) {
      setError('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Görsel boyutu en fazla 3 MB olabilir.')
      return
    }
    setError(null)
    setRemoveImage(false)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function isDuplicateBarcode(value: string): boolean {
    const normalized = normalizeBarcode(value)
    if (!normalized) return false
    const currentId = product ? String(product.id) : null
    return existingProducts.some(
      (item) => normalizeBarcode(item.barcode) === normalized && String(item.id) !== currentId,
    )
  }

  function validateBarcode(value: string): string | null {
    const normalized = normalizeBarcode(value)
    if (!normalized) return null
    if (isBarcodeTooShort(normalized)) return 'Barkod geçersiz.'
    if (isDuplicateBarcode(normalized)) return 'Bu barkod başka bir üründe kayıtlı.'
    return null
  }

  function handleBarcodeEnter(value: string) {
    const normalized = normalizeBarcode(value)
    setBarcode(normalized)
    const validationError = validateBarcode(normalized)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    if (normalized) {
      nameInputRef.current?.focus()
    }
  }

  async function handleSave() {
    if (loading) return
    setError(null)

    if (!name.trim()) {
      setError('Ürün adı zorunludur.')
      return
    }
    if (!categoryId) {
      setError('Kategori seçiniz.')
      return
    }

    const barcodeError = validateBarcode(barcode)
    if (barcodeError) {
      setError(barcodeError)
      barcodeRef.current?.focus()
      return
    }

    const purchase = Number(purchasePrice)
    const sale = Number(salePrice)
    if (!Number.isFinite(purchase) || purchase <= 0) {
      setError("Alış fiyatı 0'dan büyük olmalıdır.")
      return
    }
    if (!Number.isFinite(sale) || sale <= 0) {
      setError("Satış fiyatı 0'dan büyük olmalıdır.")
      return
    }

    const payload: ProductPayload = {
      name: name.trim(),
      barcode: barcode.trim() || null,
      categoryId: Number(categoryId),
      purchasePrice: purchase,
      salePrice: sale,
      unitType,
      unitsPerCarton: Number(casePackSize) > 0 ? Number(casePackSize) : 1,
      minimumStock: Number(criticalLevel) >= 0 ? Number(criticalLevel) : 0,
    }

    setLoading(true)
    try {
      await onSubmit(payload, { imageFile, removeImage })
      onClose()
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = err.message.toLowerCase()
        if (err.status === 409 && msg.includes('barkod')) {
          setError('Bu barkod zaten kayıtlı.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Ürün kaydedilemedi.')
      }
    } finally {
      setLoading(false)
    }
  }

  const showPreview = Boolean(previewUrl) && !removeImage

  return (
    <Modal
      open={open}
      title={product ? 'Ürünü Düzenle' : 'Yeni Ürün'}
      description={
        product
          ? 'Ürün bilgilerini güncelleyin.'
          : 'Yeni bir ürün ekleyin ve stok bilgilerini tanımlayın.'
      }
      onClose={resetAndClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={resetAndClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button icon={<Save size={16} />} onClick={() => void handleSave()} disabled={loading}>
            {loading ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Ürün Görseli
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              handlePickFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            {showPreview ? (
              <ProductThumb
                src={previewUrl}
                fallback={product?.icon}
                size="lg"
                className="rounded-xl"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                <ImagePlus size={22} />
              </span>
            )}
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                icon={<ImagePlus size={16} />}
                disabled={loading}
                onClick={() => fileRef.current?.click()}
              >
                Görsel Seç
              </Button>
              {(showPreview || product?.imageUrl) && (
                <Button
                  type="button"
                  variant="outline"
                  icon={<ImageOff size={16} />}
                  disabled={loading}
                  onClick={() => {
                    setImageFile(null)
                    setRemoveImage(true)
                    setPreviewUrl(null)
                  }}
                >
                  Görseli Kaldır
                </Button>
              )}
              <p className="text-xs text-slate-400">JPG, PNG veya WEBP · en fazla 3 MB</p>
            </div>
          </div>
        </div>

        <Input
          ref={nameInputRef}
          label="Ürün Adı"
          placeholder="Örn. Su 0.5 L"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <BarcodeField
          ref={barcodeRef}
          value={barcode}
          onChange={(value) => {
            setBarcode(value)
            if (error) setError(null)
          }}
          onEnter={handleBarcodeEnter}
          scannerEnabled={barcodeScannerEnabled ?? true}
          disabled={loading}
          hint={
            barcodeScannerEnabled === false
              ? 'Barkod okuyucu ayarlarda kapalı; elle girebilirsiniz.'
              : 'USB barkod okuyucu ile okutun veya elle yazın.'
          }
        />
        <Select
          label="Kategori"
          options={categoryOptions}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
        <Select
          label="Birim Tipi"
          options={unitOptions}
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
        />
        <Input
          label="Alış Fiyatı (₺)"
          type="number"
          placeholder="0,00"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
        />
        <Input
          label="Satış Fiyatı (₺)"
          type="number"
          placeholder="0,00"
          value={salePrice}
          onChange={(e) => setSalePrice(e.target.value)}
        />
        <Input
          label="Koli İçi Adet"
          type="number"
          placeholder="Örn. 24"
          value={casePackSize}
          onChange={(e) => setCasePackSize(e.target.value)}
        />
        <Input
          label="Minimum Stok Seviyesi"
          type="number"
          placeholder="Örn. 12"
          value={criticalLevel}
          onChange={(e) => setCriticalLevel(e.target.value)}
        />

        {error && (
          <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}
