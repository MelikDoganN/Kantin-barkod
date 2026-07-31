import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  CheckCircle2,
  ClipboardCheck,
  CalendarDays,
  Boxes,
  Scale,
  Warehouse,
  LayoutGrid,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Utensils,
  Eye,
  Trash2,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTable,
  Drawer,
} from '@/components/common'
import type { Column } from '@/components/common'
import { Button, Input, Select } from '@/components/ui'
import { CountHistoryDetailDrawer } from '@/components/count/CountHistoryDetailDrawer'
import { ProductThumb } from '@/components/products/ProductThumb'
import {
  completeCount,
  fetchActiveCount,
  fetchCountHistory,
  fetchCountSummary,
  startCount,
  updateCountItem,
  type ApiCountDetail,
  type ApiCountItem,
} from '@/services/counts'
import {
  fetchMovements,
  formatMovementDate,
  movementLabels,
  type StockMovementRow,
} from '@/services/inventory'
import { ApiError } from '@/services/api'
import type { BadgeTone, CountHistoryEntry, CountSummary, CountType } from '@/types'
import { cn } from '@/utils/format'

interface CountRow {
  itemId: number
  productId: number
  name: string
  barcode: string
  categoryName: string
  imageUrl: string | null
  imagePath: string | null
  systemStock: number
  counted: number | ''
  note: string
  reason: string
  difference: number | null
  status: ApiCountItem['status']
  result: ApiCountItem['result']
}

const reasonOptions = [
  { value: '', label: 'Fark nedeni seçin...' },
  { value: 'waste', label: 'Fire' },
  { value: 'lost', label: 'Kayıp' },
  { value: 'wrong-entry', label: 'Hatalı giriş' },
  { value: 'staff', label: 'Personel tüketimi' },
  { value: 'other', label: 'Diğer' },
]

const emptySummary: CountSummary = {
  activeCount: 0,
  lastCountDate: '—',
  totalCountedProducts: 0,
  stockDifference: 0,
}

function mapItemsToRows(items: ApiCountItem[]): CountRow[] {
  return items.map((item) => ({
    itemId: item.id,
    productId: item.productId,
    name: item.product.name,
    barcode: item.product.barcode ?? '—',
    categoryName: item.product.category,
    imageUrl: item.product.imageUrl,
    imagePath: item.product.imagePath,
    systemStock: item.systemQuantity,
    counted: item.countedQuantity === null ? '' : item.countedQuantity,
    note: item.note ?? '',
    reason: '',
    difference: item.difference,
    status: item.status,
    result: item.result,
  }))
}

function diffStatus(diff: number | null): { tone: BadgeTone; label: string } {
  if (diff === null) return { tone: 'neutral', label: 'Bekliyor' }
  if (diff === 0) return { tone: 'success', label: 'Aynı' }
  if (diff < 0) return { tone: 'danger', label: 'Eksik' }
  return { tone: 'success', label: 'Fazla' }
}

function movementIcon(type: string) {
  switch (type) {
    case 'SALE':
      return { Icon: ArrowUpRight, tone: 'text-brand-600' }
    case 'PERSONNEL_CONSUMPTION':
      return { Icon: Utensils, tone: 'text-violet-600' }
    case 'CARTON_OPEN':
      return { Icon: ArrowLeftRight, tone: 'text-amber-600' }
    case 'PURCHASE':
      return { Icon: ArrowDownLeft, tone: 'text-emerald-600' }
    case 'WASTE':
      return { Icon: Trash2, tone: 'text-red-600' }
    default:
      return { Icon: Scale, tone: 'text-slate-600' }
  }
}

