import { api } from '@/services/api'

export interface CashAdjustment {
  id: number
  amount: number
  description: string
  userId: number
  dayEndId: number | null
  createdAt: string
  user: { id: number; fullName: string; username: string }
  dayEnd: { id: number; createdAt: string } | null
}

export function fetchCashAdjustments(limit = 50) {
  return api.get<CashAdjustment[]>(`/cash-adjustments?limit=${limit}`)
}

export function createCashAdjustment(body: {
  amount: number
  description: string
  dayEndId?: number | null
}) {
  return api.post<CashAdjustment>('/cash-adjustments', body)
}
