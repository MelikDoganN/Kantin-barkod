import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as auditLogService from '../services/auditLog.service'

const listQuerySchema = z.object({
  date: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
  module: z.string().trim().optional(),
  actionType: z.string().trim().optional(),
  status: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
})

const dateQuerySchema = z.object({
  date: z.string().trim().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz log kimliği')

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const data = await auditLogService.listAuditLogs(parsed.data)
    success(res, data, 'İşlem geçmişi listelendi')
  } catch (error) {
    next(error)
  }
}

export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = dateQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz tarih', 400)
    }
    const data = await auditLogService.getAuditSummary(parsed.data.date)
    success(res, data, 'Günlük özet getirildi')
  } catch (error) {
    next(error)
  }
}

export async function filters(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await auditLogService.getAuditFilters()
    success(res, data, 'Filtre seçenekleri getirildi')
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    const data = await auditLogService.getAuditLogById(idParsed.data)
    success(res, data, 'Log detayı getirildi')
  } catch (error) {
    next(error)
  }
}
