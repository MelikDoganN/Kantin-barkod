import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as backupService from '../services/backup.service'
import { backupListQuerySchema } from '../validators/settings.validator'

function actorId(req: Request): number {
  if (!req.user?.id) throw new AppError('Kimlik doğrulama gerekli.', 401)
  return req.user.id
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const backup = await backupService.createBackup(actorId(req))
    success(res, { backup }, 'Veritabanı yedeği oluşturuldu.', 201)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = backupListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const data = await backupService.listBackups(parsed.data)
    success(res, data, 'Yedekler listelendi')
  } catch (error) {
    next(error)
  }
}

export async function download(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id ?? '')
    if (!id) throw new AppError('Geçersiz yedek kimliği.', 400)
    const file = await backupService.getBackupDownload(id)
    res.download(file.absolutePath, file.fileName)
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = String(req.params.id ?? '')
    if (!id) throw new AppError('Geçersiz yedek kimliği.', 400)
    const data = await backupService.deleteBackup(actorId(req), id)
    success(res, data, 'Yedek silindi.')
  } catch (error) {
    next(error)
  }
}
