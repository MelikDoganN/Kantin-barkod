import { api } from '@/services/api'
import { mapApiProduct, type ApiProduct } from '@/services/catalog'
import type { Customer, Product, SaleRecord } from '@/types'

export type PaymentTypeApi = 'CASH' | 'CARD' | 'CREDIT'

export interface CreateSalePayload {
  items: Array<{ productId: number; quantity: number }>
  paymentType: PaymentTypeApi
  customerId?: number
  discount?: number
}

export interface ApiDraftSaleItem {
  productId: number
  quantity: number
  unitPrice: number
  totalPrice: number
  product: ApiProduct
}

export interface ApiDraftSale {
  id: number
  status: 'DRAFT'
  subtotal: number
  discount: number
  total: number
  itemCount: number
  createdAt: string
  updatedAt: string
  items: ApiDraftSaleItem[]
}

export async function fetchProductByBarcode(barcode: string): Promise<Product> {
  const product = await api.get<ApiProduct>(`/products/barcode/${encodeURIComponent(barcode)}`)
  return mapApiProduct(product)
}

export async function createSale(payload: CreateSalePayload) {
  return api.post('/sales', payload)
}

export async function fetchDraftSales(): Promise<ApiDraftSale[]> {
  return api.get<ApiDraftSale[]>('/sales/drafts')
}

export async function createDraftSale(): Promise<ApiDraftSale> {
  return api.post<ApiDraftSale>('/sales/drafts')
}

export async function updateDraftSale(
  id: number,
  payload: { items: Array<{ productId: number; quantity: number }>; discount?: number },
): Promise<ApiDraftSale> {
  return api.patch<ApiDraftSale>(`/sales/drafts/${id}`, payload)
}

export async function finalizeDraftSale(
  id: number,
  payload: CreateSalePayload,
): Promise<unknown> {
  return api.post(`/sales/drafts/${id}/finalize`, payload)
}

export async function cancelDraftSale(id: number): Promise<void> {
  await api.delete(`/sales/drafts/${id}`)
}

export async function cancelCompletedSale(
  id: number,
  body: { reason: string; forceAfterDayEnd?: boolean },
) {
  return api.post(`/sales/${id}/cancel`, body)
}

export interface ShiftSaleListItem {
  id: number
  status: string
  paymentType: string | null
  total: number
  createdAt: string
  cancelledAt: string | null
  cancelReason: string | null
  cancelledByName: string | null
  dayEndTaken: boolean
  itemCount: number
  user: { id: number; fullName: string; username: string }
}

export async function fetchShiftSales(shiftId: number): Promise<ShiftSaleListItem[]> {
  return api.get<ShiftSaleListItem[]>(`/sales?shiftId=${shiftId}`)
}

interface ApiSaleDetailRaw {
  id: number
  status: string
  paymentType: PaymentTypeApi | null
  total: number
  createdAt: string
  cancelledAt?: string | null
  cancelReason?: string | null
  cancelledBy?: { fullName: string } | null
  user?: { fullName: string }
  shift?: { dayEnd?: { id: number } | null }
  items?: Array<{
    quantity: number
    unitPrice: number
    totalPrice: number
    product?: {
      name: string
      image?: string | null
      imageUrl?: string | null
      imagePath?: string | null
    }
  }>
}

function mapPayment(type: PaymentTypeApi | null): SaleRecord['payment'] {
  if (type === 'CARD') return 'card'
  if (type === 'CREDIT') return 'debt'
  return 'cash'
}

export async function fetchSaleRecord(id: number): Promise<SaleRecord> {
  const sale = await api.get<ApiSaleDetailRaw>(`/sales/${id}`)
  const items = sale.items ?? []
  return {
    id: String(sale.id),
    saleNo: `#${sale.id}`,
    time: new Date(sale.createdAt).toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    payment: mapPayment(sale.paymentType),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    total: Number(sale.total),
    status: (sale.status as SaleRecord['status']) ?? 'COMPLETED',
    cancelledAt: sale.cancelledAt ?? null,
    cancelReason: sale.cancelReason ?? null,
    cancelledByName: sale.cancelledBy?.fullName ?? null,
    dayEndTaken: !!sale.shift?.dayEnd,
    personnel: sale.user?.fullName,
    items: items.map((item) => ({
      productName: item.product?.name ?? 'Ürün',
      icon: '📦',
      imagePath: item.product?.imagePath ?? item.product?.image ?? null,
      imageUrl: item.product?.imageUrl ?? null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.totalPrice),
    })),
  }
}

export function draftToCartItems(draft: ApiDraftSale): Array<{ product: Product; quantity: number }> {
  return draft.items.map((item) => ({
    product: mapApiProduct(item.product),
    quantity: item.quantity,
  }))
}

export interface ApiCustomer {
  id: number
  name: string
  phone: string | null
  note: string | null
  totalDebt: number
  createdAt: string
  updatedAt: string
}

export function mapApiCustomer(c: ApiCustomer): Customer {
  return {
    id: String(c.id),
    name: c.name,
    phone: c.phone ?? '',
    totalDebt: Number(c.totalDebt),
    lastPurchase: '-',
    status: Number(c.totalDebt) > 0 ? 'open' : 'paid',
    note: c.note ?? undefined,
    createdAt: c.createdAt,
  }
}

export async function fetchCustomers(): Promise<Customer[]> {
  const list = await api.get<ApiCustomer[]>('/customers')
  return list.map(mapApiCustomer)
}

export async function createCustomer(payload: {
  name: string
  phone?: string
  note?: string
}): Promise<Customer> {
  const customer = await api.post<ApiCustomer>('/customers', payload)
  return mapApiCustomer(customer)
}
