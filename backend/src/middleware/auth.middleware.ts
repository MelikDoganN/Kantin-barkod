import type { NextFunction, Request, Response } from 'express'
import { failure } from '../utils/apiResponse'
import { prisma } from '../config/database'
import { verifyToken } from '../utils/jwt'

// Authorization: Bearer <token> başlığını doğrular ve req.user'a yazar.
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
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
  } catch {
    failure(res, 'Geçersiz veya süresi dolmuş token.', 401)
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user || user.status !== 'ACTIVE') {
      failure(res, 'Kullanıcı hesabı aktif değil.', 401)
      return
    }
    req.user = { id: user.id, username: user.username, role: user.role }
    next()
  } catch (error) {
    next(error)
  }
}
