import { useEffect, useState } from 'react'
import {
  Banknote,
  CreditCard,
  ShoppingBag,
  TrendingUp,
  Clock,
  CalendarDays,
  CircleDot,
  Activity,
  User,
  Wallet,
} from 'lucide-react'
import {
  StatCard,
  SectionCard,
  StatusBadge,
  LineChart,
  DonutChart,
} from '@/components/common'
import { fetchDashboard, type DashboardData } from '@/services/dashboard'
import { ProductThumb } from '@/components/products/ProductThumb'
import { ApiError } from '@/services/api'
import { useClock } from '@/hooks/useClock'
import { formatCurrency, formatNumber } from '@/utils/format'

const emptyDashboard: DashboardData = {
  todaySales: 0,
  todayOrders: 0,
  soldProducts: 0,
  cashSales: 0,
  cardSales: 0,
  creditSales: 0,
  estimatedProfit: 0,
  dailySalesTrend: 0,
  salesChart: [],
  topProducts: [],
  activeShift: null,
  criticalStock: [],
  recentActivities: [],
}

export function DashboardPage() {
  const { date } = useClock()
  const [data, setData] = useState<DashboardData>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchDashboard()
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Dashboard yüklenemedi.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const activeShift = data.activeShift
  const trendLabel =
    data.dailySalesTrend === 0
      ? undefined
      : `${data.dailySalesTrend > 0 ? '+' : ''}${data.dailySalesTrend}%`

  return (
    <div className="dashboard-theme space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Ana Sayfa</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="dash-chip flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
            <CalendarDays size={16} className="text-[#F97316]" />
            <span className="capitalize">{date}</span>
          </div>
          {activeShift ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              <CircleDot size={14} />
              Aktif Vardiya · {activeShift.personnel}
            </div>
          ) : (
            <div className="dash-chip flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium text-slate-500">
              <CircleDot size={14} />
              Açık vardiya yok
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Dashboard yükleniyor…</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Bugünkü Satış"
          value={formatCurrency(data.todaySales)}
          icon={TrendingUp}
          tone="brand"
          trend={trendLabel}
          description="Bugüne ait toplam satış."
        />
        <StatCard
          label="Nakit Satış"
          value={formatCurrency(data.cashSales)}
          icon={Banknote}
          tone="brand"
          description="Bugünkü nakit toplamı."
        />
        <StatCard
          label="Kart Satış"
          value={formatCurrency(data.cardSales)}
          icon={CreditCard}
          tone="brand"
          description="Bugünkü kart toplamı."
        />
        <StatCard
          label="Satış Adedi"
          value={formatNumber(data.soldProducts)}
          icon={ShoppingBag}
          tone="brand"
          description="Toplam satılan ürün adedi."
        />
        <StatCard
          label="Tahmini Kâr"
          value={formatCurrency(data.estimatedProfit)}
          icon={Wallet}
          tone="brand"
          description="Bugünkü tahmini kazanç."
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title="Günlük Satış Grafiği"
          description="Saatlere göre satış tutarları (₺)"
          className="xl:col-span-2"
        >
          <LineChart data={data.salesChart} height={290} />
        </SectionCard>

        <SectionCard title="En Çok Satan Ürünler" description="Bugün">
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-slate-500">Bugün henüz satış yok.</p>
          ) : (
            <ul className="space-y-3">
              {data.topProducts.map((product, index) => (
                <li key={product.id} className="dash-list-item flex items-center gap-3 rounded-xl border px-2.5 py-2">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
                    {index + 1}
                  </span>
                  <ProductThumb
                    src={product.imageUrl ?? product.imagePath}
                    fallback={product.icon}
                    size="sm"
                    className="h-9 w-9 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">{formatNumber(product.quantity)} adet</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(product.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title="Açık Vardiya"
          action={
            activeShift ? (
              <StatusBadge tone="success">Açık</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Kapalı</StatusBadge>
            )
          }
        >
          {activeShift ? (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <User size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{activeShift.personnel}</p>
                  <p className="text-xs text-slate-500">Kasiyer</p>
                </div>
              </div>
              <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Başlangıç Saati</dt>
                  <dd className="font-medium text-slate-700">{activeShift.startTime}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Açılış Kasası</dt>
                  <dd className="font-medium text-slate-700">
                    {formatCurrency(activeShift.openingCash)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Satış Toplamı</dt>
                  <dd className="font-semibold text-brand-600">
                    {formatCurrency(activeShift.totalSales)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-500">Şu anda açık vardiya bulunmuyor.</p>
          )}
        </SectionCard>

        <SectionCard title="Ödeme Dağılımı" description="Bugün">
          <div className="flex items-center justify-center py-1">
            <DonutChart
              segments={[
                { label: 'Nakit', value: data.cashSales, color: '#10B981' },
                { label: 'Kart', value: data.cardSales, color: '#2563EB' },
                { label: 'Borç', value: data.creditSales, color: '#F97316' },
              ]}
              centerLabel="Toplam"
              centerValue={formatCurrency(data.todaySales)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Kritik Stoklar" description="Raf stoğu kritik seviyede">
          {data.criticalStock.length === 0 ? (
            <p className="text-sm text-slate-500">Kritik stok yok.</p>
          ) : (
            <ul className="space-y-2.5">
              {data.criticalStock.map((product) => (
                <li
                  key={product.id}
                  className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50/50 px-3 py-2.5 shadow-card"
                >
                  <ProductThumb
                    src={product.imageUrl ?? product.imagePath}
                    fallback={product.icon}
                    size="sm"
                    className="h-9 w-9 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">Kritik seviye: {product.criticalLevel}</p>
                  </div>
                  <StatusBadge tone={product.shelfStock <= 5 ? 'danger' : 'warning'}>
                    Stok: {product.shelfStock}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Son Aktiviteler"
        description="Sistemdeki son işlemler"
        action={<Activity size={18} className="text-brand-500" />}
      >
        {data.recentActivities.length === 0 ? (
          <p className="text-sm text-slate-500">Henüz aktivite yok.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.recentActivities.map((activity) => (
              <li key={activity.id} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2 text-sm font-semibold tabular-nums text-slate-500">
                  <Clock size={14} className="text-brand-500" />
                  {activity.time}
                </div>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{activity.user}</span>
                  <span className="text-slate-500"> — {activity.description}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}
