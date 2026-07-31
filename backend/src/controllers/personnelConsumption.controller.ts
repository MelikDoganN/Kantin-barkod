import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as consumptionService from '../services/personnelConsumption.service'

const createSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  quantity: z.coerce.number().int().positive('Miktar 0’dan büyük olmalıdır'),
  reason: z.enum(['meal', 'drink', 'treat', 'test', 'other']),
  note: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
})

const listQuerySchema = z.object({
  date: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz kimlik')

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
    const data = await consumptionService.createConsumption({
      actorId: user.id,
      actorRole: user.role,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
      reason: parsed.data.reason,
      note: parsed.data.note,
      userId: parsed.data.userId,
    })
    success(res, data, 'Personel tüketimi kaydedildi', 201)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const user = requireUser(req)
    const data = await consumptionService.listConsumptions(user.id, user.role, parsed.data)
    success(res, data, 'Tüketim kayıtları listelendi')
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
    const user = requireUser(req)
    const data = await consumptionService.getConsumptionById(idParsed.data, user.id, user.role)
    success(res, data, 'Tüketim detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await consumptionService.getConsumptionPageSummary()
    success(res, data, 'Tüketim özeti getirildi')
  } catch (error) {
    next(error)
  }
}

export async function personnel(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await consumptionService.listPersonnelOptions()
    success(res, data, 'Personel listesi getirildi')
  } catch (error) {
    next(error)
  }
}
