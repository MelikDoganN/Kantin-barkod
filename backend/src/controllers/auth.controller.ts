import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as authService from '../services/auth.service'

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Kullanıcı adı zorunludur'),
  password: z.string().min(1, 'Şifre zorunludur'),
})

function getContext(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  const ipAddress =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0]?.trim()) ??
    req.socket.remoteAddress ??
    null
  const userAgent = req.headers['user-agent'] ?? null
  return { deviceName: userAgent, ipAddress }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Geçersiz istek'
      throw new AppError(message, 400)
    }

    const { username, password } = parsed.data
    const result = await authService.login(username, password, getContext(req))

    success(res, result, 'Giriş başarılı')
  } catch (error) {
    next(error)
  }
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Yetkisiz erişim', 401)
    }

    const user = await authService.getUserById(req.user.id)
    if (!user) {
      throw new AppError('Kullanıcı bulunamadı', 404)
    }

    success(res, { user }, 'Kullanıcı bilgisi getirildi')
  } catch (error) {
    next(error)
  }
}

export function logout(_req: Request, res: Response): void {
  success(res, null, 'Çıkış başarılı')
}
