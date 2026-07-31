import { api } from '@/services/api'

export interface ApiCategoryRow {
  id: number
  name: string
  description: string | null
  isActive: boolean
  productCount: number
  createdAt: string
  updatedAt: string
}

export interface CategoryPayload {
  name: string
  description?: string | null
  isActive?: boolean
}

export function fetchCategoryRows() {
  return api.get<ApiCategoryRow[]>('/categories')
}

export function createCategory(payload: CategoryPayload) {
  return api.post<ApiCategoryRow>('/categories', payload)
}

export function updateCategory(id: number, payload: CategoryPayload) {
  return api.put<ApiCategoryRow>(`/categories/${id}`, payload)
}

export function updateCategoryStatus(id: number, isActive: boolean) {
  return api.patch<ApiCategoryRow>(`/categories/${id}/status`, { isActive })
}

export function deleteCategory(id: number) {
  return api.delete<{ id: number }>(`/categories/${id}`)
}
