import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Package,
  Warehouse,
  LayoutGrid,
  AlertTriangle,
  PackagePlus,
  PackageOpen,
  ClipboardPaste,
  Loader2,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  DataTable,
  Tabs,
} from '@/components/common'
import type { Column, TabItem } from '@/components/common'
import { Button } from '@/components/ui'
import { GoodsReceiptForm } from '@/components/inventory/GoodsReceiptForm'
import { OpenCaseForm } from '@/components/inventory/OpenCaseForm'
import { WasteForm } from '@/components/inventory/WasteForm'
import { InitialStockLoadModal } from '@/components/inventory/InitialStockLoadModal'
import { ProductThumb } from '@/components/products/ProductThumb'
import { useAuth } from '@/context/AuthContext'
import { hasPermission } from '@/config/permissions'
import { ApiError } from '@/services/api'
import {
  fetchInventory,
  fetchMovements,
  fetchWasteRecords,
  formatMovementDate,
  movementLabels,
  movementTones,
  statusTone,
  type InventoryItem,
  type InventorySummary,
  type StockMovementRow,
  type WasteRow,
} from '@/services/inventory'
import { formatNumber } from '@/utils/format'

const tabs: TabItem[] = [
  { id: 'status', label: 'Stok Durumu' },
  { id: 'receipt', label: 'Mal Kabul' },
  { id: 'unpack', label: 'Koli Açma' },
  { id: 'movements', label: 'Stok Hareketleri' },
  { id: 'waste', label: 'Fire / Zayi' },
]

const emptySummary: InventorySummary = {
  totalProducts: 0,
  warehouseStock: 0,
  shelfStock: 0,
  criticalCount: 0,
}

