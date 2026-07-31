import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeftRight, Loader2, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  SearchInput,
  StatusBadge,
  DataTable,
  ConfirmModal,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button, Select } from '@/components/ui'
import {
  ProductFormModal,
  type ProductFormExtras,
} from '@/components/products/ProductFormModal'
import { ProductDetailPanel } from '@/components/products/ProductDetailPanel'
import { ProductThumb } from '@/components/products/ProductThumb'
import { useAuth } from '@/context/AuthContext'
import { hasPermission } from '@/config/permissions'
import {
  createProduct,
  fetchCategories,
  fetchProducts,
  updateProduct,
  updateProductStatus,
  type ApiCategory,
  type ProductPayload,
} from '@/services/catalog'
import {
  deleteProduct,
  deleteProductImage,
  uploadProductImage,
} from '@/services/products'
import { ApiError } from '@/services/api'
import type { BadgeTone, Product } from '@/types'
import { formatCurrency, cn } from '@/utils/format'

function shelfTone(product: Product): BadgeTone {
  if (product.shelfStock <= product.criticalLevel) return 'danger'
  if (product.shelfStock <= product.criticalLevel * 2) return 'warning'
  return 'success'
}

export function ProductsPage() {
  const { user } = useAuth()
  const canEdit = hasPermission(user?.role, 'product.edit')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [stockFilter, setStockFilter] = useState('all')
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [historyTarget, setHistoryTarget] = useState<Product | null>(null)
  const [detailProduct, setDetailProduct] = useState<Product | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [productList, categoryList] = await Promise.all([fetchProducts(), fetchCategories()])
      setProducts(productList)
      setCategories(categoryList)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Ürünler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    return products.filter((product) => {
      const term = search.trim().toLowerCase()
      const matchesSearch =
        term === '' ||
        product.name.toLowerCase().includes(term) ||
        product.barcode.includes(term)
      const matchesCategory = category === 'all' || product.categoryId === category
      const matchesStatus = status === 'all' || product.status === status
      const isCritical = product.shelfStock <= product.criticalLevel
      const matchesStock =
        stockFilter === 'all' ||
        (stockFilter === 'critical' && isCritical) ||
        (stockFilter === 'normal' && !isCritical)
      return matchesSearch && matchesCategory && matchesStatus && matchesStock
    })
  }, [products, search, category, status, stockFilter])

  async function handleFormSubmit(payload: ProductPayload, extras: ProductFormExtras) {
    if (editingProduct) {
      const updated = await updateProduct(Number(editingProduct.id), payload)
      try {
        if (extras.removeImage) {
          await deleteProductImage(updated.id)
        } else if (extras.imageFile) {
          await uploadProductImage(updated.id, extras.imageFile)
        }
      } catch (err) {
        await loadData()
        throw new ApiError(
          err instanceof ApiError ? err.message : 'Ürün güncellendi ancak görsel yüklenemedi.',
          err instanceof ApiError ? err.status : 400,
        )
      }
      await loadData()
      setToast('Ürün güncellendi.')
    } else {
      const created = await createProduct(payload)
      if (extras.imageFile) {
        try {
          await uploadProductImage(created.id, extras.imageFile)
        } catch {
          await loadData()
          throw new ApiError('Ürün oluşturuldu ancak görsel yüklenemedi.', 400)
        }
      }
      await loadData()
      setToast('Ürün oluşturuldu.')
    }
  }

  async function handleToggleStatus() {
    if (!confirmTarget || statusLoading) return
    setStatusLoading(true)
    try {
      const updated = await updateProductStatus(
        Number(confirmTarget.id),
        confirmTarget.status !== 'active',
      )
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      setDetailProduct((prev) => (prev?.id === updated.id ? updated : prev))
      setConfirmTarget(null)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
      setConfirmTarget(null)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteLoading) return
    setDeleteLoading(true)
    try {
      await deleteProduct(deleteTarget.id)
      setDeleteTarget(null)
      setDetailProduct((prev) => (prev?.id === deleteTarget.id ? null : prev))
      await loadData()
      setToast('Ürün silindi.')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PRODUCT_HAS_HISTORY') {
        setHistoryTarget(deleteTarget)
        setDeleteTarget(null)
      } else {
        setLoadError(err instanceof ApiError ? err.message : 'Ürün silinemedi.')
        setDeleteTarget(null)
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handlePassiveFromHistory() {
    if (!historyTarget || statusLoading) return
    setStatusLoading(true)
    try {
      await updateProductStatus(Number(historyTarget.id), false)
      setHistoryTarget(null)
      await loadData()
      setToast('Ürün pasife alındı.')
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
      setHistoryTarget(null)
    } finally {
      setStatusLoading(false)
    }
  }

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  const columns: Column<Product>[] = [
    {
      key: 'image',
      header: 'Görsel',
      width: '56px',
      render: (row) => (
        <ProductThumb src={row.imageUrl ?? row.imagePath} fallback={row.icon} size="sm" />
      ),
    },
    {
      key: 'name',
      header: 'Ürün Adı',
      render: (row) => (
        <span className="font-medium text-slate-700">{row.name}</span>
      ),
    },
    {
      key: 'barcode',
      header: 'Barkod',
      render: (row) => (
        <span className="tabular-nums text-slate-500">
          {row.barcode || '—'}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (row) => (
        <span className="text-slate-600">{row.categoryName}</span>
      ),
    },
    {
      key: 'purchasePrice',
      header: 'Alış',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-slate-600">
          {formatCurrency(row.purchasePrice)}
        </span>
      ),
    },
    {
      key: 'salePrice',
      header: 'Satış',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-semibold text-slate-700">
          {formatCurrency(row.salePrice)}
        </span>
      ),
    },
    {
      key: 'profit',
      header: 'Kâr',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums font-semibold text-emerald-600">
          {formatCurrency(row.salePrice - row.purchasePrice)}
        </span>
      ),
    },
    {
      key: 'warehouseStock',
      header: 'Depo',
      align: 'center',
      render: (row) => <StatusBadge tone="neutral">{row.warehouseStock}</StatusBadge>,
    },
    {
      key: 'shelfStock',
      header: 'Raf',
      align: 'center',
      render: (row) => <StatusBadge tone={shelfTone(row)}>{row.shelfStock}</StatusBadge>,
    },
    {
      key: 'case',
      header: 'Koli',
      align: 'center',
      render: (row) => (
        <span className="text-slate-500">
          {row.casePackSize > 0 ? `${row.casePackSize} adet` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.status === 'active' ? (
          <StatusBadge tone="success">Aktif</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">Pasif</StatusBadge>
        ),
    },
    {
      key: 'actions',
      header: 'İşlemler',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {canEdit && (
            <IconAction title="Düzenle" onClick={() => openEdit(row)}>
              <Pencil size={15} />
            </IconAction>
          )}
          <IconAction title="Stok Hareketleri" onClick={() => setDetailProduct(row)}>
            <ArrowLeftRight size={15} />
          </IconAction>
          {canEdit && (
            <IconAction
              title={row.status === 'active' ? 'Pasife Al' : 'Aktif Et'}
              tone="danger"
              onClick={() => setConfirmTarget(row)}
            >
              <Power size={15} />
            </IconAction>
          )}
          {canEdit && (
            <IconAction title="Sil" tone="danger" onClick={() => setDeleteTarget(row)}>
              <Trash2 size={15} />
            </IconAction>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ürün Yönetimi"
        actions={
          canEdit ? (
            <Button icon={<Plus size={18} />} onClick={openCreate}>
              Yeni Ürün
            </Button>
          ) : undefined
        }
      />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}

      <SectionCard noPadding>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Ürün adı veya barkod ara..."
            className="w-full max-w-xs"
          />
          <div className="w-44">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'all', label: 'Kategori: Tümü' },
                ...categories.map((c) => ({ value: String(c.id), label: c.name })),
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: 'all', label: 'Durum: Tümü' },
                { value: 'active', label: 'Aktif' },
                { value: 'passive', label: 'Pasif' },
              ]}
            />
          </div>
          <div className="w-40">
            <Select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Stok: Tümü' },
                { value: 'normal', label: 'Yeterli' },
                { value: 'critical', label: 'Kritik' },
              ]}
            />
          </div>
          <span className="ml-auto text-sm text-slate-500">
            {filtered.length} ürün
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 size={20} className="animate-spin text-brand-600" />
            <span className="text-sm">Ürünler yükleniyor...</span>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button variant="outline" onClick={() => void loadData()}>
              Tekrar Dene
            </Button>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            onRowClick={(row) => setDetailProduct(row)}
            emptyTitle="Ürün bulunamadı"
            emptyDescription="Filtre kriterlerine uygun ürün yok."
          />
        )}
      </SectionCard>

      <ProductFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingProduct(null)
        }}
        categories={categories}
        product={editingProduct}
        existingProducts={products}
        onSubmit={handleFormSubmit}
      />

      <ProductDetailPanel product={detailProduct} onClose={() => setDetailProduct(null)} />

      <ConfirmModal
        open={confirmTarget !== null}
        title="Durum Değiştir"
        message={`"${confirmTarget?.name}" ürününün durumunu değiştirmek istediğinize emin misiniz?`}
        confirmLabel={statusLoading ? 'Güncelleniyor...' : 'Evet, Değiştir'}
        onConfirm={() => void handleToggleStatus()}
        onCancel={() => setConfirmTarget(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Ürünü Sil"
        message="Bu ürün kalıcı olarak silinecek. Devam etmek istiyor musunuz?"
        confirmLabel={deleteLoading ? 'Siliniyor...' : 'Sil'}
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={historyTarget !== null}
        title="Silinemiyor"
        message="Bu ürün geçmiş işlemlerde kullanılmış. Kalıcı olarak silinemez. Pasife almak ister misiniz?"
        confirmLabel={statusLoading ? 'Güncelleniyor...' : 'Pasife Al'}
        cancelLabel="İptal"
        onConfirm={() => void handlePassiveFromHistory()}
        onCancel={() => setHistoryTarget(null)}
      />
    </div>
  )
}

interface IconActionProps {
  title: string
  tone?: 'default' | 'danger'
  onClick: () => void
  children: ReactNode
}

function IconAction({ title, tone = 'default', onClick, children }: IconActionProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors',
        tone === 'danger'
          ? 'hover:border-red-200 hover:bg-red-50 hover:text-red-600'
          : 'hover:bg-slate-50 hover:text-brand-600',
      )}
    >
      {children}
    </button>
  )
}
