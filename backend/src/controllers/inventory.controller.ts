import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { StockMovementType } from '../types/enums'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as inventoryService from '../services/inventory.service'

const receiptSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  quantity: z.coerce.number().int().positive('Miktar 0\'dan büyük olmalıdır'),
  unitType: z.enum(['unit', 'case'], { message: 'Birim tipi unit veya case olmalıdır' }),
  cartonCount: z.coerce.number().int().positive().optional(),
  description: z.string().trim().optional(),
})

const openCartonSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  cartonCount: z.coerce.number().int().positive('Koli adedi 0\'dan büyük olmalıdır'),
  description: z.string().trim().optional(),
})

const wasteSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  quantity: z.coerce.number().int().positive('Miktar 0\'dan büyük olmalıdır'),
  reason: z.string().trim().min(1, 'Sebep zorunludur'),
  description: z.string().trim().optional(),
})

const movementQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  type: z.nativeEnum(StockMovementType).optional(),
  date: z.string().trim().optional(),
})

const initialLoadItemSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  depotQuantity: z.coerce
    .number({ message: 'Depo stoğu sayı olmalıdır' })
    .int('Depo stoğu tam sayı olmalıdır')
    .min(0, 'Depo stoğu negatif olamaz'),
  shelfQuantity: z.coerce
    .number({ message: 'Raf stoğu sayı olmalıdır' })
    .int('Raf stoğu tam sayı olmalıdır')
    .min(0, 'Raf stoğu negatif olamaz'),
})

const initialLoadSchema = z
  .array(initialLoadItemSchema)
  .min(1, 'En az bir ürün gönderilmelidir')

function requireUserId(req: Request): number {
  if (!req.user?.id) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user.id
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void req
    const [items, summary] = await Promise.all([
      inventoryService.listInventory(),
      inventoryService.getInventorySummary(),
    ])
    success(res, { items, summary }, 'Stok durumu listelendi')
  } catch (error) {
    next(error)
  }
}

export async function receipt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = receiptSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const result = await inventoryService.goodsReceipt(parsed.data, requireUserId(req))
    success(res, result, 'Mal kabul kaydedildi', 201)
  } catch (error) {
    next(error)
  }
}

export async function openCarton(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = openCartonSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const result = await inventoryService.openCarton(parsed.data, requireUserId(req))
    success(res, result, 'Koli açıldı', 201)
  } catch (error) {
    next(error)
  }
}

export async function waste(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = wasteSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const result = await inventoryService.recordWaste(parsed.data, requireUserId(req))
    success(res, result, 'Fire kaydı oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function movements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = movementQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const list = await inventoryService.listMovements(parsed.data)
    success(res, list, 'Stok hareketleri listelendi')
  } catch (error) {
    next(error)
  }
}

export async function wasteList(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void req
    const list = await inventoryService.listWasteRecords()
    success(res, list, 'Fire kayıtları listelendi')
  } catch (error) {
    next(error)
  }
}

export async function initialLoad(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = initialLoadSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const result = await inventoryService.initialStockLoad(parsed.data, requireUserId(req))
    success(res, result, 'İlk stok girişi kaydedildi', 201)
  } catch (error) {
    next(error)
  }
}
