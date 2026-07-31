import type { NextFunction, Request, Response } from 'express'
import { success } from '../utils/apiResponse'
import * as dashboardService from '../services/dashboard.service'

export async function getDashboard(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await dashboardService.getDashboard()
    success(res, data, 'Dashboard verisi getirildi')
  } catch (error) {
    next(error)
  }
}