export function StockCountPage() {
  const [newType, setNewType] = useState<CountType>('shelf')
  const [countDate, setCountDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [newNote, setNewNote] = useState('')
  const [active, setActive] = useState<ApiCountDetail | null>(null)
  const [rows, setRows] = useState<CountRow[]>([])
  const [history, setHistory] = useState<CountHistoryEntry[]>([])
  const [summaryCards, setSummaryCards] = useState<CountSummary>(emptySummary)
  const [detailItemId, setDetailItemId] = useState<number | null>(null)
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const patchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const countType: CountType =
    active?.type.toUpperCase() === 'WAREHOUSE' ? 'warehouse' : 'shelf'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [summary, hist, current] = await Promise.all([
        fetchCountSummary(),
        fetchCountHistory(),
        fetchActiveCount(),
      ])
      setSummaryCards(summary)
      setHistory(hist)
      setActive(current)
      setRows(current ? mapItemsToRows(current.items) : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sayım verileri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      Object.values(patchTimers.current).forEach(clearTimeout)
    }
  }, [load])

  async function handleStartCount() {
    setSaving(true)
    setError(null)
    try {
      const created = await startCount({
        type: newType === 'warehouse' ? 'WAREHOUSE' : 'SHELF',
        description: newNote.trim() || undefined,
      })
      setActive(created)
      setRows(mapItemsToRows(created.items))
      setNewNote('')
      setDetailItemId(null)
      const summary = await fetchCountSummary()
      setSummaryCards(summary)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sayım başlatılamadı.')
    } finally {
      setSaving(false)
    }
  }

  function scheduleItemPatch(itemId: number, counted: number, note: string) {
    if (!active) return
    if (patchTimers.current[itemId]) clearTimeout(patchTimers.current[itemId])
    patchTimers.current[itemId] = setTimeout(() => {
      void (async () => {
        try {
          const updated = await updateCountItem(active.id, itemId, {
            countedQuantity: counted,
            note: note || undefined,
          })
          setRows((prev) =>
            prev.map((row) =>
              row.itemId === itemId
                ? {
                    ...row,
                    counted: updated.countedQuantity ?? '',
                    difference: updated.difference,
                    status: updated.status,
                    result: updated.result,
                    note: updated.note ?? '',
                    systemStock: updated.systemQuantity,
                  }
                : row,
            ),
          )
          setActive((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              items: prev.items.map((item) => (item.id === itemId ? { ...item, ...updated } : item)),
            }
          })
        } catch (err) {
          setError(err instanceof ApiError ? err.message : 'Sayım kalemi güncellenemedi.')
        }
      })()
    }, 400)
  }

  function updateRow(itemId: number, patch: Partial<CountRow>) {
    setRows((prev) => {
      const next = prev.map((row) => (row.itemId === itemId ? { ...row, ...patch } : row))
      const row = next.find((r) => r.itemId === itemId)
      if (row && row.counted !== '') {
        scheduleItemPatch(itemId, Number(row.counted), row.note)
      }
      return next
    })
  }

  async function handleComplete() {
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      await completeCount(active.id)
      setActive(null)
      setRows([])
      setDetailItemId(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sayım tamamlanamadı.')
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    let missing = 0
    let excess = 0
    let same = 0
    for (const row of rows) {
      if (row.counted === '') continue
      const diff = Number(row.counted) - row.systemStock
      if (diff < 0) missing += 1
      else if (diff > 0) excess += 1
      else same += 1
    }
    return { total: rows.length, missing, excess, same }
  }, [rows])

  const detailRow = rows.find((row) => row.itemId === detailItemId) ?? null

  const columns: Column<CountRow>[] = [
    {
      key: 'image',
      header: 'Görsel',
      width: '56px',
      render: (row) => (
        <ProductThumb
          src={row.imageUrl ?? row.imagePath}
          size="sm"
          className="h-11 w-11"
        />
      ),
    },
    {
      key: 'name',
      header: 'Ürün',
      render: (row) => (
        <button
          onClick={() => setDetailItemId(row.itemId)}
          className="text-left font-medium text-slate-700 hover:text-brand-600"
        >
          {row.name}
        </button>
      ),
    },
    {
      key: 'barcode',
      header: 'Barkod',
      render: (row) => <span className="tabular-nums text-slate-500">{row.barcode}</span>,
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (row) => <span className="text-slate-600">{row.categoryName}</span>,
    },
    {
      key: 'system',
      header: 'Sistem',
      align: 'center',
      render: (row) => <span className="font-medium text-slate-700">{row.systemStock}</span>,
    },
    {
      key: 'counted',
      header: 'Sayılan',
      align: 'center',
      render: (row) => (
        <input
          type="number"
          value={row.counted}
          disabled={!active || saving}
          onChange={(e) =>
            updateRow(row.itemId, {
              counted: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
          placeholder="0"
          className="h-9 w-20 rounded-lg border border-slate-300 px-2 text-center text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
        />
      ),
    },
    {
      key: 'diff',
      header: 'Fark',
      align: 'center',
      render: (row) => {
        if (row.counted === '') return <span className="text-slate-400">—</span>
        const diff = Number(row.counted) - row.systemStock
        return (
          <span
            className={cn(
              'font-semibold tabular-nums',
              diff === 0 ? 'text-slate-500' : diff < 0 ? 'text-red-600' : 'text-emerald-600',
            )}
          >
            {diff > 0 ? '+' : ''}
            {diff}
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) => {
        const diff = row.counted === '' ? null : Number(row.counted) - row.systemStock
        const status = diffStatus(diff)
        return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      },
    },
    {
      key: 'note',
      header: 'Açıklama',
      render: (row) => (
        <input
          type="text"
          value={row.note}
          disabled={!active || saving}
          onChange={(e) => updateRow(row.itemId, { note: e.target.value })}
          placeholder="Not..."
          className="h-9 w-36 rounded-lg border border-slate-300 px-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
        />
      ),
    },
    {
      key: 'action',
      header: 'İşlem',
      align: 'right',
      render: (row) => (
        <button
          title="Detay"
          onClick={() => setDetailItemId(row.itemId)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-brand-600"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ]

  const historyColumns: Column<CountHistoryEntry>[] = [
    { key: 'date', header: 'Tarih', render: (row) => <span className="tabular-nums text-slate-600">{row.date}</span> },
    {
      key: 'type',
      header: 'Tür',
      render: (row) => (
        <span className="text-slate-600">{row.type === 'shelf' ? 'Raf Sayımı' : 'Depo Sayımı'}</span>
      ),
    },
    { key: 'user', header: 'Yapan Kullanıcı', render: (row) => row.user },
    { key: 'count', header: 'Ürün Sayısı', align: 'right', render: (row) => row.productCount },
    {
      key: 'diff',
      header: 'Fark',
      align: 'right',
      render: (row) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            row.difference === 0 ? 'text-slate-500' : row.difference < 0 ? 'text-red-600' : 'text-emerald-600',
          )}
        >
          {row.difference > 0 ? '+' : ''}
          {row.difference}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) =>
        row.status === 'completed' ? (
          <StatusBadge tone="success">Tamamlandı</StatusBadge>
        ) : (
          <StatusBadge tone="warning">Devam ediyor</StatusBadge>
        ),
    },
    {
      key: 'actions',
      header: 'İşlem',
      align: 'right',
      render: (row) => (
        <button
          title="Detay"
          onClick={(e) => {
            e.stopPropagation()
            setHistoryDetailId(row.id)
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-brand-600"
        >
          <Eye size={14} />
          Detay
        </button>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sayım Yönetimi"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => void handleStartCount()} disabled={saving || !!active}>
            Yeni Sayım
          </Button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Aktif Sayım" value={String(summaryCards.activeCount)} icon={ClipboardCheck} tone="brand" description="Devam eden sayım" />
        <StatCard label="Son Sayım Tarihi" value={summaryCards.lastCountDate} icon={CalendarDays} tone="brand" description="En son tamamlanan" />
        <StatCard label="Toplam Sayılan Ürün" value={String(summaryCards.totalCountedProducts)} icon={Boxes} tone="emerald" description="Bu ayki toplam" />
        <StatCard label="Stok Farkı" value={`${summaryCards.stockDifference} adet`} icon={Scale} tone="amber" description="Son sayım farkı" />
      </div>

      <SectionCard title="Yeni Sayım Başlat" description="Sayım türünü seçip başlayın">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Sayım Türü</span>
            <div className="grid grid-cols-2 gap-2">
              <TypeOption
                active={newType === 'shelf'}
                icon={<LayoutGrid size={16} />}
                label="Raf Sayımı"
                onClick={() => setNewType('shelf')}
              />
              <TypeOption
                active={newType === 'warehouse'}
                icon={<Warehouse size={16} />}
                label="Depo Sayımı"
                onClick={() => setNewType('warehouse')}
              />
            </div>
          </div>
          <Input
            label="Sayım Tarihi"
            type="date"
            value={countDate}
            onChange={(e) => setCountDate(e.target.value)}
          />
          <Input
            label="Açıklama"
            placeholder="İsteğe bağlı not"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <Button icon={<Plus size={18} />} onClick={() => void handleStartCount()} disabled={saving || !!active}>
            Sayımı Başlat
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title={
          active
            ? countType === 'shelf'
              ? 'Aktif Sayım · Raf Sayımı'
              : 'Aktif Sayım · Depo Sayımı'
            : 'Aktif Sayım'
        }
        description="Sayılan miktarı girin, fark otomatik hesaplanır"
        noPadding
      >
        {loading ? (
          <p className="px-4 py-6 text-sm text-slate-500">Yükleniyor…</p>
        ) : !active ? (
          <p className="px-4 py-6 text-sm text-slate-500">Devam eden sayım yok. Yeni sayım başlatın.</p>
        ) : (
          <>
            <DataTable columns={columns} data={rows} rowKey={(row) => String(row.itemId)} />
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <SummaryChip label="Toplam" value={summary.total} tone="neutral" />
                <SummaryChip label="Eksik" value={summary.missing} tone="danger" />
                <SummaryChip label="Fazla" value={summary.excess} tone="success" />
                <SummaryChip label="Değişmeyen" value={summary.same} tone="success" />
              </div>
              <Button
                icon={<CheckCircle2 size={18} />}
                onClick={() => void handleComplete()}
                disabled={saving || summary.same + summary.missing + summary.excess < summary.total}
              >
                Sayımı Tamamla
              </Button>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Geçmiş Sayımlar" description="Tamamlanan sayım kayıtları" noPadding>
        <DataTable
          columns={historyColumns}
          data={history}
          rowKey={(row) => row.id}
          onRowClick={(row) => setHistoryDetailId(row.id)}
          emptyTitle="Geçmiş sayım yok"
          emptyDescription="Tamamlanan sayımlar burada listelenir."
        />
      </SectionCard>

      <CountDetailDrawer
        row={detailRow}
        onClose={() => setDetailItemId(null)}
        onReasonChange={(reason) => detailRow && updateRow(detailRow.itemId, { reason })}
        onNoteChange={(note) => detailRow && updateRow(detailRow.itemId, { note })}
      />

      <CountHistoryDetailDrawer
        countId={historyDetailId}
        onClose={() => setHistoryDetailId(null)}
      />
    </div>
  )
}

interface TypeOptionProps {
  active: boolean
  icon: React.ReactNode
  label: string
  onClick: () => void
}

function TypeOption({ active, icon, label, onClick }: TypeOptionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded-full border-2',
          active ? 'border-brand-500' : 'border-slate-300',
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-brand-500" />}
      </span>
      {icon}
      {label}
    </button>
  )
}

interface SummaryChipProps {
  label: string
  value: number
  tone: BadgeTone
}

const chipStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  info: 'bg-brand-50 text-brand-700',
  neutral: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-50 text-violet-700',
}

function SummaryChip({ label, value, tone }: SummaryChipProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium', chipStyles[tone])}>
      {label}
      <span className="font-bold">{value}</span>
    </span>
  )
}

interface CountDetailDrawerProps {
  row: CountRow | null
  onClose: () => void
  onReasonChange: (reason: string) => void
  onNoteChange: (note: string) => void
}

function CountDetailDrawer({ row, onClose, onReasonChange, onNoteChange }: CountDetailDrawerProps) {
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  useEffect(() => {
    if (!row) {
      setMovements([])
      return
    }
    let cancelled = false
    setMovementsLoading(true)
    ;(async () => {
      try {
        const rows = await fetchMovements({ productId: row.productId })
        if (!cancelled) setMovements(rows.slice(0, 6))
      } catch {
        if (!cancelled) setMovements([])
      } finally {
        if (!cancelled) setMovementsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [row])

  if (!row) return <Drawer open={false} title="" onClose={onClose} children={null} />

  const diff = row.counted === '' ? null : Number(row.counted) - row.systemStock
  const status = diffStatus(diff)

  return (
    <Drawer open title="Sayım Detayı" description="Ürün ve fark bilgileri" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-4 rounded-card border border-slate-200 bg-white p-4">
          <ProductThumb
            src={row.imageUrl ?? row.imagePath}
            size="lg"
            className="h-16 w-16 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-800">{row.name}</p>
            <p className="text-sm text-slate-500">{row.categoryName}</p>
            <p className="mt-1 text-xs tabular-nums text-slate-400">{row.barcode}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-xs text-slate-500">Sistem</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-700">{row.systemStock}</p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-xs text-slate-500">Sayım</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-700">
              {row.counted === '' ? '—' : row.counted}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 py-3">
            <p className="text-xs text-slate-500">Fark</p>
            <p
              className={cn(
                'mt-0.5 text-lg font-bold',
                diff === null || diff === 0 ? 'text-slate-700' : diff < 0 ? 'text-red-600' : 'text-emerald-600',
              )}
            >
              {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">Durum</span>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>

        {diff !== null && diff !== 0 && (
          <div className="space-y-3 rounded-card border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-700">Fark Nedeni</p>
            <Select
              options={reasonOptions}
              value={row.reason}
              onChange={(e) => onReasonChange(e.target.value)}
            />
            <Input
              label="Açıklama"
              placeholder="Fark ile ilgili not"
              value={row.note}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </div>
        )}

        <div className="rounded-card border border-slate-200 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Son Stok Hareketleri</p>
          {movementsLoading ? (
            <p className="text-sm text-slate-400">Yükleniyor…</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-slate-400">Hareket bulunamadı.</p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {movements.map((movement) => {
                const { Icon, tone } = movementIcon(movement.type)
                const qty =
                  movement.quantity > 0 ? `+${movement.quantity}` : String(movement.quantity)
                return (
                  <li key={movement.id} className="flex items-center gap-3">
                    <Icon size={16} className={tone} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-700">
                        {movementLabels[movement.type] ?? movement.type}
                      </p>
                      <p className="text-xs text-slate-400">{formatMovementDate(movement.createdAt)}</p>
                    </div>
                    <span className="font-semibold text-slate-700">{qty}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  )
}
