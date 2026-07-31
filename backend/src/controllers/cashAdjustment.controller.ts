import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as cashAdjustmentService from '../services/cashAdjustment.service'

const createSchema = z.object({
  amount: z.coerce.number().refine((n) => Number.isFinite(n) && n !== 0, 'Tutar 0 olamaz'),
  description: z.string().trim().min(3, 'Açıklama en az 3 karakter olmalıdır'),
  dayEndId: z.coerce.number().int().positive().optional().nullable(),
})

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const record = await cashAdjustmentService.createCashAdjustment(user.id, user.role, parsed.data)
    success(res, record, 'Kasa düzeltme kaydedildi', 201)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    requireUser(req)
    const limit = req.query.limit ? Number(req.query.limit) : 50
    const rows = await cashAdjustmentService.listCashAdjustments(limit)
    success(res, rows, 'Kasa düzeltmeleri listelendi')
  } catch (error) {
    next(error)
  }
}
