import type { BadgeTone, DayEndStatus, SalePayment } from '@/types'

export const statusLabels: Record<DayEndStatus, string> = {
  pending: 'Bekliyor',
  completed: 'Tamamlandı',
  reviewed: 'İncelendi',
}

export const statusTones: Record<DayEndStatus, BadgeTone> = {
  pending: 'warning',
  completed: 'success',
  reviewed: 'info',
}

export const paymentLabels: Record<SalePayment, string> = {
  cash: 'Nakit',
  card: 'Kart',
  debt: 'Borç',
}

export const paymentTones: Record<SalePayment, BadgeTone> = {
  cash: 'success',
  card: 'info',
  debt: 'warning',
}
