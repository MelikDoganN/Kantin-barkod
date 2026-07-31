export type ProductStatus = 'active' | 'passive'

export type UnitType = 'unit' | 'case'

export interface Category {
  id: string
  name: string
  icon: string
}

export interface Product {
  id: string
  name: string
  barcode: string
  categoryId: string
  categoryName: string
  purchasePrice: number
  salePrice: number
  shelfStock: number
  warehouseStock: number
  criticalLevel: number
  casePackSize: number
  unitType: UnitType
  status: ProductStatus
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
}

export interface CartItem {
  product: Product
  quantity: number
}

export type PaymentMethod = 'cash' | 'card'

export interface TopProduct {
  id: string
  name: string
  quantity: number
  total: number
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
}

export interface SalesPoint {
  label: string
  amount: number
}

export type StockMovementType = 'in' | 'out' | 'transfer' | 'waste' | 'consumption'

export interface StockMovement {
  id: string
  date: string
  productName: string
  type: StockMovementType
  actionLabel: string
  quantityLabel: string
  before: number
  after: number
  user: string
}

export interface InventorySummary {
  totalProducts: number
  warehouseStock: number
  shelfStock: number
  criticalCount: number
}

export interface GoodsReceiptItem {
  id: string
  productName: string
  quantity: number
  unitCost: number
  supplier: string
  date: string
}

export interface WasteRecord {
  id: string
  productName: string
  quantity: number
  reason: string
  date: string
}

export type CountType = 'warehouse' | 'shelf'

export interface StockCountRow {
  id: string
  productName: string
  systemStock: number
  countedStock: number
  note: string
}

export interface CountSummary {
  activeCount: number
  lastCountDate: string
  totalCountedProducts: number
  stockDifference: number
}

export interface CountHistoryEntry {
  id: string
  date: string
  type: CountType
  user: string
  productCount: number
  difference: number
  status: 'completed' | 'inprogress'
}

export type PersonnelRole = 'admin' | 'manager' | 'cashier'

export interface Shift {
  id: string
  personnel: string
  role: PersonnelRole
  date: string
  startTime: string
  endTime: string | null
  openingCash: number
  cashSales: number
  cardSales: number
  debtSales: number
  expectedCash: number
  countedCash: number | null
  status: 'open' | 'closed'
}

export interface Personnel {
  id: string
  name: string
  username: string
  role: PersonnelRole
  status: ProductStatus
  phone: string
  createdAt: string
  lastLogin: string
  totalSales: number
  totalShifts: number
  totalRevenue: number
  activeShiftLabel?: string | null
}

export interface PersonnelSalesSummary {
  id: string
  name: string
  saleCount: number
  total: number
}

export type AuditModule =
  | 'sales'
  | 'stock'
  | 'product'
  | 'shift'
  | 'dayend'
  | 'count'
  | 'credit'
  | 'consumption'
  | 'personnel'
  | 'settings'
  | 'auth'

export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'sale'
  | 'collect'
  | 'shiftOpen'
  | 'shiftClose'
  | 'login'
  | 'logout'

export type AuditStatus = 'success' | 'failed'

export interface AuditLogUser {
  id: number
  fullName: string
  username: string
  role: string
}

export interface AuditLog {
  id: string
  createdAt: string
  date: string
  time: string
  userId: string
  userName: string
  userRole: string
  module: string
  actionType: string
  title: string
  description: string
  entityType: string
  entityId: string
  entityLabel: string
  status: AuditStatus
  deviceName: string
  ipAddress: string
  oldValues?: Record<string, string>
  newValues?: Record<string, string>
  metadata?: Record<string, string>
}

export type ConsumptionReason = 'meal' | 'drink' | 'treat' | 'test' | 'other'

export interface ConsumptionRecord {
  id: string
  date: string
  time: string
  personnelId: string
  personnelName: string
  productName: string
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
  quantity: number
  unitCost: number
  cost: number
  reason: ConsumptionReason
  note?: string
}

export interface ConsumptionSummary {
  todayItems: number
  todayCost: number
  monthItems: number
  activePersonnel: number
}

export type CustomerStatus = 'open' | 'paid'

export interface Customer {
  id: string
  name: string
  phone: string
  totalDebt: number
  lastPurchase: string
  status: CustomerStatus
  note?: string
  createdAt: string
}

export type CreditTransactionType = 'debt' | 'payment'

export interface CreditTransaction {
  id: string
  customerId: string
  type: CreditTransactionType
  amount: number
  items: string
  date: string
  status: CustomerStatus
  saleId?: string | null
}

export interface CreditSummary {
  totalDebtors: number
  totalReceivable: number
  todayDebtSales: number
  collected: number
}

export type SalePayment = 'cash' | 'card' | 'debt'

export interface SaleLineItem {
  productName: string
  icon: string
  imagePath?: string | null
  imageUrl?: string | null
  quantity: number
  unitPrice: number
  total: number
}

export interface SaleRecord {
  id: string
  saleNo: string
  time: string
  payment: SalePayment
  itemCount: number
  total: number
  items: SaleLineItem[]
  status?: 'COMPLETED' | 'CANCELLED' | 'DRAFT'
  cancelledAt?: string | null
  cancelReason?: string | null
  cancelledByName?: string | null
  dayEndTaken?: boolean
  personnel?: string
}

export type DayEndStatus = 'pending' | 'completed' | 'reviewed'

export interface DayEndRecord {
  id: string
  date: string
  personnel: string
  role: PersonnelRole
  shift: string
  openingCash: number
  saleCount: number
  totalSales: number
  cashSales: number
  cardSales: number
  debtSales: number
  cashDifference: number
  status: DayEndStatus
  sales: SaleRecord[]
}

export interface RecentActivity {
  id: string
  time: string
  user: string
  description: string
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet'

export interface NavItem {
  label: string
  path: string
  icon: string
  allowedRoles: import('@/config/permissions').UserRole[]
}
