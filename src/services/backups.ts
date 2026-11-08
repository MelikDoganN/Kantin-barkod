import { api, downloadAuthenticated } from '@/services/api'

export interface BackupItem {
  id: string
  fileName: string
  fileSize: number | null
  status: 'SUCCESS' | 'FAILED' | string
  errorMessage: string | null
  createdBy: {
    id: number
    fullName: string
    username: string
  } | null
  createdAt: string
}

export interface BackupListResponse {
  items: BackupItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function fetchBackups(params?: {
  page?: number
  limit?: number
  status?: string
}) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  return api.get<BackupListResponse>(`/backups${qs ? `?${qs}` : ''}`)
}

export async function createBackup() {
  return api.post<{ backup: { id: string; fileName: string; fileSize: number; createdAt: string } }>(
    '/backups',
  )
}

export function downloadBackup(id: string, fileName: string) {
  return downloadAuthenticated(`/backups/${id}/download`, fileName)
}

export function restoreBackup(id: string) {
  return api.post<{
    restoredBackup: { id: string; fileName: string }
    safetyBackup: { id: string; fileName: string; fileSize: number }
  }>(`/backups/${id}/restore`)
}

export function deleteBackup(id: string) {
  return api.delete<{ id: string }>(`/backups/${id}`)
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
