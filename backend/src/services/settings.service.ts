import fs from 'fs'
import path from 'path'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import {
  DEFAULT_BACKUPS_DIR,
  SETTINGS_UPLOADS_DIR,
  UPLOADS_DIR,
  ensureDir,
  safeUnlink,
} from '../utils/paths'

const DEFAULT_BUSINESS_NAME = 'Kantin POS'

async function writeSettingsAudit(params: {
  userId: number
  actionType: string
  title: string
  description?: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      module: 'SETTINGS',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'SystemSetting',
      entityId: null,
      entityLabel: 'Sistem Ayarları',
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

function serializeSettings(row: {
  id: string
  businessName: string
  phone: string | null
  address: string | null
  logoPath: string | null
  currency: string
  dateFormat: string
  defaultCategoryId: number | null
  theme: string
  barcodeEnabled: boolean
  barcodeAutoAdd: boolean
  barcodeQuantityMode: boolean
  lowStockThreshold: number
  backupDirectory: string | null
  autoBackupEnabled: boolean
  autoBackupFrequency: string | null
  lastBackupAt: Date | null
}) {
  return {
    id: row.id,
    business: {
      businessName: row.businessName,
      phone: row.phone,
      address: row.address,
      logoPath: row.logoPath,
    },
    system: {
      currency: row.currency,
      dateFormat: row.dateFormat,
      defaultCategoryId: row.defaultCategoryId,
      theme: row.theme,
      lowStockThreshold: row.lowStockThreshold,
    },
    barcode: {
      barcodeEnabled: row.barcodeEnabled,
      barcodeAutoAdd: row.barcodeAutoAdd,
      barcodeQuantityMode: row.barcodeQuantityMode,
    },
    backup: {
      backupDirectory: row.backupDirectory,
      autoBackupEnabled: row.autoBackupEnabled,
      autoBackupFrequency: row.autoBackupFrequency,
      lastBackupAt: row.lastBackupAt ? row.lastBackupAt.toISOString() : null,
    },
  }
}

export async function getOrCreateSettings() {
  const existing = await prisma.systemSetting.findFirst({ orderBy: { createdAt: 'asc' } })
  if (existing) return serializeSettings(existing)

  const created = await prisma.systemSetting.create({
    data: { businessName: DEFAULT_BUSINESS_NAME },
  })
  return serializeSettings(created)
}

async function getSettingsRow() {
  let row = await prisma.systemSetting.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!row) {
    row = await prisma.systemSetting.create({
      data: { businessName: DEFAULT_BUSINESS_NAME },
    })
  }
  return row
}

export async function updateBusinessSettings(
  userId: number,
  input: { businessName: string; phone?: string | null; address?: string | null },
) {
  const row = await getSettingsRow()
  const businessName = input.businessName.trim()
  const phone = input.phone?.trim() ? input.phone.trim() : null
  const address = input.address?.trim() ? input.address.trim() : null

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: { businessName, phone, address },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_BUSINESS_SETTINGS',
    title: 'İşletme ayarları güncellendi',
    description: businessName,
    oldValues: {
      businessName: row.businessName,
      phone: row.phone,
      address: row.address,
    },
    newValues: { businessName, phone, address },
  })

  return serializeSettings(updated)
}

export async function updateSystemSettings(
  userId: number,
  input: {
    currency: 'TRY'
    dateFormat: 'DD.MM.YYYY' | 'YYYY-MM-DD'
    defaultCategoryId?: number | null
    theme: 'LIGHT' | 'DARK'
    lowStockThreshold: number
  },
) {
  const row = await getSettingsRow()
  const defaultCategoryId =
    input.defaultCategoryId === undefined ? row.defaultCategoryId : input.defaultCategoryId

  if (defaultCategoryId != null) {
    const category = await prisma.category.findUnique({ where: { id: defaultCategoryId } })
    if (!category) throw new AppError('Seçilen kategori bulunamadı.', 400)
  }

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: {
      currency: input.currency,
      dateFormat: input.dateFormat,
      defaultCategoryId,
      theme: input.theme,
      lowStockThreshold: input.lowStockThreshold,
    },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_SYSTEM_SETTINGS',
    title: 'Sistem ayarları güncellendi',
    oldValues: {
      currency: row.currency,
      dateFormat: row.dateFormat,
      defaultCategoryId: row.defaultCategoryId,
      theme: row.theme,
      lowStockThreshold: row.lowStockThreshold,
    },
    newValues: {
      currency: input.currency,
      dateFormat: input.dateFormat,
      defaultCategoryId,
      theme: input.theme,
      lowStockThreshold: input.lowStockThreshold,
    },
  })

  return serializeSettings(updated)
}

