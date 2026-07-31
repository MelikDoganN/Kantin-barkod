import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as userService from '../services/user.service'

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  role: z.string().trim().optional(),
  status: z.string().trim().optional(),
})

const createSchema = z.object({
  fullName: z.string().trim().min(1, 'Ad soyad zorunludur'),
  username: z.string().trim().min(1, 'Kullanıcı adı zorunludur'),
  phone: z.string().trim().optional(),
  password: z.string().min(4, 'Şifre en az 4 karakter olmalıdır'),
  passwordConfirm: z.string().min(4, 'Şifre tekrarı zorunludur'),
  role: z.enum(['ADMIN', 'PERSONNEL']),
  status: z.enum(['ACTIVE', 'PASSIVE']),
})

const updateSchema = z.object({
  fullName: z.string().trim().min(1).optional(),
  username: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullable().optional(),
  role: z.enum(['ADMIN', 'PERSONNEL']).optional(),
  status: z.enum(['ACTIVE', 'PASSIVE']).optional(),
})

const statusSchema = z.object({
  status: z.enum(['ACTIVE', 'PASSIVE']),
})

const resetSchema = z.object({
  newPassword: z.string().min(4, 'Şifre en az 4 karakter olmalıdır'),
  newPasswordConfirm: z.string().min(4, 'Şifre tekrarı zorunludur'),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre zorunludur'),
  newPassword: z.string().min(4, 'Yeni şifre en az 4 karakter olmalıdır'),
  newPasswordConfirm: z.string().min(4, 'Yeni şifre tekrarı zorunludur'),
})

const idSchema = z.coerce.number().int().positive('Geçersiz kullanıcı kimliği')

function requireUser(req: Request) {
  if (!req.user?.id || !req.user.role) {
    throw new AppError('Yetkisiz erişim.', 401)
  }
  return req.user
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz filtre', 400)
    }
    const data = await userService.listUsers(parsed.data)
    success(res, data, 'Kullanıcılar listelendi')
  } catch (error) {
    next(error)
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    const data = await userService.getUserDetail(idParsed.data)
    success(res, data, 'Kullanıcı detayı getirildi')
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await userService.createUser(user.id, parsed.data)
    success(res, data, 'Kullanıcı oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const bodyParsed = updateSchema.safeParse(req.body)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    if (!bodyParsed.success) {
      throw new AppError(bodyParsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await userService.updateUser(user.id, idParsed.data, bodyParsed.data)
    success(res, data, 'Kullanıcı güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const bodyParsed = statusSchema.safeParse(req.body)
    if (!idParsed.success || !bodyParsed.success) {
      throw new AppError('Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await userService.updateUserStatus(user.id, idParsed.data, bodyParsed.data.status)
    success(res, data, 'Kullanıcı durumu güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    const bodyParsed = resetSchema.safeParse(req.body)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kimlik', 400)
    }
    if (!bodyParsed.success) {
      throw new AppError(bodyParsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const user = requireUser(req)
    const data = await userService.resetPassword(user.id, idParsed.data, bodyParsed.data)
    success(res, data, 'Şifre sıfırlandı')
  } catch (error) {
    next(error)
  }
}

export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = requireUser(req)
    if (user.role !== 'ADMIN') {
      throw new AppError('Bu işlem için yetkiniz yok.', 403)
    }

    const parsed = changePasswordSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }

    await userService.changeOwnPassword(user.id, parsed.data)
    success(res, { success: true }, 'Şifreniz başarıyla değiştirildi.')
  } catch (error) {
    next(error)
  }
}
