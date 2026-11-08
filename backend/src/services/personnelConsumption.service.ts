import { Prisma } from '@prisma/client'
import { StockMovementType, UserRole, UserStatus } from '../types/enums'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'

const ALLOWED_REASONS = new Set(['meal', 'drink', 'treat', 'test', 'other'])

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function decimal(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

function monthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  return { start, end }
}

function serializeRecord(row: {
  id: number
  quantity: number
  cost: { toString(): string } | number
  reason: string
  note: string | null
  createdAt: Date
  user: { id: number; fullName: string; username: string }
  product: {
    id: number
    name: string
    barcode: string | null
    image: string | null
    purchasePrice: { toString(): string } | number
  }
}) {
  const cost = round2(toNumber(row.cost))
  const unitCost = row.quantity > 0 ? round2(cost / row.quantity) : round2(toNumber(row.product.purchasePrice))
  const imagePath = row.product.image ?? null
  return {
    id: row.id,
    date: row.createdAt.toLocaleDateString('tr-TR'),
    time: row.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    createdAt: row.createdAt.toISOString(),
    personnelId: row.user.id,
    personnel: row.user.fullName,
    personnelUsername: row.user.username,
    productId: row.product.id,
    product: row.product.name,
    barcode: row.product.barcode,
    imagePath,
    imageUrl: buildImageUrl(imagePath),
    quantity: row.quantity,
    unitCost,
    cost,
    reason: row.reason,
    note: row.note,
    createdBy: row.user.fullName,
  }
}

export async function listPersonnelOptions() {
  const users = await prisma.user.findMany({
    where: {
      status: UserStatus.ACTIVE,
      role: { in: [UserRole.PERSONNEL, UserRole.ADMIN] },
    },
    select: { id: true, fullName: true, username: true, role: true },
    orderBy: { fullName: 'asc' },
  })
  return users.map((u) => ({
    id: u.id,
    name: u.fullName,
    username: u.username,
    role: u.role,
  }))
}

export async function createConsumption(input: {
  actorId: number
  actorRole: string
  productId: number
  quantity: number
  reason: string
  note?: string
  userId?: number
}) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new AppError('Miktar 0’dan büyük bir tam sayı olmalıdır.', 400)
  }
  if (!ALLOWED_REASONS.has(input.reason)) {
    throw new AppError('Geçersiz tüketim sebebi.', 400)
  }

  let consumerId = input.actorId
  if (input.actorRole === 'ADMIN') {
    if (input.userId !== undefined) {
      consumerId = input.userId
    }
  } else if (input.userId !== undefined && input.userId !== input.actorId) {
    throw new AppError('Personel başka kullanıcı adına kayıt oluşturamaz.', 403)
  }

  return prisma.$transaction(async (tx) => {
    const consumer = await tx.user.findUnique({
      where: { id: consumerId },
      select: { id: true, fullName: true, username: true, status: true },
    })
    if (!consumer) throw new AppError('Personel bulunamadı.', 404)
    if (consumer.status !== UserStatus.ACTIVE) {
      throw new AppError('Pasif kullanıcı için tüketim kaydı oluşturulamaz.', 400)
    }

    const product = await tx.product.findUnique({
      where: { id: input.productId },
      include: { inventory: true },
    })
    if (!product || !product.isActive) {
      throw new AppError('Ürün bulunamadı.', 404)
    }

    let inventory = product.inventory
    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { productId: product.id, warehouseQuantity: 0, shelfQuantity: 0 },
      })
    }

    if (inventory.shelfQuantity < input.quantity) {
      throw new AppError('Yetersiz raf stoğu', 400)
    }

    const unitCost = round2(toNumber(product.purchasePrice))
    const cost = round2(unitCost * input.quantity)
    const beforeWarehouse = inventory.warehouseQuantity
    const beforeShelf = inventory.shelfQuantity
    const afterWarehouse = beforeWarehouse
    const afterShelf = beforeShelf - input.quantity

    if (afterShelf < 0) {
      throw new AppError('Stok negatif olamaz.', 400)
    }

    await tx.inventory.update({
      where: { id: inventory.id },
      data: { shelfQuantity: afterShelf },
    })

    const record = await tx.personnelConsumption.create({
      data: {
        userId: consumer.id,
        productId: product.id,
        quantity: input.quantity,
        cost: decimal(cost),
        reason: input.reason,
        note: input.note?.trim() || null,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            image: true,
            purchasePrice: true,
          },
        },
      },
    })

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.PERSONNEL_CONSUMPTION,
        quantity: input.quantity,
        beforeWarehouse,
        afterWarehouse,
        beforeShelf,
        afterShelf,
        description:
          input.note?.trim() ||
          `Personel tüketimi · ${consumer.fullName} · ${product.name}`,
        userId: input.actorId,
      },
    })

    await tx.auditLog.create({
      data: {
        userId: input.actorId,
        module: 'PERSONNEL_CONSUMPTION',
        actionType: 'CREATE',
        title: 'Personel tüketimi kaydı',
        description: `${consumer.fullName} · ${product.name} × ${input.quantity}`,
        entityType: 'PersonnelConsumption',
        entityId: record.id,
        entityLabel: `${product.name} × ${input.quantity}`,
        oldValues: { shelfQuantity: beforeShelf },
        newValues: {
          shelfQuantity: afterShelf,
          quantity: input.quantity,
          cost,
          reason: input.reason,
          consumerId: consumer.id,
        },
      },
    })

    return serializeRecord(record)
  })
}