export async function updateBarcodeSettings(
  userId: number,
  input: {
    barcodeEnabled: boolean
    barcodeAutoAdd: boolean
    barcodeQuantityMode: boolean
  },
) {
  const row = await getSettingsRow()
  const barcodeEnabled = input.barcodeEnabled
  const barcodeAutoAdd = barcodeEnabled ? input.barcodeAutoAdd : false
  const barcodeQuantityMode = barcodeEnabled ? input.barcodeQuantityMode : false

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: { barcodeEnabled, barcodeAutoAdd, barcodeQuantityMode },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_BARCODE_SETTINGS',
    title: 'Barkod ayarları güncellendi',
    oldValues: {
      barcodeEnabled: row.barcodeEnabled,
      barcodeAutoAdd: row.barcodeAutoAdd,
      barcodeQuantityMode: row.barcodeQuantityMode,
    },
    newValues: { barcodeEnabled, barcodeAutoAdd, barcodeQuantityMode },
  })

  return serializeSettings(updated)
}

export async function updateBackupSettings(
  userId: number,
  input: {
    backupDirectory?: string | null
    autoBackupEnabled: boolean
    autoBackupFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null
  },
) {
  const row = await getSettingsRow()
  let backupDirectory = input.backupDirectory?.trim() ? input.backupDirectory.trim() : null
  const autoBackupEnabled = input.autoBackupEnabled
  let autoBackupFrequency = input.autoBackupFrequency ?? null

  if (autoBackupEnabled) {
    if (!backupDirectory) {
      throw new AppError('Otomatik yedekleme açıksa yedekleme dizini zorunludur.', 400)
    }
    if (!autoBackupFrequency) {
      throw new AppError('Otomatik yedekleme açıksa yedekleme sıklığı zorunludur.', 400)
    }
  } else if (!autoBackupFrequency) {
    autoBackupFrequency = null
  }

  if (backupDirectory) {
    try {
      ensureDir(backupDirectory)
      fs.accessSync(backupDirectory, fs.constants.W_OK)
    } catch {
      throw new AppError('Seçilen yedekleme dizinine yazılamıyor.', 400)
    }
  }

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: { backupDirectory, autoBackupEnabled, autoBackupFrequency },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_BACKUP_SETTINGS',
    title: 'Yedekleme ayarları güncellendi',
    oldValues: {
      backupDirectory: row.backupDirectory,
      autoBackupEnabled: row.autoBackupEnabled,
      autoBackupFrequency: row.autoBackupFrequency,
    },
    newValues: { backupDirectory, autoBackupEnabled, autoBackupFrequency },
  })

  return serializeSettings(updated)
}

export async function uploadLogo(userId: number, file: Express.Multer.File) {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
  const ext = path.extname(file.originalname).toLowerCase()
  const allowedExt = new Set(['.png', '.jpg', '.jpeg', '.webp'])

  if (!allowed.has(file.mimetype) || !allowedExt.has(ext) || ext === '.svg') {
    throw new AppError('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.', 400)
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new AppError('Logo dosyası en fazla 2 MB olabilir.', 400)
  }

  ensureDir(SETTINGS_UPLOADS_DIR)
  const row = await getSettingsRow()

  const uniqueName = `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
  const absolutePath = path.join(SETTINGS_UPLOADS_DIR, uniqueName)
  fs.writeFileSync(absolutePath, file.buffer)

  const logoPath = `/uploads/settings/${uniqueName}`

  if (row.logoPath) {
    const previousAbsolute = path.join(
      UPLOADS_DIR,
      row.logoPath.replace(/^\/uploads\//, ''),
    )
    safeUnlink(previousAbsolute, [SETTINGS_UPLOADS_DIR])
  }

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: { logoPath },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_LOGO',
    title: 'İşletme logosu güncellendi',
    oldValues: { logoPath: row.logoPath },
    newValues: { logoPath },
  })

  return serializeSettings(updated)
}

export async function deleteLogo(userId: number) {
  const row = await getSettingsRow()
  if (row.logoPath) {
    const absolute = path.join(UPLOADS_DIR, row.logoPath.replace(/^\/uploads\//, ''))
    safeUnlink(absolute, [SETTINGS_UPLOADS_DIR])
  }

  const updated = await prisma.systemSetting.update({
    where: { id: row.id },
    data: { logoPath: null },
  })

  await writeSettingsAudit({
    userId,
    actionType: 'UPDATE_LOGO',
    title: 'İşletme logosu kaldırıldı',
    oldValues: { logoPath: row.logoPath },
    newValues: { logoPath: null },
  })

  return serializeSettings(updated)
}

export async function getBackupDirectorySetting(): Promise<string> {
  const row = await getSettingsRow()
  if (row.backupDirectory?.trim()) return row.backupDirectory.trim()
  ensureDir(DEFAULT_BACKUPS_DIR)
  return DEFAULT_BACKUPS_DIR
}

export async function markLastBackupAt(at: Date) {
  const row = await getSettingsRow()
  await prisma.systemSetting.update({
    where: { id: row.id },
    data: { lastBackupAt: at },
  })
}

export async function getAutoBackupConfig() {
  const row = await getSettingsRow()
  return {
    autoBackupEnabled: row.autoBackupEnabled,
    autoBackupFrequency: row.autoBackupFrequency,
    lastBackupAt: row.lastBackupAt,
  }
}
