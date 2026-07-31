import { api } from '@/services/api'

export interface ShiftSalesSummary {
  cashSales: number
  cardSales: number
  creditSales: number
  totalSales: number
  saleCount: number
}

export interface CurrentShift {
  id: number
  personnel: string
  role: string
  userId: number
  startTime: string
  openingCash: number
  status: 'OPEN' | 'CLOSED'
  note: string | null
  expectedCash: number
  salesSummary: ShiftSalesSummary
}

export interface ShiftListItem {
  id: number
  personnel: string
  userId: number
  username: string
  role: string
  startTime: string
  endTime: string | null
  openingCash: number
  closingCash: number | null
  expectedCash: number | null
  difference: number | null
  note: string | null
  status: 'OPEN' | 'CLOSED'
  cashSales: number
  cardSales: number
  creditSales: number
  totalSales: number
  saleCount: number
}

export async function fetchCurrentShift(): Promise<CurrentShift | null> {
  return api.get<CurrentShift | null>('/shifts/current')
}

export async function fetchShifts(params?: {
  date?: string
  status?: string
  userId?: number
}): Promise<ShiftListItem[]> {
  const query = new URLSearchParams()
  if (params?.date) query.set('date', params.date)
  if (params?.status) query.set('status', params.status)
  if (params?.userId) query.set('userId', String(params.userId))
  const qs = query.toString()
  return api.get<ShiftListItem[]>(`/shifts${qs ? `?${qs}` : ''}`)
}

export async function openShift(payload: { openingCash: number; note?: string }) {
  return api.post<CurrentShift>('/shifts/open', payload)
}

export async function closeShift(
  id: number,
  payload: { closingCash: number; note?: string },
) {
  return api.post<ShiftListItem>(`/shifts/${id}/close`, payload)
}

export function formatShiftTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function formatShiftDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

export function formatElapsed(startIso: string): string {
  const start = new Date(startIso).getTime()
  if (Number.isNaN(start)) return '—'
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000))
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours === 0) return `${rem} dk`
  return `${hours} sa ${rem} dk`
}
