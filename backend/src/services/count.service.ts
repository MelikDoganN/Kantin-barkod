import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { serializeProductBrief } from '../utils/product-image-url'

export type CountType = 'WAREHOUSE' | 'SHELF'
export type CountStatus = 'IN_PROGRESS' | 'COMPLETED'
export type ItemDiffStatus = 'SAME' | 'SHORTAGE' | 'EXCESS'

function itemStatus(difference: number | null | undefined): ItemDiffStatus | null {
  if (difference === null || difference === undefined) return null
  if (difference === 0) return 'SAME'
  if (difference < 0) return 'SHORTAGE'
  return 'EXCESS'
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    userId: number
    actionType: string
    title: string
    description?: string
    entityId: number
    entityLabel: string
    oldValues?: Prisma.InputJsonValue
    newValues?: Prisma.InputJsonValue
  },
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      module: 'COUNT',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'StockCount',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

function normalizeType(type: string): CountType {
  const upper = type.trim().toUpperCase()
  if (upper === 'WAREHOUSE' || upper === 'SHELF') return upper
  throw new AppError('Sayım tipi WAREHOUSE veya SHELF olmalıdır.', 400)
}

function typeLabel(type: string): string {
  return type === 'WAREHOUSE' ? 'Depo Sayımı' : 'Raf Sayımı'
}

function quantityForType(
  type: CountType,
  inventory: { warehouseQuantity: number; shelfQuantity: number } | null,
): number {
  if (!inventory) return 0
  return type === 'WAREHOUSE' ? inventory.warehouseQuantity : inventory.shelfQuantity
}

function formatListItem(count: {
  id: number
  type: string
  status: string
  date: Date
  description: string | null
  user: { fullName: string }
  items: Array<{ difference: number | null }>
}) {
  const productCount = count.items.length
  const totalDifference = count.items.reduce((sum, item) => sum + (item.difference ?? 0), 0)
  return {
    id: count.id,
    type: count.type,
    status: count.status,
    date: count.date.toISOString(),
    user: count.user.fullName,
    description: count.description,
    productCount,
    totalDifference,
  }
}

function itemResult(status: ItemDiffStatus | null): 'Eksik' | 'Fazla' | 'Aynı' | null {
  if (status === 'SHORTAGE') return 'Eksik'
  if (status === 'EXCESS') return 'Fazla'
  if (status === 'SAME') return 'Aynı'
  return null
}

async function loadCountOrThrow(id: number) {
  const count = await prisma.stockCount.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              barcode: true,
              image: true,
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { product: { name: 'asc' } },
      },
    },
  })
  if (!count) throw new AppError('Sayım bulunamadı.', 404)
  return count
}

function serializeDetail(count: Awaited<ReturnType<typeof loadCountOrThrow>>) {
  let shortage = 0
  let excess = 0
  let same = 0
  let pending = 0
  let totalMissingQuantity = 0
  let totalExcessQuantity = 0

  const items = count.items.map((item) => {
    const status = item.countedQuantity === null ? null : itemStatus(item.difference)
    if (status === 'SHORTAGE') {
      shortage += 1
      totalMissingQuantity += Math.abs(item.difference ?? 0)
    } else if (status === 'EXCESS') {
      excess += 1
      totalExcessQuantity += item.difference ?? 0
    } else if (status === 'SAME') same += 1
    else pending += 1

    return {
      id: item.id,
      productId: item.productId,
      product: serializeProductBrief(item.product),
      systemQuantity: item.systemQuantity,
      countedQuantity: item.countedQuantity,
      difference: item.difference,
      result: itemResult(status),
      note: item.note,
      status,
    }
  })

  const totalDifference = items.reduce((sum, item) => sum + (item.difference ?? 0), 0)

  return {
    id: count.id,
    type: count.type,
    status: count.status,
    date: count.date.toISOString(),
    description: count.description,
    startedAt: count.createdAt.toISOString(),
    completedAt:
      'completedAt' in count && count.completedAt
        ? count.completedAt.toISOString()
        : null,
    createdBy: {
      id: count.user.id,
      fullName: count.user.fullName,
      username: count.user.username,
    },
    user: count.user.fullName,
    userId: count.user.id,
    productCount: items.length,
    totalDifference,
    shortageCount: shortage,
    excessCount: excess,
    sameCount: same,
    pendingCount: pending,
    summary: {
      totalProducts: items.length,
      missingProducts: shortage,
      excessProducts: excess,
      unchangedProducts: same,
      totalMissingQuantity,
      totalExcessQuantity,
    },
    items,
  }
}

