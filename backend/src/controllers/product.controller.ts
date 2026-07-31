import type { NextFunction, Request, Response } from 'express'
import { z } from 'zod'
import { AppError } from '../middleware/errorHandler'
import { success } from '../utils/apiResponse'
import * as productService from '../services/product.service'

const idSchema = z.coerce.number().int().positive('Geçersiz ürün kimliği')

const productSchema = z.object({
  name: z.string().trim().min(1, 'Ürün adı zorunludur'),
  barcode: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  categoryId: z.coerce.number().int().positive('Kategori zorunludur'),
  purchasePrice: z.coerce.number().positive('Alış fiyatı 0\'dan büyük olmalıdır'),
  salePrice: z.coerce.number().positive('Satış fiyatı 0\'dan büyük olmalıdır'),
  unitType: z.string().trim().optional().default('unit'),
  unitsPerCarton: z.coerce.number().int().positive().optional().default(1),
  minimumStock: z.coerce.number().int().min(0).optional().default(0),
  image: z.string().trim().optional().nullable(),
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
    const products = await productService.listProducts()
    success(res, products, 'Ürünler listelendi')
  } catch (error) {
    next(error)
  }
}

export async function getByBarcode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const barcode = String(req.params.barcode ?? '').trim()
    if (!barcode) {
      throw new AppError('Barkod zorunludur.', 400)
    }
    const product = await productService.getProductByBarcode(barcode)
    success(res, product, 'Ürün bulundu')
  } catch (error) {
    next(error)
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = productSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const product = await productService.createProduct(parsed.data)
    success(res, product, 'Ürün oluşturuldu', 201)
  } catch (error) {
    next(error)
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz ürün kimliği', 400)
    }
    const parsed = productSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const product = await productService.updateProduct(idParsed.data, parsed.data)
    success(res, product, 'Ürün güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz ürün kimliği', 400)
    }
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0]?.message ?? 'Geçersiz istek', 400)
    }
    const product = await productService.updateProductStatus(idParsed.data, parsed.data.isActive)
    success(res, product, 'Ürün durumu güncellendi')
  } catch (error) {
    next(error)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz ürün kimliği', 400)
    }
    const data = await productService.deleteProduct(idParsed.data, actorId(req))
    success(res, data, 'Ürün silindi.')
  } catch (error) {
    next(error)
  }
}

export async function uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz ürün kimliği', 400)
    }
    if (!req.file) {
      throw new AppError('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.', 400)
    }
    const data = await productService.uploadProductImage(idParsed.data, actorId(req), req.file)
    success(res, data, 'Ürün görseli güncellendi.')
  } catch (error) {
    next(error)
  }
}

export async function removeImage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParsed = idSchema.safeParse(req.params.id)
    if (!idParsed.success) {
      throw new AppError(idParsed.error.issues[0]?.message ?? 'Geçersiz ürün kimliği', 400)
    }
    const data = await productService.deleteProductImage(idParsed.data, actorId(req))
    success(res, data, 'Ürün görseli kaldırıldı.')
  } catch (error) {
    next(error)
  }
}
