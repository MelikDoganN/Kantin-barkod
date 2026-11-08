import { Prisma } from '@prisma/client'
import { prisma, type AppTransactionClient } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'
import {
  deleteProductImageFile,
  saveProductImageBuffer,
  validateProductImageFile,
} from '../utils/product-image'

export interface ProductInput {
  name: string
  barcode?: string | null
  categoryId: number
  purchasePrice: number
  salePrice: number
  unitType?: string
  unitsPerCarton?: number
  minimumStock?: number
  image?: string | null
}

function decimalToNumber(value: { toString(): string } | number): number {
  const amount = typeof value === 'number' ? value : Number(value.toString())
  return Math.round((amount + Number.EPSILON) * 100) / 100
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function serializeProduct<T extends {
  purchasePrice: { toString(): string } | number
  salePrice: { toString(): string } | number
  image?: string | null
}>(product: T) {
  const imagePath = product.image ?? null
  const { image: _image, ...rest } = product as T & { image?: string | null }
  return {
    ...rest,
    purchasePrice: decimalToNumber(product.purchasePrice),
    salePrice: decimalToNumber(product.salePrice),
    imagePath,
    imageUrl: buildImageUrl(imagePath),
    image: imagePath,
  }
}

const productInclude = {
  category: { select: { id: true, name: true, isActive: true } },
  inventory: {
    select: {
      warehouseQuantity: true,
      shelfQuantity: true,
    },
  },
} as const

async function writeProductAudit(params: {
  userId: number
  actionType: string
  title: string
  description?: string
  entityId: number
  entityLabel: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
}, database: Pick<AppTransactionClient, 'auditLog'> = prisma) {
  await database.auditLog.create({
    data: {
      userId: params.userId,
      module: 'PRODUCT',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Product',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

async function assertCategoryExists(categoryId: number) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } })
  if (!category) {
    throw new AppError('Kategori bulunamadı.', 404)
  }
  return category
}

/** Yeni ürün veya kategori değişikliğinde yalnızca aktif kategori kabul edilir. */
async function assertCategoryAssignable(categoryId: number, currentCategoryId?: number) {
  const category = await assertCategoryExists(categoryId)
  if (!category.isActive && categoryId !== currentCategoryId) {
    throw new AppError('Pasif kategoriye ürün atanamaz.', 400)
  }
  return category
}

async function assertBarcodeUnique(barcode: string | null | undefined, excludeId?: number) {
  if (!barcode) return
  const existing = await prisma.product.findFirst({
    where: {
      barcode,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  })
  if (existing) {
    throw new AppError('Bu barkod başka bir üründe kullanılıyor.', 409)
  }
}

export async function listProducts() {
  const products = await prisma.product.findMany({
    include: productInclude,
    orderBy: { name: 'asc' },
  })
  return products.map(serializeProduct)
}

export async function getProductById(id: number) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: productInclude,
  })
  if (!product) {
    throw new AppError('Ürün bulunamadı.', 404)
  }
  return serializeProduct(product)
}

export async function getProductByBarcode(barcode: string) {
  const normalized = barcode.trim()
  if (!normalized) {
    throw new AppError('Barkod zorunludur.', 400)
  }

  const product = await prisma.product.findUnique({
    where: { barcode: normalized },
    include: productInclude,
  })

  if (!product || !product.isActive) {
    throw new AppError('Barkoda ait aktif ürün bulunamadı.', 404)
  }

  return serializeProduct(product)
}

export async function createProduct(input: ProductInput) {
  await assertCategoryAssignable(input.categoryId)
  const barcode = input.barcode?.trim() ? input.barcode.trim() : null
  await assertBarcodeUnique(barcode)

  if (input.purchasePrice <= 0 || input.salePrice <= 0) {
    throw new AppError('Fiyatlar 0\'dan büyük olmalıdır.', 400)
  }

  const product = await prisma.product.create({
    data: {
      name: input.name.trim(),
      barcode,
      categoryId: input.categoryId,
      purchasePrice: money(input.purchasePrice),
      salePrice: money(input.salePrice),
      unitType: input.unitType ?? 'unit',
      unitsPerCarton: input.unitsPerCarton ?? 1,
      minimumStock: input.minimumStock ?? 0,
      image: input.image ?? null,
      isActive: true,
      inventory: {
        create: {
          warehouseQuantity: 0,
          shelfQuantity: 0,
        },
      },
    },
    include: productInclude,
  })

  return serializeProduct(product)
}

