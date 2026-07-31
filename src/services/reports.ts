import { api } from '@/services/api'
import { resolveImageUrl } from '@/utils/resolveImageUrl'
import type { SalesPoint } from '@/types'

export type ReportPeriod = 'today' | 'week' | 'month' | 'custom'

export interface ReportProduct {
  id: string
  name: string
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
  quantity: number
  revenue: number
  profit: number
}

export interface PersonnelPerformance {
  id: string
  name: string
  saleCount: number
  total: number
  averageBasket: number
  shiftCount: number
  status: 'active' | 'passive'
}

export interface ReportSummaryView {
  totalSales: number
  orderCount: number
  itemsSold: number
  estimatedProfit: number
  avgBasket: number
  trend: SalesPoint[]
  payments: { cash: number; card: number; debt: number }
  topProducts: ReportProduct[]
}

export interface StockReportView {
  critical: number
  total: number
  waste: number
  low?: number
  totalWarehouse?: number
  totalShelf?: number
}

export interface DayEndReportView {
  date: string
  personnel: string
  sales: number
  cashDiff: number
  status: string
}

export interface ConsumptionReportView {
  topPersonnel: string
  topPersonnelItems: number
  topProduct: string
  topProductItems: number
  totalQuantity: number
  totalCost: number
  monthCost: number
}

function toQuery(startDate: string, endDate: string): string {
  const params = new URLSearchParams({ startDate, endDate })
  return `?${params.toString()}`
}

function formatTrendLabel(dateStr: string, period: ReportPeriod): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (period === 'today') {
    return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
  }
  if (period === 'week' || period === 'custom') {
    return date.toLocaleDateString('tr-TR', { weekday: 'short' })
  }
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

/** Yerel takvim gününe göre YYYY-MM-DD aralığı üretir (bitiş dahil). */
export function resolveReportDates(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): { startDate: string; endDate: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (period === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd }
  }

  if (period === 'today') {
    const iso = toIso(today)
    return { startDate: iso, endDate: iso }
  }

  if (period === 'week') {
    const day = today.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(today)
    start.setDate(today.getDate() + mondayOffset)
    return { startDate: toIso(start), endDate: toIso(today) }
  }

  // month
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { startDate: toIso(start), endDate: toIso(today) }
}

export async function fetchReportBundle(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
): Promise<{
  summary: ReportSummaryView
  personnel: PersonnelPerformance[]
  stock: StockReportView
  dayEnd: DayEndReportView | null
  consumption: ConsumptionReportView
}> {
  const { startDate, endDate } = resolveReportDates(period, customStart, customEnd)
  const q = toQuery(startDate, endDate)

  const [summary, trend, payments, topProducts, stock, personnel, dayEnds, consumption] =
    await Promise.all([
      api.get<{
        totalSales: number
        totalOrders: number
        soldProducts: number
        estimatedProfit: number
        averageBasket: number
        cashAmount: number
        cardAmount: number
        creditAmount: number
      }>(`/reports/summary${q}`),
      api.get<Array<{ date: string; total: number }>>(`/reports/sales-trend${q}`),
      api.get<Array<{ type: string; amount: number; percent: number }>>(
        `/reports/payment-summary${q}`,
      ),
      api.get<
        Array<{
          productId: number
          product: string
          image: string | null
          imagePath?: string | null
          imageUrl?: string | null
          quantity: number
          revenue: number
          estimatedProfit: number
        }>
      >(`/reports/top-products${q}`),
      api.get<{
        totalProducts: number
        criticalProducts: number
        lowProducts: number
        totalWarehouse: number
        totalShelf: number
        wasteCount: number
      }>('/reports/stock'),
      api.get<
        Array<{
          userId: number
          personnel: string
          saleCount: number
          totalSales: number
          averageBasket: number
          shiftCount: number
          status: string
        }>
      >(`/reports/personnel${q}`),
      api.get<
        Array<{
          id: number
          date: string
          personnel: string
          sales: number
          cashDifference: number
          status: string
        }>
      >('/reports/day-end'),
      api.get<{
        topPersonnel: string
        topPersonnelItems: number
        topProduct: string
        topProductItems: number
        totalQuantity: number
        totalCost: number
        monthCost: number
      }>(`/reports/consumption${q}`),
    ])

  const payMap = { cash: 0, card: 0, debt: 0 }
  for (const p of payments) {
    if (p.type === 'CASH') payMap.cash = p.amount
    else if (p.type === 'CARD') payMap.card = p.amount
    else if (p.type === 'CREDIT') payMap.debt = p.amount
  }

  const latestDayEnd = dayEnds[0]
    ? {
        date: dayEnds[0].date,
        personnel: dayEnds[0].personnel,
        sales: dayEnds[0].sales,
        cashDiff: dayEnds[0].cashDifference,
        status: dayEnds[0].status,
      }
    : null

  return {
    summary: {
      totalSales: summary.totalSales,
      orderCount: summary.totalOrders,
      itemsSold: summary.soldProducts,
      estimatedProfit: summary.estimatedProfit,
      avgBasket: summary.averageBasket,
      trend: trend.map((t) => ({
        label: formatTrendLabel(t.date, period),
        amount: t.total,
      })),
      payments: payMap,
      topProducts: topProducts.map((p) => ({
        id: String(p.productId),
        name: p.product,
        icon: '📦',
        imagePath: p.imagePath ?? p.image ?? null,
        imageUrl: resolveImageUrl(p.imageUrl ?? p.imagePath ?? p.image ?? null),
        quantity: p.quantity,
        revenue: p.revenue,
        profit: p.estimatedProfit,
      })),
    },
    personnel: personnel.map((p) => ({
      id: String(p.userId),
      name: p.personnel,
      saleCount: p.saleCount,
      total: p.totalSales,
      averageBasket: p.averageBasket,
      shiftCount: p.shiftCount,
      status: p.status === 'active' ? 'active' : 'passive',
    })),
    stock: {
      critical: stock.criticalProducts,
      total: stock.totalProducts,
      waste: stock.wasteCount,
      low: stock.lowProducts,
      totalWarehouse: stock.totalWarehouse,
      totalShelf: stock.totalShelf,
    },
    dayEnd: latestDayEnd,
    consumption: {
      topPersonnel: consumption.topPersonnel,
      topPersonnelItems: consumption.topPersonnelItems,
      topProduct: consumption.topProduct,
      topProductItems: consumption.topProductItems,
      totalQuantity: consumption.totalQuantity ?? 0,
      totalCost: consumption.totalCost ?? consumption.monthCost,
      monthCost: consumption.monthCost ?? consumption.totalCost ?? 0,
    },
  }
}
