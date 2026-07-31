import { api } from '@/services/api'
import type { Personnel, PersonnelRole } from '@/types'

export const roleLabels: Record<PersonnelRole, string> = {
  admin: 'Yönetici',
  manager: 'Yönetici',
  cashier: 'Personel',
}

export interface ApiUserListItem {
  id: number
  fullName: string
  username: string
  phone: string | null
  role: 'ADMIN' | 'PERSONNEL'
  status: 'ACTIVE' | 'PASSIVE'
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
  activeShift: { id: number; startTime: string; status: string } | null
}

export interface ApiUserDetail extends ApiUserListItem {
  totalSales: number
  totalRevenue: number
  totalShifts: number
  activeShift: {
    id: number
    startTime: string
    openingCash?: number
    status: string
  } | null
  recentConsumptions: Array<{
    id: number
    product: string
    quantity: number
    cost: number
    reason: string
    createdAt: string
  }>
  recentDayEnds: Array<{
    id: number
    totalSales: number
    cashDifference: number
    status: string
    createdAt: string
  }>
}

function mapRole(role: string): PersonnelRole {
  return role === 'ADMIN' ? 'admin' : 'cashier'
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return 'Henüz giriş yok'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Bugün ${time}`
  return `${d.toLocaleDateString('tr-TR')} ${time}`
}

export function mapUserToPersonnel(user: ApiUserListItem | ApiUserDetail): Personnel {
  const detail = user as ApiUserDetail
  return {
    id: String(user.id),
    name: user.fullName,
    username: user.username,
    role: mapRole(user.role),
    status: user.status === 'ACTIVE' ? 'active' : 'passive',
    phone: user.phone ?? '—',
    createdAt: formatDisplayDate(user.createdAt),
    lastLogin: formatLastLogin(user.lastLoginAt),
    totalSales: detail.totalSales ?? 0,
    totalShifts: detail.totalShifts ?? 0,
    totalRevenue: detail.totalRevenue ?? 0,
    activeShiftLabel: user.activeShift
      ? new Date(user.activeShift.startTime).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : null,
  }
}

export async function fetchUsers(params?: {
  search?: string
  role?: string
  status?: string
}): Promise<Personnel[]> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.role) query.set('role', params.role)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  const rows = await api.get<ApiUserListItem[]>(`/users${qs ? `?${qs}` : ''}`)
  return rows.map(mapUserToPersonnel)
}

export async function fetchUserDetail(id: string | number): Promise<Personnel & { raw: ApiUserDetail }> {
  const detail = await api.get<ApiUserDetail>(`/users/${id}`)
  return { ...mapUserToPersonnel(detail), raw: detail }
}

export async function createUser(payload: {
  fullName: string
  username: string
  phone?: string
  password: string
  passwordConfirm: string
  role: 'ADMIN' | 'PERSONNEL'
  status: 'ACTIVE' | 'PASSIVE'
}): Promise<Personnel> {
  const row = await api.post<ApiUserListItem>('/users', payload)
  return mapUserToPersonnel(row)
}

export async function updateUser(
  id: string | number,
  payload: {
    fullName?: string
    username?: string
    phone?: string | null
    role?: 'ADMIN' | 'PERSONNEL'
    status?: 'ACTIVE' | 'PASSIVE'
  },
): Promise<Personnel> {
  const row = await api.put<ApiUserListItem>(`/users/${id}`, payload)
  return mapUserToPersonnel(row)
}

export async function updateUserStatus(
  id: string | number,
  status: 'ACTIVE' | 'PASSIVE',
): Promise<Personnel> {
  const row = await api.patch<ApiUserListItem>(`/users/${id}/status`, { status })
  return mapUserToPersonnel(row)
}

export async function resetUserPassword(
  id: string | number,
  payload: { newPassword: string; newPasswordConfirm: string },
): Promise<void> {
  await api.post(`/users/${id}/reset-password`, payload)
}

export async function changeOwnPassword(payload: {
  currentPassword: string
  newPassword: string
  newPasswordConfirm: string
}): Promise<{ success: boolean }> {
  return api.post('/users/me/change-password', payload)
}
