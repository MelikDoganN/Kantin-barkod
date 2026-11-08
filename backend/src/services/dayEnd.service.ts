import {
  Prisma,
} from '@prisma/client'
import { DayEndStatus, PaymentType, SaleStatus, ShiftStatus } from '../types/enums'
import { prisma, type AppTransactionClient } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function decimal(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function formatTime(iso: Date): string {
  return iso.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: Date): string {
  return iso.toLocaleDateString('tr-TR')
}

function mapPayment(type: string | null): 'cash' | 'card' | 'debt' {
  if (type === PaymentType.CASH) return 'cash'
  if (type === PaymentType.CARD) return 'card'
  return 'debt'
}

function mapStatus(status: string): 'pending' | 'completed' | 'reviewed' {
  if (status === DayEndStatus.PENDING) return 'pending'
  if (status === DayEndStatus.REVIEWED) return 'reviewed'
  return 'completed'
}

async function writeAuditLog(
  tx: AppTransactionClient,
  params: {
    userId: number
    actionType: string
    title: string
    description?: string
    entityId: number
    entityLabel: string
    newValues?: Prisma.InputJsonValue
  },
) {
  await tx.auditLog.create({
    data: {
      userId: params.userId,
      module: 'DAY_END',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'DayEnd',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      newValues: params.newValues,
    },
  })
}

async function computeShiftSales(tx: AppTransactionClient | typeof prisma, shiftId: number) {
  const sales = await tx.sale.findMany({
    where: { shiftId, status: SaleStatus.COMPLETED },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, image: true } },
        },
      },
      payments: true,
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  let cashAmount = 0
  let cardAmount = 0
  let creditAmount = 0

  for (const sale of sales) {
    const total = toNumber(sale.total)
    if (sale.paymentType === PaymentType.CASH) cashAmount += total
    else if (sale.paymentType === PaymentType.CARD) cardAmount += total
    else if (sale.paymentType === PaymentType.CREDIT) creditAmount += total
  }

  return {
    sales,
    cashAmount,
    cardAmount,
    creditAmount,
    totalSales: cashAmount + cardAmount + creditAmount,
    saleCount: sales.length,
  }
}

function serializeListItem(dayEnd: {
  id: number
  status: string
  totalSales: { toString(): string } | number
  cashAmount: { toString(): string } | number
  cardAmount: { toString(): string } | number
  creditAmount: { toString(): string } | number
  cashDifference: { toString(): string } | number
  createdAt: Date
  user: { id: number; fullName: string; username: string; role: string }
  shift: {
    id: number
    startTime: Date
    endTime: Date | null
    openingCash: { toString(): string } | number
    closingCash: { toString(): string } | number | null
    expectedCash: { toString(): string } | number | null
  }
  saleCount?: number
}) {
  const start = formatTime(dayEnd.shift.startTime)
  const end = dayEnd.shift.endTime ? formatTime(dayEnd.shift.endTime) : '—'

  return {
    id: dayEnd.id,
    date: formatDate(dayEnd.createdAt),
    createdAt: dayEnd.createdAt,
    personnel: dayEnd.user.fullName,
    userId: dayEnd.user.id,
    username: dayEnd.user.username,
    role: dayEnd.user.role,
    shiftId: dayEnd.shift.id,
    shift: `${start} - ${end}`,
    openingCash: toNumber(dayEnd.shift.openingCash),
    closingCash: dayEnd.shift.closingCash === null ? null : toNumber(dayEnd.shift.closingCash),
    expectedCash: dayEnd.shift.expectedCash === null ? null : toNumber(dayEnd.shift.expectedCash),
    saleCount: dayEnd.saleCount ?? 0,
    totalSales: toNumber(dayEnd.totalSales),
    cashSales: toNumber(dayEnd.cashAmount),
    cardSales: toNumber(dayEnd.cardAmount),
    debtSales: toNumber(dayEnd.creditAmount),
    cashDifference: toNumber(dayEnd.cashDifference),
    status: mapStatus(dayEnd.status),
    statusRaw: dayEnd.status,
  }
}

