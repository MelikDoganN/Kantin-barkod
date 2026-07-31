import type { NextFunction, Request, Response } from 'express'
import { failure } from '../utils/apiResponse'

export class AppError extends Error {
  statusCode: number
  code?: string

  constructor(message: string, statusCode = 400, code?: string) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.name = 'AppError'
  }
}

export function notFoundHandler(_req: Request, res: Response): Response {
  return failure(res, 'İstenen kaynak bulunamadı.', 404)
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): Response {
  const statusCode = err instanceof AppError ? err.statusCode : 500
  const message =
    err instanceof Error ? err.message : 'Beklenmeyen bir sunucu hatası oluştu.'
  const code = err instanceof AppError ? err.code : undefined

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[HATA]', err)
  }

  return failure(res, message, statusCode, code)
}
