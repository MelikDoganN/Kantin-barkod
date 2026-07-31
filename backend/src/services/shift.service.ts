import {
  PaymentType,
  Prisma,
  SaleStatus,
  ShiftStatus,
} from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
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
      module: 'SHIFT',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Shift',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

async function computeSalesSummary(tx: Prisma.TransactionClient | typeof prisma, shiftId: number) {
  const sales = await tx.sale.findMany({
    where: { shiftId, status: SaleStatus.COMPLETED },
    select: {
      id: true,
      paymentType: true,
      total: true,
      createdAt: true,
    },
  })

  let cashSales = 0
  let cardSales = 0
  let creditSales = 0

  for (const sale of sales) {
    const amount = toNumber(sale.total)
    if (sale.paymentType === PaymentType.CASH) cashSales += amount
    else if (sale.paymentType === PaymentType.CARD) cardSales += amount
    else if (sale.paymentType === PaymentType.CREDIT) creditSales += amount
  }

  return {
    cashSales,
    cardSales,
    creditSales,
    totalSales: cashSales + cardSales + creditSales,
    saleCount: sales.length,
    sales,
  }
}

function formatShiftListItem(
  shift: {
    id: number
    status: ShiftStatus
    startTime: Date
    endTime: Date | null
    openingCash: { toString(): string } | number
    closingCash: { toString(): string } | number | null
    expectedCash: { toString(): string } | number | null
    difference: { toString(): string } | number | null
    note: string | null
    user: { id: number; fullName: string; username: string; role: string }
  },
  summary: { cashSales: number; cardSales: number; creditSales: number; totalSales: number; saleCount: number },
) {
  return {
    id: shift.id,
    personnel: shift.user.fullName,
    userId: shift.user.id,
    username: shift.user.username,
    role: shift.user.role,
    startTime: shift.startTime,
    endTime: shift.endTime,
    openingCash: toNumber(shift.openingCash),
    closingCash: shift.closingCash === null ? null : toNumber(shift.closingCash),
    expectedCash:
      shift.expectedCash === null
        ? toNumber(shift.openingCash) + summary.cashSales
        : toNumber(shift.expectedCash),
    difference: shift.difference === null ? null : toNumber(shift.difference),
    note: shift.note,
    status: shift.status,
    cashSales: summary.cashSales,
    cardSales: summary.cardSales,
    creditSales: summary.creditSales,
    totalSales: summary.totalSales,
    saleCount: summary.saleCount,
  }
}

export async function getCurrentShift(userId: number) {
  const shift = await prisma.shift.findFirst({
    where: { userId, status: ShiftStatus.OPEN },
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
    orderBy: { startTime: 'desc' },
  })

  if (!shift) return null

  const summary = await computeSalesSummary(prisma, shift.id)
  const expectedCash = toNumber(shift.openingCash) + summary.cashSales

  return {
    id: shift.id,
    personnel: shift.user.fullName,
    role: shift.user.role,
    userId: shift.user.id,
    startTime: shift.startTime,
    openingCash: toNumber(shift.openingCash),
    status: shift.status,
    note: shift.note,
    expectedCash,
    salesSummary: {
      cashSales: summary.cashSales,
      cardSales: summary.cardSales,
      creditSales: summary.creditSales,
      totalSales: summary.totalSales,
      saleCount: summary.saleCount,
    },
  }
}

export async function openShift(userId: number, openingCash: number, note?: string) {
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    throw new AppError('Açılış kasası 0 veya daha büyük olmalıdır.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.shift.findFirst({
      where: { userId, status: ShiftStatus.OPEN },
    })
    if (existing) {
      throw new AppError('Zaten açık bir vardiyanız var.', 409)
    }

    const shift = await tx.shift.create({
      data: {
        userId,
        status: ShiftStatus.OPEN,
        startTime: new Date(),
        openingCash: decimal(openingCash),
        note: note?.trim() || null,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'SHIFT_OPEN',
      title: 'Vardiya açıldı',
      description: `Açılış kasası ₺${openingCash.toFixed(2)}`,
      entityId: shift.id,
      entityLabel: `Vardiya #${shift.id}`,
      newValues: { openingCash, status: 'OPEN' },
    })

    return {
      id: shift.id,
      personnel: shift.user.fullName,
      role: shift.user.role,
      userId: shift.user.id,
      startTime: shift.startTime,
      openingCash: toNumber(shift.openingCash),
      status: shift.status,
      note: shift.note,
      expectedCash: toNumber(shift.openingCash),
      salesSummary: {
        cashSales: 0,
        cardSales: 0,
        creditSales: 0,
        totalSales: 0,
        saleCount: 0,
      },
    }
  })
}

