import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
}

function toNumber(value: { toString(): string } | number): number {
  return typeof value === 'number' ? value : Number(value.toString())
}

export async function createCashAdjustment(
  userId: number,
  role: string,
  input: { amount: number; description: string; dayEndId?: number | null },
) {
  if (role !== 'ADMIN') {
    throw new AppError('Kasa düzeltme yalnızca yönetici tarafından yapılabilir.', 403)
  }

  const description = input.description.trim()
  if (description.length < 3) {
    throw new AppError('Açıklama en az 3 karakter olmalıdır.', 400)
  }
  if (!Number.isFinite(input.amount) || input.amount === 0) {
    throw new AppError('Tutar 0 olamaz.', 400)
  }

  if (input.dayEndId) {
    const dayEnd = await prisma.dayEnd.findUnique({ where: { id: input.dayEndId } })
    if (!dayEnd) {
      throw new AppError('Gün sonu kaydı bulunamadı.', 404)
    }
  }

  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.cashAdjustment.create({
      data: {
        amount: decimal(input.amount),
        description,
        userId,
        dayEndId: input.dayEndId ?? null,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true } },
        dayEnd: { select: { id: true, createdAt: true } },
      },
    })

    await tx.auditLog.create({
      data: {
        userId,
        module: 'CASH',
        actionType: 'CASH_ADJUSTMENT',
        title: 'Kasa düzeltme',
        description,
        entityType: 'CashAdjustment',
        entityId: created.id,
        entityLabel: `Kasa düzeltme #${created.id}`,
        oldValues: { amount: 0 },
        newValues: {
          amount: input.amount,
          description,
          dayEndId: input.dayEndId ?? null,
        },
      },
    })

    return created
  })

  return {
    id: record.id,
    amount: toNumber(record.amount),
    description: record.description,
    userId: record.userId,
    dayEndId: record.dayEndId,
    createdAt: record.createdAt,
    user: record.user,
    dayEnd: record.dayEnd,
  }
}

export async function listCashAdjustments(limit = 50) {
  const rows = await prisma.cashAdjustment.findMany({
    take: Math.min(Math.max(limit, 1), 100),
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      dayEnd: { select: { id: true, createdAt: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    amount: toNumber(row.amount),
    description: row.description,
    userId: row.userId,
    dayEndId: row.dayEndId,
    createdAt: row.createdAt,
    user: row.user,
    dayEnd: row.dayEnd,
  }))
}
