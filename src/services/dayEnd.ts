import { api } from '@/services/api'
import type { DayEndRecord, DayEndStatus, SaleLineItem, SalePayment, SaleRecord } from '@/types'

export interface ApiDayEndListItem {
  id: number
  date: string
  createdAt: string
  personnel: string
  userId: number
  username: string
  role: string
  shiftId: number
  shift: string
  openingCash: number
  closingCash: number | null
  expectedCash: number | null
  saleCount: number
  totalSales: number
  cashSales: number
  cardSales: number
  debtSales: number
  cashDifference: number
  status: DayEndStatus
  statusRaw: string
}

export interface ApiDayEndDetail extends ApiDayEndListItem {
  sales: Array<{
    id: number
    saleNo: string
    time: string
    createdAt: string
    payment: SalePayment
    paymentType: string
    itemCount: number
    total: number
    status?: string
    cancelledAt?: string | null
    cancelReason?: string | null
    cancelledByName?: string | null
  }>
}

export interface ApiSaleDetail {
  id: number
  saleNo: string
  time: string
  createdAt: string
  payment: SalePayment
  paymentType: string
  total: number
  subtotal: number
  discount: number
  personnel: string
  personnelRole: string
  itemCount: number
  status?: string
  cancelledAt?: string | null
  cancelReason?: string | null
  cancelledByName?: string | null
  dayEndTaken?: boolean
  payments: Array<{ id: number; type: string; amount: number; createdAt: string }>
  items: Array<{
    productId: number
    productName: string
    imagePath: string | null
    imageUrl: string | null
    barcode: string | null
    quantity: number
    unitPrice: number
    total: number
  }>
}

export interface EligibleShift {
  id: number
  personnel: string
  role: string
  startTime: string
  endTime: string | null
  openingCash: number
  closingCash: number | null
  expectedCash: number | null
  difference: number | null
}

function toPersonnelRole(role: string): DayEndRecord['role'] {
  return role === 'ADMIN' ? 'admin' : 'cashier'
}

export function mapListItem(item: ApiDayEndListItem): DayEndRecord {
  return {
    id: String(item.id),
    date: item.date,
    personnel: item.personnel,
    role: toPersonnelRole(item.role),
    shift: item.shift,
    openingCash: item.openingCash,
    saleCount: item.saleCount,
    totalSales: item.totalSales,
    cashSales: item.cashSales,
    cardSales: item.cardSales,
    debtSales: item.debtSales,
    cashDifference: item.cashDifference,
    status: item.status,
    sales: [],
  }
}

export function mapDetail(detail: ApiDayEndDetail): DayEndRecord {
  return {
    ...mapListItem(detail),
    sales: detail.sales.map(
      (sale): SaleRecord => ({
        id: String(sale.id),
        saleNo: sale.saleNo,
        time: sale.time,
        payment: sale.payment,
        itemCount: sale.itemCount,
        total: sale.total,
        items: [],
        status: (sale.status as SaleRecord['status']) ?? 'COMPLETED',
        cancelledAt: sale.cancelledAt,
        cancelReason: sale.cancelReason,
        cancelledByName: sale.cancelledByName,
      }),
    ),
  }
}

export function mapSaleDetail(sale: ApiSaleDetail): SaleRecord {
  return {
    id: String(sale.id),
    saleNo: sale.saleNo,
    time: sale.time,
    payment: sale.payment,
    itemCount: sale.itemCount,
    total: sale.total,
    status: (sale.status as SaleRecord['status']) ?? 'COMPLETED',
    cancelledAt: sale.cancelledAt,
    cancelReason: sale.cancelReason,
    cancelledByName: sale.cancelledByName,
    dayEndTaken: sale.dayEndTaken,
    personnel: sale.personnel,
    items: sale.items.map(
      (item): SaleLineItem => ({
        productName: item.productName,
        icon: '📦',
        imagePath: item.imagePath,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }),
    ),
  }
}

export async function fetchDayEnds(params?: {
  date?: string
  userId?: number
  status?: string
}): Promise<DayEndRecord[]> {
  const query = new URLSearchParams()
  if (params?.date) query.set('date', params.date)
  if (params?.userId) query.set('userId', String(params.userId))
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  const list = await api.get<ApiDayEndListItem[]>(`/day-end${qs ? `?${qs}` : ''}`)
  return list.map(mapListItem)
}

export async function fetchDayEndDetail(id: number): Promise<DayEndRecord> {
  const detail = await api.get<ApiDayEndDetail>(`/day-end/${id}`)
  return mapDetail(detail)
}

export async function fetchDayEndSale(dayEndId: number, saleId: number): Promise<SaleRecord & { personnel: string }> {
  const sale = await api.get<ApiSaleDetail>(`/day-end/${dayEndId}/sales/${saleId}`)
  return { ...mapSaleDetail(sale), personnel: sale.personnel }
}

export async function createDayEnd(payload: { shiftId: number; actualCash: number }) {
  const item = await api.post<ApiDayEndListItem>('/day-end', payload)
  return mapListItem(item)
}

export async function fetchEligibleShifts(): Promise<EligibleShift[]> {
  return api.get<EligibleShift[]>('/day-end/eligible-shifts')
}

export function toApiStatus(filter: string): string | undefined {
  if (filter === 'pending') return 'PENDING'
  if (filter === 'completed') return 'COMPLETED'
  if (filter === 'reviewed') return 'REVIEWED'
  return undefined
}