export async function closeShift(
  shiftId: number,
  userId: number,
  role: string,
  closingCash: number,
  note?: string,
) {
  if (!Number.isFinite(closingCash) || closingCash < 0) {
    throw new AppError('Sayım kasası 0 veya daha büyük olmalıdır.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })

    if (!shift) {
      throw new AppError('Vardiya bulunamadı.', 404)
    }
    if (shift.status !== ShiftStatus.OPEN) {
      throw new AppError('Vardiya zaten kapalı.', 400)
    }
    if (role !== 'ADMIN' && shift.userId !== userId) {
      throw new AppError('Bu vardiyayı kapatma yetkiniz yok.', 403)
    }

    const summary = await computeSalesSummary(tx, shift.id)
    const openingCash = toNumber(shift.openingCash)
    const expectedCash = openingCash + summary.cashSales
    const difference = closingCash - expectedCash

    const updated = await tx.shift.update({
      where: { id: shift.id },
      data: {
        status: ShiftStatus.CLOSED,
        endTime: new Date(),
        closingCash: decimal(closingCash),
        expectedCash: decimal(expectedCash),
        difference: decimal(difference),
        note: note?.trim() || shift.note,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'SHIFT_CLOSE',
      title: 'Vardiya kapatıldı',
      description: `Beklenen ₺${expectedCash.toFixed(2)}, sayılan ₺${closingCash.toFixed(2)}, fark ₺${difference.toFixed(2)}`,
      entityId: shift.id,
      entityLabel: `Vardiya #${shift.id}`,
      oldValues: { status: 'OPEN' },
      newValues: {
        status: 'CLOSED',
        closingCash,
        expectedCash,
        difference,
      },
    })

    return formatShiftListItem(updated, summary)
  })
}

export interface ShiftListFilters {
  date?: string
  status?: ShiftStatus
  userId?: number
}

export async function listShifts(userId: number, role: string, filters: ShiftListFilters = {}) {
  const where: Prisma.ShiftWhereInput = {}

  if (role !== 'ADMIN') {
    where.userId = userId
  } else if (filters.userId) {
    where.userId = filters.userId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.date) {
    const day = new Date(filters.date)
    if (Number.isNaN(day.getTime())) {
      throw new AppError('Geçersiz tarih formatı.', 400)
    }
    const start = new Date(day)
    start.setHours(0, 0, 0, 0)
    const end = new Date(day)
    end.setHours(23, 59, 59, 999)
    where.startTime = { gte: start, lte: end }
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
    orderBy: { startTime: 'desc' },
  })

  const result = []
  for (const shift of shifts) {
    const summary = await computeSalesSummary(prisma, shift.id)
    result.push(formatShiftListItem(shift, summary))
  }
  return result
}

export async function getShiftById(shiftId: number, userId: number, role: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
  })

  if (!shift) {
    throw new AppError('Vardiya bulunamadı.', 404)
  }
  if (role !== 'ADMIN' && shift.userId !== userId) {
    throw new AppError('Bu vardiyaya erişim yetkiniz yok.', 403)
  }

  const summary = await computeSalesSummary(prisma, shift.id)
  const openingCash = toNumber(shift.openingCash)
  // Açık vardiyada her zaman canlı hesapla; kapalıda kayıtlı değeri kullan
  const expectedCash =
    shift.status === ShiftStatus.CLOSED && shift.expectedCash !== null
      ? toNumber(shift.expectedCash)
      : openingCash + summary.cashSales

  return {
    id: shift.id,
    personnel: shift.user.fullName,
    role: shift.user.role,
    userId: shift.user.id,
    startTime: shift.startTime,
    endTime: shift.endTime,
    openingCash,
    closingCash: shift.closingCash === null ? null : toNumber(shift.closingCash),
    expectedCash,
    difference: shift.difference === null ? null : toNumber(shift.difference),
    note: shift.note,
    status: shift.status,
    salesSummary: {
      cashSales: summary.cashSales,
      cardSales: summary.cardSales,
      creditSales: summary.creditSales,
      totalSales: summary.totalSales,
      saleCount: summary.saleCount,
    },
    sales: summary.sales.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      paymentType: s.paymentType,
      total: toNumber(s.total),
    })),
  }
}

/** Satış servisi için: kullanıcının açık vardiyasını döner veya hata fırlatır. */
export async function requireOpenShift(
  tx: Prisma.TransactionClient,
  userId: number,
) {
  const shift = await tx.shift.findFirst({
    where: { userId, status: ShiftStatus.OPEN },
    orderBy: { startTime: 'desc' },
  })
  if (!shift) {
    throw new AppError('Önce vardiya açmalısınız.', 400)
  }
  return shift
}