export async function listCounts(filters: {
  date?: string
  status?: string
  type?: string
} = {}) {
  const where: Prisma.StockCountWhereInput = {}

  if (filters.status) {
    where.status = filters.status.trim().toUpperCase()
  }
  if (filters.type) {
    where.type = normalizeType(filters.type)
  }
  if (filters.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
      throw new AppError('Tarih formatı YYYY-MM-DD olmalıdır.', 400)
    }
    const [y, m, d] = filters.date.split('-').map(Number)
    const start = new Date(y, m - 1, d, 0, 0, 0, 0)
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
    where.date = { gte: start, lt: end }
  }

  const rows = await prisma.stockCount.findMany({
    where,
    include: {
      user: { select: { fullName: true } },
      items: { select: { difference: true } },
    },
    orderBy: { date: 'desc' },
  })

  return rows.map(formatListItem)
}

export async function listHistory() {
  const rows = await prisma.stockCount.findMany({
    where: { status: 'COMPLETED' },
    include: {
      user: { select: { fullName: true } },
      items: { select: { difference: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })
  return rows.map(formatListItem)
}

export async function getCountSummary() {
  const [activeCount, lastCompleted, monthCounts] = await Promise.all([
    prisma.stockCount.count({ where: { status: 'IN_PROGRESS' } }),
    prisma.stockCount.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      include: { items: { select: { difference: true } } },
    }),
    prisma.stockCount.findMany({
      where: {
        status: 'COMPLETED',
        date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      include: { items: { select: { id: true, difference: true } } },
    }),
  ])

  const totalCountedProducts = monthCounts.reduce((sum, c) => sum + c.items.length, 0)
  const stockDifference = lastCompleted
    ? lastCompleted.items.reduce((sum, i) => sum + Math.abs(i.difference ?? 0), 0)
    : 0

  return {
    activeCount,
    lastCountDate: lastCompleted
      ? lastCompleted.date.toLocaleDateString('tr-TR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '—',
    totalCountedProducts,
    stockDifference,
  }
}

export async function getCountById(id: number) {
  const count = await loadCountOrThrow(id)
  return serializeDetail(count)
}

export async function getActiveCount() {
  const count = await prisma.stockCount.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { date: 'desc' },
    select: { id: true },
  })
  if (!count) return null
  return getCountById(count.id)
}

export async function startCount(input: {
  userId: number
  type: string
  description?: string
}) {
  const type = normalizeType(input.type)

  const existing = await prisma.stockCount.findFirst({
    where: { status: 'IN_PROGRESS' },
    select: { id: true },
  })
  if (existing) {
    throw new AppError('Devam eden bir sayım varken yeni sayım başlatılamaz.', 409)
  }

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { isActive: true },
      include: { inventory: true },
      orderBy: { name: 'asc' },
    })

    if (products.length === 0) {
      throw new AppError('Sayım için aktif ürün bulunamadı.', 400)
    }

    for (const product of products) {
      if (!product.inventory) {
        const created = await tx.inventory.create({
          data: { productId: product.id, warehouseQuantity: 0, shelfQuantity: 0 },
        })
        product.inventory = created
      }
    }

    const count = await tx.stockCount.create({
      data: {
        userId: input.userId,
        type,
        status: 'IN_PROGRESS',
        description: input.description?.trim() || null,
        items: {
          create: products.map((product) => ({
            productId: product.id,
            systemQuantity: quantityForType(type, product.inventory),
            countedQuantity: null,
            difference: null,
            note: null,
          })),
        },
      },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                image: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    })

    await writeAuditLog(tx, {
      userId: input.userId,
      actionType: 'COUNT_START',
      title: 'Sayım başlatıldı',
      description: `${typeLabel(type)} · ${products.length} ürün`,
      entityId: count.id,
      entityLabel: `Sayım #${count.id}`,
      newValues: { type, productCount: products.length, status: 'IN_PROGRESS' },
    })

    return serializeDetail(count)
  })
}

