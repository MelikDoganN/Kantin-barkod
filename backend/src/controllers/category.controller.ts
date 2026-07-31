import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as categoryService from '../services/category.service'

const idSchema = z.coerce.number().int().positive('Geçersiz kategori kimliği')

const createSchema = z.object({
  name: z.string().trim().min(1, 'Kategori adı zorunludur'),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const updateSchema = z.object({
  name: z.string().trim().min(1, 'Kategori adı zorunludur'),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const statusSchema = z.object({
  isActive: z.boolean({ message: 'isActive boolean olmalıdır' }),
})

function actorId(req: Request): number {
  if (!req.user?.id) throw new AppError('Kimlik doğrulama gerekli.', 401)
  return req.user.id
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    void req
    const categories = await categoryService.listCategories()
    success(res, categories, 'Kategoriler listelendi')
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
    const category = await categoryService.createCategory(actorId(req), parsed.data)
    success(res, category, 'Kategori oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kategori kimliği', 400)
    }
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const category = await categoryService.updateCategory(actorId(req), idParsed.data, parsed.data)
    success(res, category, 'Kategori güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kategori kimliği', 400)
    }
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const category = await categoryService.updateCategoryStatus(
      actorId(req),
      idParsed.data,
      parsed.data.isActive,
    )
    success(res, category, 'Kategori durumu güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz kategori kimliği', 400)
    }
    const data = await categoryService.deleteCategory(actorId(req), idParsed.data)
    success(res, data, 'Kategori silindi.')
  } catch (error) {
    next(error)
  }
}
