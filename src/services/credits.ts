import { api } from '@/services/api'
import type { CreditSummary, CreditTransaction, Customer } from '@/types'

export interface ApiCreditCustomer {
  id: number
  name: string
  phone: string | null
  note: string | null
  totalDebt: number
  lastTransactionDate: string | null
  status: 'OPEN' | 'PAID'
  createdAt: string
}

export interface ApiCreditTransaction {
  id: number
  date: string
  description: string
  amount: number
  type: 'DEBT' | 'PAYMENT'
  saleId: number | null
}

export interface ApiCreditCustomerDetail extends ApiCreditCustomer {
  transactions: ApiCreditTransaction[]
}

export interface ApiCreditSummary {
  totalCustomers: number
  totalDebt: number
  todayDebtSales: number
  todayPayments: number
}

export interface CreateDebtCustomerResult {
  id: number
  fullName: string
  phone: string | null
  currentDebt: number
  note: string | null
  createdAt: string
}

export interface CollectPaymentResult {
  customerId: number
  name: string
  previousDebt: number
  amount: number
  remainingDebt: number
  status: 'OPEN' | 'PAID'
  transaction: ApiCreditTransaction
}

function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('tr-TR')
}

export function mapCreditCustomer(c: ApiCreditCustomer): Customer {
  return {
    id: String(c.id),
    name: c.name,
    phone: c.phone ?? '',
    totalDebt: c.totalDebt,
    lastPurchase: formatDisplayDate(c.lastTransactionDate),
    status: c.status === 'OPEN' ? 'open' : 'paid',
    note: c.note ?? undefined,
    createdAt: formatDisplayDate(c.createdAt),
  }
}

export function mapCreditTransaction(
  tx: ApiCreditTransaction,
  customerId: string,
): CreditTransaction {
  return {
    id: String(tx.id),
    customerId,
    type: tx.type === 'PAYMENT' ? 'payment' : 'debt',
    amount: tx.amount,
    items: tx.description,
    date: formatDisplayDate(tx.date),
    status: tx.type === 'PAYMENT' ? 'paid' : 'open',
    saleId: tx.saleId != null ? String(tx.saleId) : null,
  }
}

export function mapCreditSummary(s: ApiCreditSummary): CreditSummary {
  return {
    totalDebtors: s.totalCustomers,
    totalReceivable: s.totalDebt,
    todayDebtSales: s.todayDebtSales,
    collected: s.todayPayments,
  }
}

export async function fetchCreditCustomers(search?: string): Promise<Customer[]> {
  const params = new URLSearchParams()
  if (search?.trim()) params.set('search', search.trim())
  const q = params.toString()
  const rows = await api.get<ApiCreditCustomer[]>(`/credits/customers${q ? `?${q}` : ''}`)
  return rows.map(mapCreditCustomer)
}

export async function fetchCreditCustomerDetail(id: string | number): Promise<{
  customer: Customer
  transactions: CreditTransaction[]
}> {
  const detail = await api.get<ApiCreditCustomerDetail>(`/credits/customers/${id}`)
  const customer = mapCreditCustomer(detail)
  return {
    customer,
    transactions: detail.transactions.map((tx) => mapCreditTransaction(tx, customer.id)),
  }
}

export interface ApiCreditSaleDetail {
  id: number
  saleNo: string
  time: string
  date: string
  createdAt: string
  payment: 'debt'
  paymentType: string
  total: number
  subtotal: number
  discount: number
  personnel: string
  personnelRole: string
  customer: { id: number; name: string; phone: string | null }
  itemCount: number
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

export async function fetchCreditSaleDetail(
  customerId: string | number,
  saleId: string | number,
): Promise<ApiCreditSaleDetail> {
  return api.get<ApiCreditSaleDetail>(`/credits/customers/${customerId}/sales/${saleId}`)
}

export async function fetchCreditSummary(): Promise<CreditSummary> {
  const summary = await api.get<ApiCreditSummary>('/credits/summary')
  return mapCreditSummary(summary)
}

export async function collectCreditPayment(input: {
  customerId: number
  amount: number
  note?: string
}): Promise<CollectPaymentResult> {
  return api.post<CollectPaymentResult>('/credits/payment', input)
}

export async function createDebtCustomer(input: {
  fullName: string
  phone?: string
  openingDebt?: number
  note?: string
}): Promise<CreateDebtCustomerResult> {
  return api.post<CreateDebtCustomerResult>('/credits/customers', input)
}
