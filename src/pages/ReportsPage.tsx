import { useCallback, useEffect, useState } from 'react'
import {
  TrendingUp,
  ShoppingBag,
  Package,
  Wallet,
  Receipt,
  FileDown,
  FileSpreadsheet,
  AlertTriangle,
  Boxes,
  Trash2,
  Utensils,
  Crown,
} from 'lucide-react'
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  BarChart,
  DonutChart,
  DataTable,
  Tabs,
} from '@/components/common'
import type { Column, TabItem } from '@/components/common'
import { Button, Input } from '@/components/ui'
import {
  fetchReportBundle,
  type ReportProduct,
  type ReportPeriod,
  type PersonnelPerformance,
  type ReportSummaryView,
  type StockReportView,
  type DayEndReportView,
  type ConsumptionReportView,
} from '@/services/reports'
import { ApiError } from '@/services/api'
import { ProductThumb } from '@/components/products/ProductThumb'
import { formatCurrency, formatNumber } from '@/utils/format'

const ranges: TabItem[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: 'Bu Hafta' },
  { id: 'month', label: 'Bu Ay' },
  { id: 'custom', label: 'Özel Tarih' },
]

const emptySummary: ReportSummaryView = {
  totalSales: 0,
  orderCount: 0,
  itemsSold: 0,
  estimatedProfit: 0,
  avgBasket: 0,
  trend: [],
  payments: { cash: 0, card: 0, debt: 0 },
  topProducts: [],
}

