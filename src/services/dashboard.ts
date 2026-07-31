import { api } from '@/services/api'
import type { RecentActivity, SalesPoint, TopProduct } from '@/types'

export interface DashboardActiveShift {
  id: number
  personnel: string
  startTime: string
  openingCash: number
  cashSales: number
  cardSales: number
  creditSales: number
  totalSales: number
}

export interface DashboardCriticalStock {
  id: number
  name: string
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
  shelfStock: number
  criticalLevel: number
}

export interface DashboardData {
  todaySales: number
  todayOrders: number
  soldProducts: number
  cashSales: number
  cardSales: number
  creditSales: number
  estimatedProfit: number
  dailySalesTrend: number
  salesChart: SalesPoint[]
  topProducts: TopProduct[]
  activeShift: DashboardActiveShift | null
  criticalStock: DashboardCriticalStock[]
  recentActivities: RecentActivity[]
}

export function fetchDashboard(): Promise<DashboardData> {
  return api.get<DashboardData>('/dashboard')
}
