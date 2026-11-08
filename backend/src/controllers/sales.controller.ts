import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { PaymentType } from '../types/enums'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as salesService from '../services/sales.service'

const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive('Ürün zorunludur'),
  quantity: z.coerce.number().int().positive('Miktar 0\'dan büyük olmalıdır'),
})

const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'Sepet boş olamaz'),
  paymentType: z.nativeEnum(PaymentType),
  customerId: z.coerce.number().int().positive().optional(),
  discount: z.coerce.number().min(0).optional().default(0),
})

const updateDraftSchema = z.object({
  items: z.array(saleItemSchema),
  discount: z.coerce.number().min(0).optional().default(0),
})

const finalizeDraftSchema = z.object({
  paymentType: z.nativeEnum(PaymentType),
  customerId: z.coerce.number().int().positive().optional(),
  discount: z.coerce.number().min(0).optional().default(0),
})

const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Ad soyad zorunludur'),
  phone: z.string().trim().optional(),
  note: z.string().trim().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz satış kimliği')

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSaleSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }

    const user = requireUser(req)
    if (parsed.data.paymentType === PaymentType.CREDIT && !parsed.data.customerId) {
      throw new AppError('Borç satışında müşteri seçimi zorunludur.', 400)
    }

    const sale = await salesService.createSale(parsed.data, user.id)
    success(res, sale, 'Satış tamamlandı', 201)
  } catch (error) {
    next(error)
  }
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    const shiftIdRaw = req.query.shiftId
    const shiftId =
      shiftIdRaw !== undefined && shiftIdRaw !== ''
        ? Number(shiftIdRaw)
        : undefined
    if (shiftId !== undefined && (!Number.isInteger(shiftId) || shiftId <= 0)) {
      throw new AppError('Geçersiz vardiya kimliği.', 400)
    }
    const sales = await salesService.listSales(user.id, user.role, shiftId)
    success(res, sales, 'Satışlar listelendi')
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }
    const user = requireUser(req)
    const sale = await salesService.getSaleById(idParsed.data, user.id, user.role)
    success(res, sale, 'Satış detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function listDrafts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    const drafts = await salesService.listDraftSales(user.id)
    success(res, drafts, 'Taslak satışlar listelendi')
  } catch (error) {
    next(error)
  }
}

export async function createDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    const draft = await salesService.createDraftSale(user.id)
    success(res, draft, 'Taslak satış oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function updateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }

    const parsed = updateDraftSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }

    const user = requireUser(req)
    const draft = await salesService.updateDraftSale(idParsed.data, user.id, parsed.data)
    success(res, draft, 'Taslak satış güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function finalizeDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }

    const parsed = finalizeDraftSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }

    const user = requireUser(req)
    if (parsed.data.paymentType === PaymentType.CREDIT && !parsed.data.customerId) {
      throw new AppError('Borç satışında müşteri seçimi zorunludur.', 400)
    }

    const sale = await salesService.finalizeDraftSale(idParsed.data, user.id, parsed.data)
    success(res, sale, 'Satış tamamlandı', 201)
  } catch (error) {
    next(error)
  }
}

export async function cancelDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }

    const user = requireUser(req)
    const result = await salesService.cancelDraftSale(idParsed.data, user.id)
    success(res, result, 'Taslak satış iptal edildi')
  } catch (error) {
    next(error)
  }
}

const cancelCompletedSchema = z.object({
  reason: z.string().trim().min(3, 'İptal nedeni en az 3 karakter olmalıdır'),
  forceAfterDayEnd: z.boolean().optional().default(false),
})

export async function cancelCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }
    const parsed = cancelCompletedSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }

    const user = requireUser(req)
    const sale = await salesService.cancelCompletedSale(
      idParsed.data,
      user.id,
      user.role,
      parsed.data,
    )
    success(res, sale, 'Satış iptal edildi')
  } catch (error) {
    next(error)
  }
}

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void req
    const customers = await salesService.listCustomers()
    success(res, customers, 'Müşteriler listelendi')
  } catch (error) {
    next(error)
  }
}

export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createCustomerSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const customer = await salesService.createCustomer(parsed.data)
    success(res, customer, 'Müşteri oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}
