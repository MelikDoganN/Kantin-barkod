import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'

function serializeCategory(row: {
  id: number
  name: string
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  _count?: { products: number }
}) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    productCount: row._count?.products ?? 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function writeCategoryAudit(params: {
  userId: number
  actionType: string
  title: string
  description?: string
  entityId: number
  entityLabel: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      module: 'CATEGORY',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Category',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

export async function listCategories() {
  const rows = await prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  })
  return rows.map(serializeCategory)
}

export async function createCategory(
  userId: number,
  input: { name: string; description?: string | null; isActive?: boolean },
) {
  const name = input.name.trim()
  if (!name) throw new AppError('Kategori adı zorunludur.', 400)

  const existing = await prisma.category.findUnique({ where: { name } })
  if (existing) {
    throw new AppError('Bu isimde bir kategori zaten mevcut.', 409)
  }

  const description = input.description?.trim() ? input.description.trim() : null
  const isActive = input.isActive ?? true

  const category = await prisma.category.create({
    data: { name, description, isActive },
    include: { _count: { select: { products: true } } },
  })

  await writeCategoryAudit({
    userId,
    actionType: 'CREATE_CATEGORY',
    title: 'Kategori oluşturuldu',
    description: name,
    entityId: category.id,
    entityLabel: name,
    newValues: { name, description, isActive },
  })

  return serializeCategory(category)
}

export async function updateCategory(
  userId: number,
  id: number,
  input: { name: string; description?: string | null; isActive?: boolean },
) {
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) {
    throw new AppError('Kategori bulunamadı.', 404)
  }

  const name = input.name.trim()
  if (!name) throw new AppError('Kategori adı zorunludur.', 400)

  const duplicate = await prisma.category.findFirst({
    where: { name, NOT: { id } },
  })
  if (duplicate) {
    throw new AppError('Bu isimde bir kategori zaten mevcut.', 409)
  }

  const description =
    input.description === undefined
      ? category.description
      : input.description?.trim()
        ? input.description.trim()
        : null
  const isActive = input.isActive === undefined ? category.isActive : input.isActive

  const updated = await prisma.category.update({
    where: { id },
    data: { name, description, isActive },
    include: { _count: { select: { products: true } } },
  })

  await writeCategoryAudit({
    userId,
    actionType: 'UPDATE_CATEGORY',
    title: 'Kategori güncellendi',
    description: name,
    entityId: id,
    entityLabel: name,
    oldValues: {
      name: category.name,
      description: category.description,
      isActive: category.isActive,
    },
    newValues: { name, description, isActive },
  })

  return serializeCategory(updated)
}

export async function updateCategoryStatus(userId: number, id: number, isActive: boolean) {
  const category = await prisma.category.findUnique({ where: { id } })
  if (!category) {
    throw new AppError('Kategori bulunamadı.', 404)
  }

  const updated = await prisma.category.update({
    where: { id },
    data: { isActive },
    include: { _count: { select: { products: true } } },
  })

  await writeCategoryAudit({
    userId,
    actionType: 'UPDATE_CATEGORY_STATUS',
    title: isActive ? 'Kategori aktif yapıldı' : 'Kategori pasife alındı',
    description: category.name,
    entityId: id,
    entityLabel: category.name,
    oldValues: { isActive: category.isActive },
    newValues: { isActive },
  })

  return serializeCategory(updated)
}

export async function deleteCategory(userId: number, id: number) {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  })
  if (!category) {
    throw new AppError('Kategori bulunamadı.', 404)
  }

  if (category._count.products > 0) {
    throw new AppError('Bu kategoriye bağlı ürünler bulunduğu için silinemez.', 409, 'CATEGORY_HAS_PRODUCTS')
  }

  await prisma.$transaction(async (tx) => {
    await tx.category.delete({ where: { id } })
    await tx.auditLog.create({
      data: {
        userId,
        module: 'CATEGORY',
        actionType: 'DELETE_CATEGORY',
        title: 'Kategori silindi',
        description: category.name,
        entityType: 'Category',
        entityId: id,
        entityLabel: category.name,
        oldValues: {
          name: category.name,
          description: category.description,
          isActive: category.isActive,
        },
      },
    })
  })

  return { id }
}
