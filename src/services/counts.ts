import { api } from '@/services/api'
import type { CountHistoryEntry, CountSummary, CountType } from '@/types'

export type ItemDiffStatus = 'SAME' | 'SHORTAGE' | 'EXCESS' | null

export interface ApiCountProduct {
  id: number
  name: string
  barcode: string | null
  imagePath: string | null
  imageUrl: string | null
  category: string
}

export interface ApiCountItem {
  id: number
  productId: number
  product: ApiCountProduct
  systemQuantity: number
  countedQuantity: number | null
  difference: number | null
  result: 'Eksik' | 'Fazla' | 'Aynı' | null
  note: string | null
  status: ItemDiffStatus
}

export interface ApiCountSummary {
  totalProducts: number
  missingProducts: number
  excessProducts: number
  unchangedProducts: number
  totalMissingQuantity: number
  totalExcessQuantity: number
}

export interface ApiCountDetail {
  id: number
  type: string
  status: string
  date: string
  description: string | null
  startedAt: string
  completedAt: string | null
  createdBy?: {
    id: number
    fullName: string
    username: string
  }
  user: string
  userId: number
  productCount: number
  totalDifference: number
  shortageCount: number
  excessCount: number
  sameCount: number
  pendingCount: number
  summary: ApiCountSummary
  items: ApiCountItem[]
}

export interface ApiCountListItem {
  id: number
  type: string
  status: string
  date: string
  user: string
  description: string | null
  productCount: number
  totalDifference: number
}

function mapType(type: string): CountType {
  return type.toUpperCase() === 'WAREHOUSE' ? 'warehouse' : 'shelf'
}

function mapHistoryStatus(status: string): CountHistoryEntry['status'] {
  return status.toUpperCase() === 'COMPLETED' ? 'completed' : 'inprogress'
}

export function mapCountHistory(row: ApiCountListItem): CountHistoryEntry {
  return {
    id: String(row.id),
    date: new Date(row.date).toLocaleDateString('tr-TR'),
    type: mapType(row.type),
    user: row.user,
    productCount: row.productCount,
    difference: row.totalDifference,
    status: mapHistoryStatus(row.status),
  }
}

export async function fetchCountSummary(): Promise<CountSummary> {
  return api.get<CountSummary>('/counts/summary')
}

export async function fetchCountHistory(): Promise<CountHistoryEntry[]> {
  const rows = await api.get<ApiCountListItem[]>('/counts/history')
  return rows.map(mapCountHistory)
}

export async function fetchActiveCount(): Promise<ApiCountDetail | null> {
  return api.get<ApiCountDetail | null>('/counts/active')
}

export async function fetchCountById(id: number | string): Promise<ApiCountDetail> {
  return api.get<ApiCountDetail>(`/counts/${id}`)
}

export async function startCount(input: {
  type: 'WAREHOUSE' | 'SHELF'
  description?: string
}): Promise<ApiCountDetail> {
  return api.post<ApiCountDetail>('/counts', input)
}

export async function updateCountItem(
  countId: number,
  itemId: number,
  body: { countedQuantity: number; note?: string },
): Promise<ApiCountItem> {
  return api.patch<ApiCountItem>(`/counts/${countId}/items/${itemId}`, body)
}

export async function completeCount(countId: number): Promise<ApiCountDetail> {
  return api.post<ApiCountDetail>(`/counts/${countId}/complete`)
}