export async function listConsumptions(
  actorId: number,
  actorRole: string,
  filters: { date?: string; userId?: number; productId?: number } = {},
) {
  const where: Prisma.PersonnelConsumptionWhereInput = {}

  if (actorRole !== 'ADMIN') {
    where.userId = actorId
  } else if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.productId) {
    where.productId = filters.productId
  }

  if (filters.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filters.date)) {
      throw new AppError('Tarih formatı YYYY-MM-DD olmalıdır.', 400)
    }
    const [y, m, d] = filters.date.split('-').map(Number)
    const start = new Date(y, m - 1, d, 0, 0, 0, 0)
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0)
    where.createdAt = { gte: start, lt: end }
  }

  const rows = await prisma.personnelConsumption.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      product: {
        select: {
          id: true,
          name: true,
          barcode: true,
          image: true,
          purchasePrice: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return rows.map(serializeRecord)
}

export async function getConsumptionById(id: number, actorId: number, actorRole: string) {
  const row = await prisma.personnelConsumption.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      product: {
        select: {
          id: true,
          name: true,
          barcode: true,
          image: true,
          purchasePrice: true,
        },
      },
    },
  })
  if (!row) throw new AppError('Tüketim kaydı bulunamadı.', 404)
  if (actorRole !== 'ADMIN' && row.userId !== actorId) {
    throw new AppError('Bu kaydı görme yetkiniz yok.', 403)
  }
  return serializeRecord(row)
}

export async function getConsumptionPageSummary() {
  const { start: todayStart, end: todayEnd } = todayRange()
  const { start: monthStart, end: monthEnd } = monthRange()

  const [todayAgg, monthAgg, todayDistinct, monthCost] = await Promise.all([
    prisma.personnelConsumption.aggregate({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
      _count: { _all: true },
      _sum: { quantity: true, cost: true },
    }),
    prisma.personnelConsumption.aggregate({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
      _sum: { quantity: true },
    }),
    prisma.personnelConsumption.findMany({
      where: { createdAt: { gte: todayStart, lt: todayEnd } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    prisma.personnelConsumption.aggregate({
      where: { createdAt: { gte: monthStart, lt: monthEnd } },
      _sum: { cost: true },
    }),
  ])

  return {
    todayCount: todayAgg._count._all,
    todayQuantity: todayAgg._sum.quantity ?? 0,
    monthlyQuantity: monthAgg._sum.quantity ?? 0,
    totalCost: round2(toNumber(todayAgg._sum.cost)),
    monthCost: round2(toNumber(monthCost._sum.cost)),
    activePersonnel: todayDistinct.length,
  }
}
