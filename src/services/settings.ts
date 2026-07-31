import { api } from '@/services/api'
import { resolveImageUrl } from '@/utils/resolveImageUrl'

export interface AppSettings {
  id: string
  business: {
    businessName: string
    phone: string | null
    address: string | null
    logoPath: string | null
  }
  system: {
    currency: string
    dateFormat: string
    defaultCategoryId: number | null
    theme: string
    lowStockThreshold: number
  }
  barcode: {
    barcodeEnabled: boolean
    barcodeAutoAdd: boolean
    barcodeQuantityMode: boolean
  }
  backup: {
    backupDirectory: string | null
    autoBackupEnabled: boolean
    autoBackupFrequency: string | null
    lastBackupAt: string | null
  }
}

export function logoUrl(logoPath: string | null | undefined): string | null {
  return resolveImageUrl(logoPath)
}

export function fetchSettings() {
  return api.get<AppSettings>('/settings')
}

export function updateBusinessSettings(body: {
  businessName: string
  phone?: string | null
  address?: string | null
}) {
  return api.put<AppSettings>('/settings/business', body)
}

export function updateSystemSettings(body: {
  currency: 'TRY'
  dateFormat: 'DD.MM.YYYY' | 'YYYY-MM-DD'
  defaultCategoryId?: number | null
  theme: 'LIGHT' | 'DARK'
  lowStockThreshold: number
}) {
  return api.put<AppSettings>('/settings/system', body)
}

export function updateBarcodeSettings(body: {
  barcodeEnabled: boolean
  barcodeAutoAdd: boolean
  barcodeQuantityMode: boolean
}) {
  return api.put<AppSettings>('/settings/barcode', body)
}

export function updateBackupSettings(body: {
  backupDirectory?: string | null
  autoBackupEnabled: boolean
  autoBackupFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
}) {
  return api.put<AppSettings>('/settings/backup', body)
}

export function uploadLogo(file: File) {
  const form = new FormData()
  form.append('logo', file)
  return api.postForm<AppSettings>('/settings/logo', form)
}

export function deleteLogo() {
  return api.delete<AppSettings>('/settings/logo')
}