export function ReportsPage() {
  const [range, setRange] = useState<ReportPeriod>('week')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 6)
    return d.toISOString().slice(0, 10)
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10))

  const [data, setData] = useState<ReportSummaryView>(emptySummary)
  const [personnelPerformance, setPersonnelPerformance] = useState<PersonnelPerformance[]>([])
  const [stockReport, setStockReport] = useState<StockReportView>({
    critical: 0,
    total: 0,
    waste: 0,
  })
  const [dayEndReport, setDayEndReport] = useState<DayEndReportView | null>(null)
  const [consumptionReport, setConsumptionReport] = useState<ConsumptionReportView>({
    topPersonnel: '—',
    topPersonnelItems: 0,
    topProduct: '—',
    topProductItems: 0,
    totalQuantity: 0,
    totalCost: 0,
    monthCost: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const bundle = await fetchReportBundle(
        range,
        range === 'custom' ? startDate : undefined,
        range === 'custom' ? endDate : undefined,
      )
      setData(bundle.summary)
      setPersonnelPerformance(bundle.personnel)
      setStockReport(bundle.stock)
      setDayEndReport(bundle.dayEnd)
      setConsumptionReport(bundle.consumption)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Raporlar yüklenemedi.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [range, startDate, endDate])

  useEffect(() => {
    void load()
  }, [load])

  const totalPayments = data.payments.cash + data.payments.card + data.payments.debt

  const topProductColumns: Column<ReportProduct>[] = [
    {
      key: 'rank',
      header: 'Sıra',
      width: '48px',
      render: (_row) => null,
    },
    {
      key: 'name',
      header: 'Ürün',
      render: (row) => (
        <div className="flex items-center gap-2">
          <ProductThumb
            src={row.imageUrl ?? row.imagePath}
            fallback={row.icon}
            size="sm"
            className="h-8 w-8 flex-shrink-0"
          />
          <span className="font-medium text-slate-700">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Satış Adedi',
      align: 'right',
      render: (row) => `${formatNumber(row.quantity)} adet`,
    },
    {
      key: 'revenue',
      header: 'Ciro',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{formatCurrency(row.revenue)}</span>
      ),
    },
    {
      key: 'profit',
      header: 'Kâr',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-emerald-600">{formatCurrency(row.profit)}</span>
      ),
    },
  ]

  const rankedColumns: Column<ReportProduct>[] = topProductColumns.map((col) =>
    col.key === 'rank'
      ? {
          ...col,
          render: (row) => {
            const index = data.topProducts.findIndex((p) => p.id === row.id)
            return (
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
                {index + 1}
              </span>
            )
          },
        }
      : col,
  )

  const personnelColumns: Column<PersonnelPerformance>[] = [
    {
      key: 'name',
      header: 'Personel',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
            {row.name.charAt(0)}
          </span>
          <span className="font-medium text-slate-700">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'count',
      header: 'Satış Sayısı',
      align: 'right',
      render: (row) => `${formatNumber(row.saleCount)} satış`,
    },
    {
      key: 'total',
      header: 'Toplam Satış',
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-700">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'avg',
      header: 'Ortalama Sepet',
      align: 'right',
      render: (row) => formatCurrency(row.averageBasket),
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
  ]

  const dayEndStatusTone =
    dayEndReport?.status === 'completed' || dayEndReport?.status === 'reviewed'
      ? 'success'
      : 'warning'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Raporlar"
        actions={
          <>
            <Button variant="outline" icon={<FileDown size={18} />}>
              PDF İndir
            </Button>
            <Button variant="outline" icon={<FileSpreadsheet size={18} />}>
              Excel İndir
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={ranges} active={range} onChange={(id) => setRange(id as ReportPeriod)} />
        {range === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="text-slate-400">—</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-500">Raporlar yükleniyor…</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Toplam Satış" value={formatCurrency(data.totalSales)} icon={TrendingUp} tone="brand" description="Dönem cirosu" />
        <StatCard label="Toplam Sipariş" value={formatNumber(data.orderCount)} icon={ShoppingBag} tone="brand" description="Satış adedi" />
        <StatCard label="Satılan Ürün" value={`${formatNumber(data.itemsSold)} adet`} icon={Package} tone="amber" description="Toplam ürün" />
        <StatCard label="Tahmini Kâr" value={formatCurrency(data.estimatedProfit)} icon={Wallet} tone="emerald" description="Net kazanç" />
        <StatCard label="Ortalama Sepet" value={formatCurrency(data.avgBasket)} icon={Receipt} tone="brand" description="Sipariş başına" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Satış Trendi" description="Döneme göre satış dağılımı" className="xl:col-span-2">
          <BarChart data={data.trend} height={240} />
        </SectionCard>

        <SectionCard title="Ödeme Türleri" description="Satış dağılımı">
          <div className="flex items-center justify-center py-2">
            <DonutChart
              segments={[
                { label: 'Nakit', value: data.payments.cash, color: '#10B981' },
                { label: 'Kart', value: data.payments.card, color: '#2563EB' },
                { label: 'Borç', value: data.payments.debt, color: '#F97316' },
              ]}
              centerLabel="Toplam"
              centerValue={formatCurrency(totalPayments)}
            />
          </div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="En Çok Satan Ürünler" description="Adet, ciro ve kâr" className="xl:col-span-2" noPadding>
          <DataTable columns={rankedColumns} data={data.topProducts} rowKey={(row) => row.id} emptyTitle="Bu dönemde satış yok" />
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="Stok Durumu">
            <div className="space-y-2.5">
              <ReportStat icon={<AlertTriangle size={16} />} tone="amber" label="Kritik Ürün" value={`${stockReport.critical} ürün`} />
              <ReportStat icon={<Boxes size={16} />} tone="brand" label="Toplam Ürün" value={`${formatNumber(stockReport.total)} ürün`} />
              <ReportStat icon={<Trash2 size={16} />} tone="danger" label="Fire" value={`${stockReport.waste} adet`} />
            </div>
          </SectionCard>

          <SectionCard
            title="Son Gün Sonu"
            action={
              dayEndReport ? (
                <StatusBadge tone={dayEndStatusTone}>
                  {dayEndReport.status === 'completed'
                    ? 'Tamamlandı'
                    : dayEndReport.status === 'reviewed'
                      ? 'İncelendi'
                      : 'Bekliyor'}
                </StatusBadge>
              ) : undefined
            }
          >
            {dayEndReport ? (
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Tarih</dt>
                  <dd className="font-medium text-slate-700">{dayEndReport.date}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Personel</dt>
                  <dd className="font-medium text-slate-700">{dayEndReport.personnel}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Satış</dt>
                  <dd className="font-semibold text-brand-600">{formatCurrency(dayEndReport.sales)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Kasa Farkı</dt>
                  <dd className="font-medium text-emerald-600">{formatCurrency(dayEndReport.cashDiff)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Henüz gün sonu kaydı yok.</p>
            )}
          </SectionCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard title="Personel Performansı" description="Dönemsel satış performansı" className="xl:col-span-2" noPadding>
          <DataTable
            columns={personnelColumns}
            data={personnelPerformance}
            rowKey={(row) => row.id}
            emptyTitle="Bu dönemde personel satışı yok"
          />
        </SectionCard>

        <SectionCard title="Personel Tüketim Raporu" description="Ciroya dahil değildir">
          <div className="space-y-2.5">
            <ReportStat
              icon={<Crown size={16} />}
              tone="amber"
              label="En Çok Tüketen"
              value={`${consumptionReport.topPersonnel} · ${consumptionReport.topPersonnelItems}`}
            />
            <ReportStat
              icon={<Utensils size={16} />}
              tone="brand"
              label="En Çok Tüketilen"
              value={`${consumptionReport.topProduct} · ${consumptionReport.topProductItems}`}
            />
            <ReportStat
              icon={<Package size={16} />}
              tone="brand"
              label="Toplam Adet"
              value={`${formatNumber(consumptionReport.totalQuantity)} adet`}
            />
            <ReportStat
              icon={<Wallet size={16} />}
              tone="danger"
              label="Toplam Maliyet"
              value={formatCurrency(consumptionReport.totalCost)}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

interface ReportStatProps {
  icon: React.ReactNode
  tone: 'amber' | 'brand' | 'danger'
  label: string
  value: string
}

const reportStatStyles: Record<ReportStatProps['tone'], string> = {
  amber: 'bg-amber-50 text-amber-600',
  brand: 'bg-brand-50 text-brand-600',
  danger: 'bg-red-50 text-red-600',
}

function ReportStat({ icon, tone, label, value }: ReportStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${reportStatStyles[tone]}`}>
        {icon}
      </span>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
    </div>
  )
}