export function InventoryPage() {
  const { user } = useAuth()
  const canEdit = hasPermission(user?.role, 'stock.edit')
  const canOpenCarton = hasPermission(user?.role, 'stock.cartonOpen')

  const visibleTabs = useMemo(
    () => (canEdit ? tabs : tabs.filter((t) => t.id === 'status' || t.id === 'unpack')),
    [canEdit],
  )

  const [active, setActive] = useState('status')
  const [items, setItems] = useState<InventoryItem[]>([])
  const [summary, setSummary] = useState<InventorySummary>(emptySummary)
  const [movements, setMovements] = useState<StockMovementRow[]>([])
  const [wasteRecords, setWasteRecords] = useState<WasteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialLoadOpen, setInitialLoadOpen] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (canEdit) {
        const [inventory, movementList, wasteList] = await Promise.all([
          fetchInventory(),
          fetchMovements(),
          fetchWasteRecords(),
        ])
        setItems(inventory.items)
        setSummary(inventory.summary)
        setMovements(movementList)
        setWasteRecords(wasteList)
      } else {
        const inventory = await fetchInventory()
        setItems(inventory.items)
        setSummary(inventory.summary)
        setMovements([])
        setWasteRecords([])
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Stok verileri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [canEdit])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === active)) {
      setActive('status')
    }
  }, [active, visibleTabs])

  const purchaseMovements = useMemo(
    () => movements.filter((m) => m.type === 'PURCHASE'),
    [movements],
  )

  const stockColumns: Column<InventoryItem>[] = [
    {
      key: 'image',
      header: 'Görsel',
      width: '56px',
      render: (row) => (
        <ProductThumb
          src={row.product.imageUrl ?? row.product.imagePath}
          size="sm"
          className="h-11 w-11"
        />
      ),
    },
    {
      key: 'name',
      header: 'Ürün',
      render: (row) => <span className="font-medium text-slate-700">{row.product.name}</span>,
    },
    {
      key: 'barcode',
      header: 'Barkod',
      render: (row) => (
        <span className="tabular-nums text-slate-500">{row.product.barcode || '—'}</span>
      ),
    },
    {
      key: 'category',
      header: 'Kategori',
      render: (row) => <span className="text-slate-600">{row.product.category}</span>,
    },
    {
      key: 'warehouse',
      header: 'Depo Stoğu',
      align: 'center',
      render: (row) => <StatusBadge tone="neutral">{row.warehouseQuantity}</StatusBadge>,
    },
    {
      key: 'shelf',
      header: 'Raf Stoğu',
      align: 'center',
      render: (row) => (
        <StatusBadge tone={statusTone(row.status)}>{row.shelfQuantity}</StatusBadge>
      ),
    },
    {
      key: 'total',
      header: 'Toplam',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{row.totalQuantity}</span>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      align: 'center',
      render: (row) => <StatusBadge tone={statusTone(row.status)}>{row.status}</StatusBadge>,
    },
    {
      key: 'action',
      header: 'İşlem',
      align: 'right',
      render: (row) =>
        canOpenCarton ? (
          <Button
            variant="outline"
            size="sm"
            icon={<PackageOpen size={14} />}
            disabled={
              row.unitsPerCarton === 0 || row.warehouseQuantity < row.unitsPerCarton
            }
            onClick={() => setActive('unpack')}
          >
            Koli Aç
          </Button>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ]

  const receiptColumns: Column<StockMovementRow>[] = [
    {
      key: 'product',
      header: 'Ürün',
      render: (row) => row.product,
    },
    {
      key: 'quantity',
      header: 'Miktar',
      align: 'right',
      render: (row) => `${row.quantity} adet`,
    },
    {
      key: 'warehouse',
      header: 'Depo',
      align: 'right',
      render: (row) => `${row.beforeWarehouse} → ${row.afterWarehouse}`,
    },
    {
      key: 'user',
      header: 'Kullanıcı',
      render: (row) => row.user,
    },
    {
      key: 'date',
      header: 'Tarih',
      align: 'right',
      render: (row) => formatMovementDate(row.createdAt),
    },
  ]

  const movementColumns: Column<StockMovementRow>[] = [
    {
      key: 'date',
      header: 'Tarih',
      render: (row) => (
        <span className="tabular-nums text-slate-500">{formatMovementDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'image',
      header: 'Görsel',
      width: '56px',
      render: (row) => (
        <ProductThumb
          src={row.productImageUrl ?? row.productImagePath}
          size="sm"
          className="h-11 w-11"
        />
      ),
    },
    {
      key: 'product',
      header: 'Ürün',
      render: (row) => <span className="font-medium text-slate-700">{row.product}</span>,
    },
    {
      key: 'action',
      header: 'İşlem',
      align: 'center',
      render: (row) => (
        <StatusBadge tone={movementTones[row.type] ?? 'neutral'}>
          {movementLabels[row.type] ?? row.type}
        </StatusBadge>
      ),
    },
    {
      key: 'quantity',
      header: 'Miktar',
      align: 'center',
      render: (row) => {
        const signed =
          row.type === 'PURCHASE' || row.type === 'RETURN'
            ? `+${row.quantity}`
            : row.type === 'CARTON_OPEN' || row.type === 'INITIAL_STOCK' || row.type === 'ADJUSTMENT' || row.type === 'COUNT_ADJUSTMENT'
              ? `${row.quantity}`
              : `-${row.quantity}`
        return (
          <span
            className={
              signed.startsWith('-')
                ? 'font-semibold text-red-600'
                : 'font-semibold text-emerald-600'
            }
          >
            {signed}
          </span>
        )
      },
    },
    {
      key: 'beforeWh',
      header: 'Önce Depo',
      align: 'right',
      render: (row) => row.beforeWarehouse,
    },
    {
      key: 'afterWh',
      header: 'Sonra Depo',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{row.afterWarehouse}</span>
      ),
    },
    {
      key: 'beforeSh',
      header: 'Önce Raf',
      align: 'right',
      render: (row) => row.beforeShelf,
    },
    {
      key: 'afterSh',
      header: 'Sonra Raf',
      align: 'right',
      render: (row) => <span className="font-semibold text-slate-700">{row.afterShelf}</span>,
    },
    {
      key: 'user',
      header: 'Kullanıcı',
      render: (row) => <span className="text-slate-600">{row.user}</span>,
    },
  ]

  const wasteColumns: Column<WasteRow>[] = [
    { key: 'product', header: 'Ürün', render: (row) => row.product },
    {
      key: 'quantity',
      header: 'Miktar',
      align: 'right',
      render: (row) => `${row.quantity} adet`,
    },
    { key: 'reason', header: 'Sebep', render: (row) => row.reason },
    {
      key: 'date',
      header: 'Tarih',
      align: 'right',
      render: (row) => formatMovementDate(row.createdAt),
    },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stok Yönetimi"
        actions={
          canOpenCarton ? (
            <>
              {canEdit && (
                <>
                  <Button
                    variant="outline"
                    icon={<ClipboardPaste size={18} />}
                    onClick={() => setInitialLoadOpen(true)}
                  >
                    İlk Stok Girişi
                  </Button>
                  <Button
                    variant="outline"
                    icon={<PackagePlus size={18} />}
                    onClick={() => setActive('receipt')}
                  >
                    Mal Kabul
                  </Button>
                </>
              )}
              <Button icon={<PackageOpen size={18} />} onClick={() => setActive('unpack')}>
                Koli Aç
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Toplam Ürün"
          value={formatNumber(summary.totalProducts)}
          icon={Package}
          tone="brand"
          description="Kayıtlı ürün çeşidi"
        />
        <StatCard
          label="Depo Stoğu"
          value={`${formatNumber(summary.warehouseStock)} adet`}
          icon={Warehouse}
          tone="brand"
          description="Toplam depo adedi"
        />
        <StatCard
          label="Raf Stoğu"
          value={`${formatNumber(summary.shelfStock)} adet`}
          icon={LayoutGrid}
          tone="emerald"
          description="Toplam raf adedi"
        />
        <StatCard
          label="Kritik Stok"
          value={`${formatNumber(summary.criticalCount)} ürün`}
          icon={AlertTriangle}
          tone="danger"
          description="Kritik seviyede ürün"
        />
      </div>

      <Tabs tabs={visibleTabs} active={active} onChange={setActive} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 size={20} className="animate-spin text-brand-600" />
          <span className="text-sm">Stok verileri yükleniyor...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" onClick={() => void loadAll()}>
            Tekrar Dene
          </Button>
        </div>
      ) : (
        <>
          {active === 'status' && (
            <SectionCard
              title="Stok Durumu"
              description="Depo ve raf stoklarının güncel durumu"
              noPadding
            >
              <DataTable
                columns={stockColumns}
                data={items}
                rowKey={(row) => String(row.productId)}
              />
            </SectionCard>
          )}

          {active === 'receipt' && canEdit && (
            <div className="space-y-5">
              <SectionCard title="Mal Kabul" description="Tedarikçiden gelen ürünleri depoya girin">
                <GoodsReceiptForm products={items} onSuccess={loadAll} />
              </SectionCard>
              <SectionCard title="Son Mal Kabulleri" noPadding>
                <DataTable
                  columns={receiptColumns}
                  data={purchaseMovements}
                  rowKey={(row) => String(row.id)}
                  emptyTitle="Mal kabul kaydı yok"
                  emptyDescription="Henüz mal kabul işlemi yapılmamış."
                />
              </SectionCard>
            </div>
          )}

          {active === 'unpack' && (
            <SectionCard title="Koli Açma" description="Depodaki koliyi rafa aktarın">
              {canOpenCarton ? (
                <OpenCaseForm products={items} onSuccess={loadAll} />
              ) : (
                <p className="text-sm text-slate-500">Koli açma için yetkiniz yok.</p>
              )}
            </SectionCard>
          )}

          {active === 'movements' && canEdit && (
            <SectionCard
              title="Stok Hareketleri"
              description="Tüm giriş, çıkış ve transfer kayıtları"
              noPadding
            >
              <DataTable
                columns={movementColumns}
                data={movements}
                rowKey={(row) => String(row.id)}
                emptyTitle="Hareket kaydı yok"
                emptyDescription="Henüz stok hareketi bulunmuyor."
              />
            </SectionCard>
          )}

          {active === 'waste' && canEdit && (
            <div className="space-y-5">
              <SectionCard
                title="Yeni Fire Kaydı"
                description="Bozuk, kayıp veya süresi geçen ürünleri kaydedin"
              >
                <WasteForm products={items} onSuccess={loadAll} />
              </SectionCard>
              <SectionCard title="Fire / Zayi Kayıtları" noPadding>
                <DataTable
                  columns={wasteColumns}
                  data={wasteRecords}
                  rowKey={(row) => String(row.id)}
                  emptyTitle="Fire kaydı yok"
                  emptyDescription="Henüz fire kaydı oluşturulmamış."
                />
              </SectionCard>
            </div>
          )}
        </>
      )}

      {canEdit && (
        <InitialStockLoadModal
          open={initialLoadOpen}
          products={items}
          onClose={() => setInitialLoadOpen(false)}
          onSuccess={loadAll}
        />
      )}
    </div>
  )
}
