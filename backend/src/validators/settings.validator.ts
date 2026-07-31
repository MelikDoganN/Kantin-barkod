import { z } from 'zod'

export const businessSettingsSchema = z.object({
  businessName: z.string().trim().min(1, 'İşletme adı zorunludur.').max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
})

export const systemSettingsSchema = z.object({
  currency: z.literal('TRY'),
  dateFormat: z.enum(['DD.MM.YYYY', 'YYYY-MM-DD']),
  defaultCategoryId: z.union([z.coerce.number().int().positive(), z.null()]).optional().nullable(),
  theme: z.enum(['LIGHT', 'DARK']),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
})

export const barcodeSettingsSchema = z.object({
  barcodeEnabled: z.boolean(),
  barcodeAutoAdd: z.boolean(),
  barcodeQuantityMode: z.boolean(),
})

export const backupSettingsSchema = z.object({
  backupDirectory: z.string().trim().max(500).optional().nullable(),
  autoBackupEnabled: z.boolean(),
  autoBackupFrequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
})

export const backupListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
})
