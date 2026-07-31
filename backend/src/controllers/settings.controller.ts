import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as settingsService from '../services/settings.service'
import {
  barcodeSettingsSchema,
  backupSettingsSchema,
  businessSettingsSchema,
  systemSettingsSchema,
} from '../validators/settings.validator'

function actorId(req: Request): number {
  if (!req.user?.id) throw new AppError('Kimlik doğrulama gerekli.', 401)
  return req.user.id
}

export async function getSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await settingsService.getOrCreateSettings()
    success(res, data, 'Ayarlar getirildi')
  } catch (error) {
    next(error)
  }
}

export async function updateBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = businessSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz işletme ayarları', 400)
    }
    const data = await settingsService.updateBusinessSettings(actorId(req), parsed.data)
    success(res, data, 'İşletme bilgileri güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function updateSystem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = systemSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz sistem ayarları', 400)
    }
    const data = await settingsService.updateSystemSettings(actorId(req), parsed.data)
    success(res, data, 'Sistem ayarları güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function updateBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = barcodeSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz barkod ayarları', 400)
    }
    const data = await settingsService.updateBarcodeSettings(actorId(req), parsed.data)
    success(res, data, 'Barkod ayarları güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function updateBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = backupSettingsSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz yedekleme ayarları', 400)
    }
    const data = await settingsService.updateBackupSettings(actorId(req), {
      ...parsed.data,
      autoBackupFrequency: parsed.data.autoBackupFrequency ?? null,
    })
    success(res, data, 'Yedekleme ayarları güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.', 400)
    }
    const data = await settingsService.uploadLogo(actorId(req), req.file)
    success(res, data, 'Logo güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function deleteLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await settingsService.deleteLogo(actorId(req))
    success(res, data, 'Logo kaldırıldı.')
  } catch (error) {
    next(error)
  }
}
