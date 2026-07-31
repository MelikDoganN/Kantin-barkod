import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as countService from '../services/count.service'

const createSchema = z.object({
  type: z.enum(['WAREHOUSE', 'SHELF', 'warehouse', 'shelf']),
  description: z.string().trim().optional(),
})

const listQuerySchema = z.object({
  date: z.string().trim().optional(),
  status: z.string().trim().optional(),
  type: z.string().trim().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz sayım kimliği')
const itemIdSchema = z.coerce.number().int().positive('Geçersiz kalem kimliği')

const updateItemSchema = z.object({
  countedQuantity: z.coerce.number().min(0, 'Sayım miktarı 0 veya daha büyük olmalıdır'),
  note: z.string().trim().optional(),
})

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const data = await countService.listCounts(parsed.data)
    success(res, data, 'Sayım listesi getirildi')
  } catch (error) {
    next(error)
  }
}

export async function history(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await countService.listHistory()
    success(res, data, 'Sayım geçmişi getirildi')
  } catch (error) {
    next(error)
  }
}

export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await countService.getCountSummary()
    success(res, data, 'Sayım özeti getirildi')
  } catch (error) {
    next(error)
  }
}

export async function active(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await countService.getActiveCount()
    success(res, data, data ? 'Aktif sayım getirildi' : 'Aktif sayım yok')
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
    const data = await countService.getCountById(idParsed.data)
    success(res, data, 'Sayım detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await countService.startCount({
      userId: user.id,
      type: parsed.data.type,
      description: parsed.data.description,
    })
    success(res, data, 'Sayım başlatıldı', 201)
  } catch (error) {
    next(error)
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const itemParsed = itemIdSchema.safeParse(req.params.itemId)
    const bodyParsed = updateItemSchema.safeParse(req.body)
    if (!idParsed.success || !itemParsed.success) {
      throw new AppError('Geçersiz kimlik', 400)
    }
    if (!bodyParsed.success) {
      throw new AppError(bodyParsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const data = await countService.updateCountItem({
      countId: idParsed.data,
      itemId: itemParsed.data,
      countedQuantity: bodyParsed.data.countedQuantity,
      note: bodyParsed.data.note,
    })
    success(res, data, 'Sayım kalemi güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function complete(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    const user = requireUser(req)
    const data = await countService.completeCount(idParsed.data, user.id)
    success(res, data, 'Sayım tamamlandı')
  } catch (error) {
    next(error)
  }
}
