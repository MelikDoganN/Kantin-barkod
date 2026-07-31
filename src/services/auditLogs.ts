import { api } from '@/services/api'
import type { AuditLog, AuditStatus } from '@/types'

export interface ApiAuditUser {
  id: number
  fullName: string
  username: string
  role: string
}

export interface ApiAuditItem {
  id: number
  createdAt: string
  time: string
  user: ApiAuditUser | null
  module: string
  actionType: string
  title: string
  description: string | null
  entityType: string
  entityId: number | null
  entityLabel: string | null
  status: AuditStatus
  deviceName: string | null
  ipAddress: string | null
  oldValues?: Record<string, unknown> | null
  newValues?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export interface AuditListResponse {
  items: ApiAuditItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface AuditSummary {
  totalOperations: number
  saleOperations: number
  stockOperations: number
  userOperations: number
  failedOperations: number
  modules: Array<{ module: string; count: number }>
}

export interface AuditFilters {
  users: Array<{ id: number; fullName: string; username: string; status: string }>
  modules: string[]
  actionTypes: string[]
}

function roleLabel(role: string | undefined): string {
  if (!role) return '—'
  return role === 'ADMIN' ? 'Yönetici' : 'Personel'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

function flattenValues(input: Record<string, unknown> | null | undefined): Record<string, string> | undefined {
  if (!input) return undefined
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined) {
      out[key] = '—'
    } else if (typeof value === 'object') {
      out[key] = JSON.stringify(value)
    } else {
      out[key] = String(value)
    }
  }
  return out
}

export function mapAuditItem(item: ApiAuditItem): AuditLog {
  return {
    id: String(item.id),
    createdAt: item.createdAt,
    date: formatDate(item.createdAt),
    time: item.time,
    userId: item.user ? String(item.user.id) : '',
    userName: item.user?.fullName ?? 'Sistem',
    userRole: roleLabel(item.user?.role),
    module: item.module,
    actionType: item.actionType,
    title: item.title,
    description: item.description ?? item.title,
    entityType: item.entityType,
    entityId: item.entityId != null ? String(item.entityId) : '—',
    entityLabel: item.entityLabel ?? '—',
    status: item.status,
    deviceName: item.deviceName ?? '—',
    ipAddress: item.ipAddress ?? '—',
    oldValues: flattenValues(item.oldValues),
    newValues: flattenValues(item.newValues),
    metadata: flattenValues(item.metadata ?? undefined),
  }
}

export async function fetchAuditLogs(params: {
  date: string
  userId?: string
  module?: string
  actionType?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ items: AuditLog[]; pagination: AuditListResponse['pagination'] }> {
  const query = new URLSearchParams()
  query.set('date', params.date)
  if (params.userId && params.userId !== 'all') query.set('userId', params.userId)
  if (params.module && params.module !== 'all') query.set('module', params.module)
  if (params.actionType && params.actionType !== 'all') query.set('actionType', params.actionType)
  if (params.status && params.status !== 'all') query.set('status', params.status)
  if (params.search?.trim()) query.set('search', params.search.trim())
  if (params.page) query.set('page', String(params.page))
  if (params.limit) query.set('limit', String(params.limit))

  const data = await api.get<AuditListResponse>(`/audit-logs?${query.toString()}`)
  return {
    items: data.items.map(mapAuditItem),
    pagination: data.pagination,
  }
}

export async function fetchAuditLogDetail(id: string | number): Promise<AuditLog> {
  const item = await api.get<ApiAuditItem>(`/audit-logs/${id}`)
  return mapAuditItem(item)
}

export async function fetchAuditSummary(date: string): Promise<AuditSummary> {
  return api.get<AuditSummary>(`/audit-logs/summary?date=${encodeURIComponent(date)}`)
}

export async function fetchAuditFilters(): Promise<AuditFilters> {
  return api.get<AuditFilters>('/audit-logs/filters')
}
