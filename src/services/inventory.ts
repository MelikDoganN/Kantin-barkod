import { api } from '@/services/api'
import type { BadgeTone } from '@/types'

export type ApiStockStatus = 'Normal' | 'Düşük' | 'Kritik'

export interface InventoryProductBrief {
  id: number
  name: string
  barcode: string | null
  imagePath: string | null
  imageUrl: string | null
  category: string
}

export interface InventoryItem {
  productId: number
  product: InventoryProductBrief
  warehouseQuantity: number
  shelfQuantity: number
  totalQuantity: number
  minimumStock: number
  unitsPerCarton: number
  unitType: string
  isActive: boolean
  status: ApiStockStatus
}

export interface InventorySummary {
  totalProducts: number
  warehouseStock: number
  shelfStock: number
  criticalCount: number
}

export interface InventoryListResponse {
  items: InventoryItem[]
  summary: InventorySummary
}

export interface StockMovementRow {
  id: number
  productId: number
  product: string
  barcode: string | null
  productImagePath?: string | null
  productImageUrl?: string | null
  type: string
  quantity: number
  beforeWarehouse: number
  afterWarehouse: number
  beforeShelf: number
  afterShelf: number
  description: string | null
  user: string
  userId: number | null
  createdAt: string
}

export interface WasteRow {
  id: number
  productId: number
  product: string
  quantity: number
  reason: string
  description: string | null
  user: string
  createdAt: string
}

export const movementLabels: Record<string, string> = {
  PURCHASE: 'Mal Kabul',
  CARTON_OPEN: 'Koli Açma',
  TRANSFER: 'Transfer',
  SALE: 'Satış',
  SALE_CANCEL: 'Satış İptali',
  RETURN: 'İade',
  WASTE: 'Fire',
  PERSONNEL_CONSUMPTION: 'Personel Tüketimi',
  ADJUSTMENT: 'Düzeltme',
  COUNT_ADJUSTMENT: 'Sayım Düzeltme',
  INITIAL_STOCK: 'İlk Stok Girişi',
}

export const movementTones: Record<string, BadgeTone> = {
  PURCHASE: 'success',
  CARTON_OPEN: 'warning',
  TRANSFER: 'warning',
  SALE: 'info',
  SALE_CANCEL: 'warning',
  RETURN: 'info',
  WASTE: 'danger',
  PERSONNEL_CONSUMPTION: 'violet',
  ADJUSTMENT: 'neutral',
  COUNT_ADJUSTMENT: 'neutral',
  INITIAL_STOCK: 'violet',
}

export function statusTone(status: ApiStockStatus): BadgeTone {
  if (status === 'Kritik') return 'danger'
  if (status === 'Düşük') return 'warning'
  return 'success'
}

export async function fetchInventory(): Promise<InventoryListResponse> {
  return api.get<InventoryListResponse>('/inventory')
}

export async function fetchMovements(params?: {
  productId?: number
  type?: string
  date?: string
}): Promise<StockMovementRow[]> {
  const query = new URLSearchParams()
  if (params?.productId) query.set('productId', String(params.productId))
  if (params?.type) query.set('type', params.type)
  if (params?.date) query.set('date', params.date)
  const qs = query.toString()
  return api.get<StockMovementRow[]>(`/inventory/movements${qs ? `?${qs}` : ''}`)
}

export async function fetchWasteRecords(): Promise<WasteRow[]> {
  return api.get<WasteRow[]>('/inventory/waste')
}

export async function postReceipt(body: {
  productId: number
  quantity: number
  unitType: 'unit' | 'case'
  cartonCount?: number
  description?: string
}) {
  return api.post('/inventory/receipt', body)
}

export async function postOpenCarton(body: {
  productId: number
  cartonCount: number
  description?: string
}) {
  return api.post('/inventory/open-carton', body)
}

export async function postWaste(body: {
  productId: number
  quantity: number
  reason: string
  description?: string
}) {
  return api.post('/inventory/waste', body)
}

export async function postInitialStockLoad(
  items: Array<{ productId: number; depotQuantity: number; shelfQuantity: number }>,
) {
  return api.post<{
    updatedCount: number
    items: Array<{
      productId: number
      product: string
      beforeWarehouse: number
      afterWarehouse: number
      beforeShelf: number
      afterShelf: number
    }>
  }>('/inventory/initial-load', items)
}

export function formatMovementDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