export async function createDayEnd(
  userId: number,
  role: string,
  shiftId: number,
  actualCash: number,
) {
  if (!Number.isFinite(actualCash) || actualCash < 0) {
    throw new AppError('Sayılan kasa 0 veya daha büyük olmalıdır.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const shift = await tx.shift.findUnique({
      where: { id: shiftId },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
        dayEnd: true,
      },
    })

    if (!shift) {
      throw new AppError('Vardiya bulunamadı.', 404)
    }

    if (role !== 'ADMIN' && shift.userId !== userId) {
      throw new AppError('Bu vardiya için gün sonu alma yetkiniz yok.', 403)
    }

    if (shift.status !== ShiftStatus.CLOSED) {
      throw new AppError('Vardiyası kapanmamış personel gün sonu alamaz.', 400)
    }

    if (shift.dayEnd) {
      throw new AppError('Bu vardiya için gün sonu zaten alınmış.', 409)
    }

    const summary = await computeShiftSales(tx, shift.id)
    const openingCash = toNumber(shift.openingCash)
    const expectedCash = openingCash + summary.cashAmount
    const cashDifference = actualCash - expectedCash

    const dayEnd = await tx.dayEnd.create({
      data: {
        shiftId: shift.id,
        userId: shift.userId,
        status: DayEndStatus.COMPLETED,
        totalSales: decimal(summary.totalSales),
        cashAmount: decimal(summary.cashAmount),
        cardAmount: decimal(summary.cardAmount),
        creditAmount: decimal(summary.creditAmount),
        cashDifference: decimal(cashDifference),
      },
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
        shift: true,
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'DAY_END_CREATE',
      title: 'Gün sonu oluşturuldu',
      description: `Vardiya #${shift.id}, toplam ₺${summary.totalSales.toFixed(2)}, kasa farkı ₺${cashDifference.toFixed(2)}`,
      entityId: dayEnd.id,
      entityLabel: `Gün Sonu #${dayEnd.id}`,
      newValues: {
        shiftId,
        totalSales: summary.totalSales,
        cashDifference,
        actualCash,
        expectedCash,
      },
    })

    return serializeListItem({ ...dayEnd, saleCount: summary.saleCount })
  })
}

export interface DayEndListFilters {
  date?: string
  userId?: number
  status?: DayEndStatus
}

export async function listDayEnds(userId: number, role: string, filters: DayEndListFilters = {}) {
  const where: Prisma.DayEndWhereInput = {}

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
    where.createdAt = { gte: start, lte: end }
  }

  const records = await prisma.dayEnd.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
      shift: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const result = []
  for (const record of records) {
    const saleCount = await prisma.sale.count({
      where: { shiftId: record.shiftId, status: SaleStatus.COMPLETED },
    })
    result.push(serializeListItem({ ...record, saleCount }))
  }
  return result
}

