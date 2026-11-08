export const UserRole = { ADMIN: 'ADMIN', PERSONNEL: 'PERSONNEL' } as const
export type UserRole = (typeof UserRole)[keyof typeof UserRole]

export const UserStatus = { ACTIVE: 'ACTIVE', PASSIVE: 'PASSIVE' } as const
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus]

export const PaymentType = { CASH: 'CASH', CARD: 'CARD', CREDIT: 'CREDIT' } as const
export type PaymentType = (typeof PaymentType)[keyof typeof PaymentType]

export const ShiftStatus = { OPEN: 'OPEN', CLOSED: 'CLOSED' } as const
export type ShiftStatus = (typeof ShiftStatus)[keyof typeof ShiftStatus]

export const StockMovementType = {
  PURCHASE: 'PURCHASE',
  CARTON_OPEN: 'CARTON_OPEN',
  TRANSFER: 'TRANSFER',
  SALE: 'SALE',
  SALE_CANCEL: 'SALE_CANCEL',
  RETURN: 'RETURN',
  WASTE: 'WASTE',
  PERSONNEL_CONSUMPTION: 'PERSONNEL_CONSUMPTION',
  ADJUSTMENT: 'ADJUSTMENT',
  COUNT_ADJUSTMENT: 'COUNT_ADJUSTMENT',
  INITIAL_STOCK: 'INITIAL_STOCK',
} as const
export type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType]

export const CreditTransactionType = { DEBT: 'DEBT', PAYMENT: 'PAYMENT' } as const
export type CreditTransactionType = (typeof CreditTransactionType)[keyof typeof CreditTransactionType]

export const DayEndStatus = { PENDING: 'PENDING', COMPLETED: 'COMPLETED', REVIEWED: 'REVIEWED' } as const
export type DayEndStatus = (typeof DayEndStatus)[keyof typeof DayEndStatus]

export const SaleStatus = { DRAFT: 'DRAFT', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' } as const
export type SaleStatus = (typeof SaleStatus)[keyof typeof SaleStatus]