export async function updateCountItem(input: {
  countId: number
  itemId: number
  countedQuantity: number
  note?: string
}) {
  if (!Number.isFinite(input.countedQuantity) || input.countedQuantity < 0) {
    throw new AppError('Sayım miktarı 0 veya daha büyük olmalıdır.', 400)
  }
  const countedQuantity = Math.floor(input.countedQuantity)

  return prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({ where: { id: input.countId } })
    if (!count) throw new AppError('Sayım bulunamadı.', 404)
    if (count.status === 'COMPLETED') {
      throw new AppError('Tamamlanan sayım değiştirilemez.', 400)
    }

    const item = await tx.stockCountItem.findFirst({
      where: { id: input.itemId, stockCountId: input.countId },
    })
    if (!item) throw new AppError('Sayım kalemi bulunamadı.', 404)

    const difference = countedQuantity - item.systemQuantity
    const updated = await tx.stockCountItem.update({
      where: { id: item.id },
      data: {
        countedQuantity,
        difference,
        note: input.note !== undefined ? input.note.trim() || null : undefined,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            image: true,
            category: { select: { id: true, name: true } },
          },
        },
      },
    })

    return {
      id: updated.id,
      productId: updated.productId,
      product: serializeProductBrief(updated.product),
      systemQuantity: updated.systemQuantity,
      countedQuantity: updated.countedQuantity,
      difference: updated.difference,
      result: itemResult(itemStatus(updated.difference)),
      note: updated.note,
      status: itemStatus(updated.difference),
    }
  })
}

export async function completeCount(countId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.stockCount.findUnique({
      where: { id: countId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!count) throw new AppError('Sayım bulunamadı.', 404)
    if (count.status === 'COMPLETED') {
      throw new AppError('Bu sayım zaten tamamlanmış.', 400)
    }

    const pending = count.items.filter((i) => i.countedQuantity === null)
    if (pending.length > 0) {
      throw new AppError('Tüm ürünlerin sayımı girilmiş olmalıdır.', 400)
    }

    const type = normalizeType(count.type)
    let adjusted = 0

    for (const item of count.items) {
      const counted = item.countedQuantity as number
      const difference = counted - item.systemQuantity
      if (difference === 0) continue

      let inventory = await tx.inventory.findUnique({ where: { productId: item.productId } })
      if (!inventory) {
        inventory = await tx.inventory.create({
          data: { productId: item.productId, warehouseQuantity: 0, shelfQuantity: 0 },
        })
      }

      const beforeWarehouse = inventory.warehouseQuantity
      const beforeShelf = inventory.shelfQuantity
      const afterWarehouse = type === 'WAREHOUSE' ? counted : beforeWarehouse
      const afterShelf = type === 'SHELF' ? counted : beforeShelf

      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          warehouseQuantity: afterWarehouse,
          shelfQuantity: afterShelf,
        },
      })

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: StockMovementType.COUNT_ADJUSTMENT,
          quantity: difference,
          beforeWarehouse,
          afterWarehouse,
          beforeShelf,
          afterShelf,
          description: `Sayım #${count.id} düzeltmesi`,
          userId,
        },
      })

      await tx.auditLog.create({
        data: {
          userId,
          module: 'STOCK',
          actionType: 'COUNT_ADJUSTMENT',
          title: 'Sayım stok düzeltmesi',
          description: `${item.product.name}: ${difference > 0 ? '+' : ''}${difference}`,
          entityType: 'Product',
          entityId: item.productId,
          entityLabel: item.product.name,
          oldValues: { warehouseQuantity: beforeWarehouse, shelfQuantity: beforeShelf },
          newValues: { warehouseQuantity: afterWarehouse, shelfQuantity: afterShelf },
        },
      })

      adjusted += 1
    }

    const completed = await tx.stockCount.update({
      where: { id: count.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      } as Prisma.StockCountUpdateInput,
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                barcode: true,
                image: true,
                category: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    })

    const totalDifference = completed.items.reduce((sum, i) => sum + (i.difference ?? 0), 0)

    await writeAuditLog(tx, {
      userId,
      actionType: 'COUNT_COMPLETE',
      title: 'Sayım tamamlandı',
      description: `${typeLabel(type)} · ${adjusted} ürün düzeltildi`,
      entityId: count.id,
      entityLabel: `Sayım #${count.id}`,
      newValues: {
        status: 'COMPLETED',
        productCount: completed.items.length,
        adjustedProducts: adjusted,
        totalDifference,
      },
    })

    return serializeDetail(completed)
  })
}
