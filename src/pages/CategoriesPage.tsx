import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  FolderTree,
  Loader2,
  Package,
  Pencil,
  Plus,
  Power,
  ShieldOff,
  Tags,
  Trash2,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  SearchInput,
  StatusBadge,
  DataTable,
  ConfirmModal,
  StatCard,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button, Select } from '@/components/ui'
import { CategoryFormModal } from '@/components/categories/CategoryFormModal'
import { useAuth } from '@/context/AuthContext'
import {
  createCategory,
  deleteCategory,
  fetchCategoryRows,
  updateCategory,
  updateCategoryStatus,
  type ApiCategoryRow,
  type CategoryPayload,
} from '@/services/categories'
import { ApiError } from '@/services/api'
import { cn } from '@/utils/format'

export function CategoriesPage() {
  const { user } = useAuth()
  const canEdit = user?.role === 'ADMIN'

  const [rows, setRows] = useState<ApiCategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ApiCategoryRow | null>(null)
  const [statusTarget, setStatusTarget] = useState<ApiCategoryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiCategoryRow | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setRows(await fetchCategoryRows())
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Kategoriler yüklenemedi.')
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

  const stats = useMemo(() => {
    const total = rows.length
    const active = rows.filter((r) => r.isActive).length
    const passive = total - active
    const productTotal = rows.reduce((sum, r) => sum + r.productCount, 0)
    return { total, active, passive, productTotal }
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const term = search.trim().toLowerCase()
      const matchesSearch =
        term === '' ||
        row.name.toLowerCase().includes(term) ||
        (row.description ?? '').toLowerCase().includes(term)
      const matchesStatus =
        status === 'all' ||
        (status === 'active' && row.isActive) ||
        (status === 'passive' && !row.isActive)
      return matchesSearch && matchesStatus
    })
  }, [rows, search, status])

  async function handleFormSubmit(payload: CategoryPayload) {
    if (editing) {
      await updateCategory(editing.id, payload)
      setToast('Kategori güncellendi.')
    } else {
      await createCategory(payload)
      setToast('Kategori oluşturuldu.')
    }
    await loadData()
  }

  async function handleToggleStatus() {
    if (!statusTarget || statusLoading) return
    setStatusLoading(true)
    try {
      await updateCategoryStatus(statusTarget.id, !statusTarget.isActive)
      setStatusTarget(null)
      await loadData()
      setToast('Kategori durumu güncellendi.')
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
      setStatusTarget(null)
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleteLoading) return
    setDeleteLoading(true)
    try {
      await deleteCategory(deleteTarget.id)
      setDeleteTarget(null)
      await loadData()
      setToast('Kategori silindi.')
    } catch (err) {
      setLoadError(
        err instanceof ApiError
          ? err.message
          : 'Kategori silinemedi.',
      )
      setDeleteTarget(null)
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: Column<ApiCategoryRow>[] = [
    {
      key: 'name',
      header: 'Kategori Adı',
      render: (row) => <span className="font-medium text-slate-700">{row.name}</span>,
    },
    {
      key: 'description',
      header: 'Açıklama',
      render: (row) => (
        <span className="text-slate-600">{row.description?.trim() ? row.description : '—'}</span>
      ),
    },
    {
      key: 'productCount',
      header: 'Ürün Sayısı',
      align: 'center',
      render: (row) => <StatusBadge tone="neutral">{row.productCount}</StatusBadge>,
    },
    {
      key: 'createdAt',
      header: 'Oluşturulma Tarihi',
      render: (row) => (
        <span className="tabular-nums text-slate-500">
          {new Date(row.createdAt).toLocaleDateString('tr-TR')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.isActive ? (
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
            <>
              <IconAction
                title="Düzenle"
                onClick={() => {
                  setEditing(row)
                  setFormOpen(true)
                }}
              >
                <Pencil size={15} />
              </IconAction>
              <IconAction
                title={row.isActive ? 'Pasife Al' : 'Aktif Yap'}
                tone="danger"
                onClick={() => setStatusTarget(row)}
              >
                <Power size={15} />
              </IconAction>
              <IconAction title="Sil" tone="danger" onClick={() => setDeleteTarget(row)}>
                <Trash2 size={15} />
              </IconAction>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kategori Yönetimi"
        actions={
          canEdit ? (
            <Button
              icon={<Plus size={18} />}
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              Yeni Kategori
            </Button>
          ) : undefined
        }
      />

      {toast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Toplam Kategori" value={String(stats.total)} icon={Tags} tone="brand" description="Tüm kayıtlar" />
        <StatCard label="Aktif Kategori" value={String(stats.active)} icon={FolderTree} tone="emerald" description="Kullanılabilir" />
        <StatCard label="Pasif Kategori" value={String(stats.passive)} icon={ShieldOff} tone="amber" description="Pasife alınan" />
        <StatCard
          label="Bu kategorideki toplam ürün sayısı"
          value={String(stats.productTotal)}
          icon={Package}
          tone="brand"
          description="Tüm kategoriler"
        />
      </div>

      <SectionCard noPadding>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Kategori adı veya açıklama ara..."
            className="w-full max-w-xs"
          />
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
          <span className="ml-auto text-sm text-slate-500">{filtered.length} kategori</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 size={20} className="animate-spin text-brand-600" />
            <span className="text-sm">Kategoriler yükleniyor...</span>
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
            rowKey={(row) => String(row.id)}
            emptyTitle="Kategori bulunamadı"
            emptyDescription="Filtre kriterlerine uygun kategori yok."
          />
        )}
      </SectionCard>

      <CategoryFormModal
        open={formOpen}
        category={editing}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        onSubmit={handleFormSubmit}
      />

      <ConfirmModal
        open={statusTarget !== null}
        title="Durum Değiştir"
        message={`"${statusTarget?.name}" kategorisinin durumunu değiştirmek istediğinize emin misiniz?`}
        confirmLabel={statusLoading ? 'Güncelleniyor...' : 'Evet, Değiştir'}
        onConfirm={() => void handleToggleStatus()}
        onCancel={() => setStatusTarget(null)}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title="Kategoriyi Sil"
        message="Bu kategori kalıcı olarak silinecek. Devam etmek istiyor musunuz?"
        confirmLabel={deleteLoading ? 'Siliniyor...' : 'Sil'}
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
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
