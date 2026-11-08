import type { RequestHandler } from 'express'
import { AppError } from './errorHandler'

let activeRequests = 0
let maintenance = false

export const databaseMaintenance: RequestHandler = (_req, res, next) => {
  if (maintenance) return next(new AppError('Veritabanı geri yükleniyor. Lütfen biraz bekleyin.', 503))
  activeRequests++
  let finished = false
  const release = () => {
    if (!finished) activeRequests--
    finished = true
  }
  res.once('finish', release)
  res.once('close', release)
  next()
}

export function beginDatabaseMaintenance(): void {
  if (maintenance || activeRequests > 1) {
    throw new AppError('Başka işlemler devam ediyor. Geri yüklemeyi biraz sonra tekrar deneyin.', 409)
  }
  maintenance = true
}

export function endDatabaseMaintenance(): void {
  maintenance = false
}
