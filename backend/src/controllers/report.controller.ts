import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as reportService from '../services/report.service'

const dateQuerySchema = z.object({
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
})

function parseDates(query: unknown) {
  const parsed = dateQuerySchema.safeParse(query)
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
  }
  return parsed.data
}

export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getSummary(startDate, endDate)
    success(res, data, 'Rapor özeti getirildi')
  } catch (error) {
    next(error)
  }
}

export async function salesTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getSalesTrend(startDate, endDate)
    success(res, data, 'Satış trendi getirildi')
  } catch (error) {
    next(error)
  }
}

export async function paymentSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getPaymentSummary(startDate, endDate)
    success(res, data, 'Ödeme dağılımı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function topProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getTopProducts(startDate, endDate)
    success(res, data, 'En çok satan ürünler getirildi')
  } catch (error) {
    next(error)
  }
}

export async function stock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await reportService.getStockReport()
    success(res, data, 'Stok raporu getirildi')
  } catch (error) {
    next(error)
  }
}

export async function personnel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getPersonnelReport(startDate, endDate)
    success(res, data, 'Personel performansı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function dayEnd(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await reportService.getDayEndReport()
    success(res, data, 'Gün sonu raporu getirildi')
  } catch (error) {
    next(error)
  }
}

export async function consumption(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { startDate, endDate } = parseDates(req.query)
    const data = await reportService.getConsumptionSummary(startDate, endDate)
    success(res, data, 'Tüketim özeti getirildi')
  } catch (error) {
    next(error)
  }
}
