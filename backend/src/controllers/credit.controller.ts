import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as creditService from '../services/credit.service'

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
})

const idSchema = z.coerce.number().int().positive('Geçersiz müşteri kimliği')
const saleIdSchema = z.coerce.number().int().positive('Geçersiz satış kimliği')

const paymentSchema = z.object({
  customerId: z.coerce.number().int().positive('Müşteri zorunludur'),
  amount: z.coerce.number().positive('Ödeme tutarı 0’dan büyük olmalıdır'),
  note: z.string().trim().optional(),
})

const createCustomerSchema = z.object({
  fullName: z.string().trim().min(1, 'Ad soyad zorunludur'),
  phone: z.string().trim().optional().nullable(),
  openingDebt: z.coerce.number().min(0, 'Açılış borcu negatif olamaz').optional(),
  note: z.string().trim().optional().nullable(),
})

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const data = await creditService.listCreditCustomers(parsed.data.search)
    success(res, data, 'Borçlu listesi getirildi')
  } catch (error) {
    next(error)
  }
}

export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    const data = await creditService.getCreditCustomerDetail(idParsed.data)
    success(res, data, 'Borç detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function getCustomerSale(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const saleParsed = saleIdSchema.safeParse(req.params.saleId)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz müşteri kimliği', 400)
    }
    if (!saleParsed.success) {
      throw new AppError(saleParsed.error.issues[0]?.message ?? 'Geçersiz satış kimliği', 400)
    }
    const data = await creditService.getCreditSaleDetail(idParsed.data, saleParsed.data)
    success(res, data, 'Borç satış detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function payment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = paymentSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await creditService.collectPayment({
      userId: user.id,
      customerId: parsed.data.customerId,
      amount: parsed.data.amount,
      note: parsed.data.note,
    })
    success(res, data, 'Tahsilat kaydedildi')
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
    const user = requireUser(req)
    const data = await creditService.createDebtCustomer({
      userId: user.id,
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      openingDebt: parsed.data.openingDebt,
      note: parsed.data.note,
    })
    success(res, data, 'Borçlu hesabı oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function summary(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await creditService.getCreditSummary()
    success(res, data, 'Borç özeti getirildi')
  } catch (error) {
    next(error)
  }
}