export async function updateProduct(id: number, input: ProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Ürün bulunamadı.', 404)
  }

  await assertCategoryAssignable(input.categoryId, existing.categoryId)
  const barcode = input.barcode?.trim() ? input.barcode.trim() : null
  await assertBarcodeUnique(barcode, id)

  if (input.purchasePrice <= 0 || input.salePrice <= 0) {
    throw new AppError('Fiyatlar 0\'dan büyük olmalıdır.', 400)
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: input.name.trim(),
      barcode,
      categoryId: input.categoryId,
      purchasePrice: money(input.purchasePrice),
      salePrice: money(input.salePrice),
      unitType: input.unitType ?? existing.unitType,
      unitsPerCarton: input.unitsPerCarton ?? existing.unitsPerCarton,
      minimumStock: input.minimumStock ?? existing.minimumStock,
      image: input.image === undefined ? existing.image : input.image,
    },
    include: productInclude,
  })

  return serializeProduct(product)
}

export async function updateProductStatus(id: number, isActive: boolean) {
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Ürün bulunamadı.', 404)
  }

  const product = await prisma.product.update({
    where: { id },
    data: { isActive },
    include: productInclude,
  })

  return serializeProduct(product)
}

export async function deleteProduct(id: number, userId: number) {
  const existing = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          saleItems: true,
          stockMovements: true,
          personnelConsumptions: true,
          stockCountItems: true,
          wasteRecords: true,
        },
      },
    },
  })

  if (!existing) {
    throw new AppError('Ürün bulunamadı.', 404)
  }

  const historyCount =
    existing._count.saleItems +
    existing._count.stockMovements +
    existing._count.personnelConsumptions +
    existing._count.stockCountItems +
    existing._count.wasteRecords

  if (historyCount > 0) {
    throw new AppError(
      'Bu ürün geçmiş işlemlerde kullanıldığı için kalıcı olarak silinemez. Ürün pasife alınabilir.',
      409,
      'PRODUCT_HAS_HISTORY',
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.inventory.deleteMany({ where: { productId: id } })
    await tx.product.delete({ where: { id } })
    await writeProductAudit({
      userId, actionType: 'DELETE_PRODUCT', title: 'Ürün silindi',
      description: existing.name, entityId: id, entityLabel: existing.name,
      oldValues: { name: existing.name, barcode: existing.barcode, categoryId: existing.categoryId },
      newValues: { status: 'SUCCESS' },
    }, tx)
  })

  deleteProductImageFile(existing.image)

  return { id }
}

export async function uploadProductImage(
  id: number,
  userId: number,
  file: Express.Multer.File,
) {
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Ürün bulunamadı.', 404)
  }

  let ext: string
  try {
    ;({ ext } = validateProductImageFile(file))
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : 'Geçersiz görsel.', 400)
  }

  const imagePath = saveProductImageBuffer(file.buffer, ext)
  const previous = existing.image

  const product = await prisma.product.update({
    where: { id },
    data: { image: imagePath },
  })

  if (previous && previous !== imagePath) {
    deleteProductImageFile(previous)
  }

  await writeProductAudit({
    userId,
    actionType: 'UPDATE_PRODUCT_IMAGE',
    title: 'Ürün görseli güncellendi',
    description: existing.name,
    entityId: id,
    entityLabel: existing.name,
    oldValues: { imagePath: previous },
    newValues: { imagePath },
  })

  return {
    id: product.id,
    imagePath,
    imageUrl: buildImageUrl(imagePath),
  }
}

export async function deleteProductImage(id: number, userId: number) {
  const existing = await prisma.product.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Ürün bulunamadı.', 404)
  }

  if (existing.image) {
    deleteProductImageFile(existing.image)
  }

  await prisma.product.update({
    where: { id },
    data: { image: null },
  })

  await writeProductAudit({
    userId,
    actionType: 'UPDATE_PRODUCT_IMAGE',
    title: 'Ürün görseli kaldırıldı',
    description: existing.name,
    entityId: id,
    entityLabel: existing.name,
    oldValues: { imagePath: existing.image },
    newValues: { imagePath: null },
  })

  return {
    id,
    imagePath: null,
    imageUrl: null,
  }
}
