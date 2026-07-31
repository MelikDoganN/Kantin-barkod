import type { NextFunction, Request, Response } from 'express'
import { failure } from '../utils/apiResponse'
import { verifyToken } from '../utils/jwt'

// Authorization: Bearer <token> başlığını doğrular ve req.user'a yazar.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    failure(res, 'Yetkilendirme başlığı bulunamadı.', 401)
    return
  }

  const token = header.slice('Bearer '.length).trim()

  if (!token) {
    failure(res, 'Token bulunamadı.', 401)
    return
  }

  try {
    req.user = verifyToken(token)
    next()
  } catch {
    failure(res, 'Geçersiz veya süresi dolmuş token.', 401)
  }
}
