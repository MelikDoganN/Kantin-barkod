import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { DayEndStatus } from '../types/enums'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as dayEndService from '../services/dayEnd.service'

const createSchema = z.object({
  shiftId: z.coerce.number().int().positive('Vardiya zorunludur'),
  actualCash: z.coerce.number().min(0, 'Sayılan kasa 0 veya daha büyük olmalıdır'),
})

const idSchema = z.coerce.number().int().positive('Geçersiz gün sonu kimliği')
const saleIdSchema = z.coerce.number().int().positive('Geçersiz satış kimliği')

const listQuerySchema = z.object({
  date: z.string().trim().optional(),
  userId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(DayEndStatus).optional(),
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
    const record = await dayEndService.createDayEnd(
      user.id,
      user.role,
      parsed.data.shiftId,
      parsed.data.actualCash,
    )
    success(res, record, 'Gün sonu oluşturuldu', 201)
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
    const records = await dayEndService.listDayEnds(user.id, user.role, parsed.data)
    success(res, records, 'Gün sonu kayıtları listelendi')
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
    const record = await dayEndService.getDayEndById(idParsed.data, user.id, user.role)
    success(res, record, 'Gün sonu detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function getSaleDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const saleParsed = saleIdSchema.safeParse(req.params.saleId)
    if (!idParsed.success || !saleParsed.success) {
      throw new AppError('Geçersiz kimlik', 400)
    }
    const user = requireUser(req)
    const sale = await dayEndService.getDayEndSaleDetail(
      idParsed.data,
      saleParsed.data,
      user.id,
      user.role,
    )
    success(res, sale, 'Satış detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function eligibleShifts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    const shifts = await dayEndService.listEligibleShifts(user.id, user.role)
    success(res, shifts, 'Uygun vardiyalar listelendi')
  } catch (error) {
    next(error)
  }
}
