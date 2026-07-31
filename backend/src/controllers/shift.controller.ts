import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { ShiftStatus } from '@prisma/client'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as shiftService from '../services/shift.service'

const openSchema = z.object({
  openingCash: z.coerce.number().min(0, 'Açılış kasası 0 veya daha büyük olmalıdır'),
  note: z.string().trim().optional(),
})

const closeSchema = z.object({
  closingCash: z.coerce.number().min(0, 'Sayım kasası 0 veya daha büyük olmalıdır'),
  note: z.string().trim().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz vardiya kimliği')

const listQuerySchema = z.object({
  date: z.string().trim().optional(),
  status: z.nativeEnum(ShiftStatus).optional(),
  userId: z.coerce.number().int().positive().optional(),
})

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function current(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    const shift = await shiftService.getCurrentShift(user.id)
    success(res, shift, shift ? 'Aktif vardiya getirildi' : 'Açık vardiya yok')
  } catch (error) {
    next(error)
  }
}

export async function open(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = openSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const shift = await shiftService.openShift(user.id, parsed.data.openingCash, parsed.data.note)
    success(res, shift, 'Vardiya açıldı', 201)
  } catch (error) {
    next(error)
  }
}

export async function close(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz vardiya kimliği', 400)
    }
    const parsed = closeSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const shift = await shiftService.closeShift(
      idParsed.data,
      user.id,
      user.role,
      parsed.data.closingCash,
      parsed.data.note,
    )
    success(res, shift, 'Vardiya kapatıldı')
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
    const shifts = await shiftService.listShifts(user.id, user.role, parsed.data)
    success(res, shifts, 'Vardiyalar listelendi')
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz vardiya kimliği', 400)
    }
    const user = requireUser(req)
    const shift = await shiftService.getShiftById(idParsed.data, user.id, user.role)
    success(res, shift, 'Vardiya detayı getirildi')
  } catch (error) {
    next(error)
  }
}