export async function getDayEndById(id: number, userId: number, role: string) {
  const dayEnd = await prisma.dayEnd.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
      shift: true,
    },
  })

  if (!dayEnd) {
    throw new AppError('Gün sonu kaydı bulunamadı.', 404)
  }

  if (role !== 'ADMIN' && dayEnd.userId !== userId) {
    throw new AppError('Bu gün sonu kaydına erişim yetkiniz yok.', 403)
  }

  const summary = await computeShiftSales(prisma, dayEnd.shiftId)
  // Özet tutarlar DayEnd kaydından; adet canlı COMPLETED sayısından
  const base = serializeListItem({ ...dayEnd, saleCount: summary.saleCount })

  const salesForDisplay = await prisma.sale.findMany({
    where: {
      shiftId: dayEnd.shiftId,
      OR: [
        { status: SaleStatus.COMPLETED },
        { status: SaleStatus.CANCELLED, cancelledAt: { not: null } },
      ],
    },
    include: {
      cancelledBy: { select: { id: true, fullName: true } },
      items: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return {
    ...base,
    // Özet tutarlar gün sonu kaydındaki sabit değerlerden gelir (iptal sonrası bozulmaz)
    sales: salesForDisplay.map((sale) => ({
      id: sale.id,
      saleNo: `#${sale.id}`,
      time: formatTime(sale.createdAt),
      createdAt: sale.createdAt,
      payment: mapPayment(sale.paymentType),
      paymentType: sale.paymentType,
      status: sale.status,
      cancelledAt: sale.cancelledAt,
      cancelReason: sale.cancelReason,
      cancelledByName: sale.cancelledBy?.fullName ?? null,
      itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
      total: toNumber(sale.total),
    })),
  }
}

export async function getDayEndSaleDetail(
  dayEndId: number,
  saleId: number,
  userId: number,
  role: string,
) {
  const dayEnd = await prisma.dayEnd.findUnique({
    where: { id: dayEndId },
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
  })

  if (!dayEnd) {
    throw new AppError('Gün sonu kaydı bulunamadı.', 404)
  }

  if (role !== 'ADMIN' && dayEnd.userId !== userId) {
    throw new AppError('Bu kayda erişim yetkiniz yok.', 403)
  }

  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      shiftId: dayEnd.shiftId,
      OR: [
        { status: SaleStatus.COMPLETED },
        { status: SaleStatus.CANCELLED, cancelledAt: { not: null } },
      ],
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, image: true, barcode: true } },
        },
      },
      payments: true,
      user: { select: { id: true, fullName: true, role: true } },
      cancelledBy: { select: { id: true, fullName: true, username: true } },
      shift: { include: { dayEnd: { select: { id: true } } } },
    },
  })

  if (!sale) {
    throw new AppError('Satış bu gün sonuna ait değil veya bulunamadı.', 404)
  }

  return {
    id: sale.id,
    saleNo: `#${sale.id}`,
    time: formatTime(sale.createdAt),
    createdAt: sale.createdAt,
    payment: mapPayment(sale.paymentType),
    paymentType: sale.paymentType,
    status: sale.status,
    cancelledAt: sale.cancelledAt,
    cancelReason: sale.cancelReason,
    cancelledByName: sale.cancelledBy?.fullName ?? null,
    dayEndTaken: !!sale.shift.dayEnd,
    total: toNumber(sale.total),
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    personnel: sale.user.fullName,
    personnelRole: sale.user.role,
    itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
    payments: sale.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: toNumber(p.amount),
      createdAt: p.createdAt,
    })),
    items: sale.items.map((item) => {
      const imagePath = item.product.image ?? null
      return {
        productId: item.productId,
        productName: item.product.name,
        imagePath,
        imageUrl: buildImageUrl(imagePath),
        barcode: item.product.barcode,
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPrice),
        total: toNumber(item.totalPrice),
      }
    }),
  }
}

/** Gün sonu alınabilecek kapanmış vardiyalar (henüz DayEnd yok). */
export async function listEligibleShifts(userId: number, role: string) {
  const where: Prisma.ShiftWhereInput = {
    status: ShiftStatus.CLOSED,
    dayEnd: null,
  }
  if (role !== 'ADMIN') {
    where.userId = userId
  }

  const shifts = await prisma.shift.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, role: true } },
    },
    orderBy: { endTime: 'desc' },
  })

  return shifts.map((shift) => ({
    id: shift.id,
    personnel: shift.user.fullName,
    role: shift.user.role,
    startTime: shift.startTime,
    endTime: shift.endTime,
    openingCash: toNumber(shift.openingCash),
    closingCash: shift.closingCash === null ? null : toNumber(shift.closingCash),
    expectedCash: shift.expectedCash === null ? null : toNumber(shift.expectedCash),
    difference: shift.difference === null ? null : toNumber(shift.difference),
  }))
}
