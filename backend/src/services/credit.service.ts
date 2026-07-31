import {
  CreditTransactionType,
  PaymentType,
  Prisma,
  SaleStatus,
} from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function todayRange(): { start: Date; end: Date } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
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
      module: 'CREDIT',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Customer',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

function debtStatus(totalDebt: number): 'OPEN' | 'PAID' {
  return totalDebt > 0 ? 'OPEN' : 'PAID'
}

export async function listCreditCustomers(search?: string) {
  const query = search?.trim()
  const customers = await prisma.customer.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      name: true,
      phone: true,
      note: true,
      totalDebt: true,
      createdAt: true,
      creditTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: [{ totalDebt: 'desc' }, { name: 'asc' }],
  })

  return customers.map((c) => {
    const totalDebt = round2(toNumber(c.totalDebt))
    const last = c.creditTransactions[0]?.createdAt ?? null
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      note: c.note,
      totalDebt,
      lastTransactionDate: last ? last.toISOString() : null,
      status: debtStatus(totalDebt),
      createdAt: c.createdAt.toISOString(),
    }
  })
}

export async function getCreditCustomerDetail(customerId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      note: true,
      totalDebt: true,
      createdAt: true,
      creditTransactions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
          saleId: true,
        },
      },
    },
  })

  if (!customer) {
    throw new AppError('Müşteri bulunamadı.', 404)
  }

  const totalDebt = round2(toNumber(customer.totalDebt))
  const lastTx = customer.creditTransactions[0]?.createdAt ?? null

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    note: customer.note,
    totalDebt,
    status: debtStatus(totalDebt),
    lastTransactionDate: lastTx ? lastTx.toISOString() : null,
    createdAt: customer.createdAt.toISOString(),
    transactions: customer.creditTransactions.map((tx) => ({
      id: tx.id,
      date: tx.createdAt.toISOString(),
      description:
        tx.type === CreditTransactionType.DEBT && tx.saleId
          ? `Borç Satış #${tx.saleId}`
          : tx.description ?? (tx.type === CreditTransactionType.DEBT ? 'Borç' : 'Tahsilat'),
      amount: round2(toNumber(tx.amount)),
      type: tx.type,
      saleId: tx.saleId,
    })),
  }
}

export async function getCreditSaleDetail(customerId: number, saleId: number) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true, name: true, phone: true },
  })
  if (!customer) {
    throw new AppError('Müşteri bulunamadı.', 404)
  }

  const link = await prisma.creditTransaction.findFirst({
    where: {
      customerId,
      saleId,
      type: CreditTransactionType.DEBT,
    },
    select: { id: true },
  })
  if (!link) {
    throw new AppError('Bu satış müşterinin borç kaydına ait değil.', 404)
  }

  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      status: SaleStatus.COMPLETED,
      paymentType: PaymentType.CREDIT,
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, image: true, barcode: true } },
        },
      },
      payments: true,
      user: { select: { id: true, fullName: true, role: true } },
    },
  })

  if (!sale) {
    throw new AppError('Borç satışı bulunamadı.', 404)
  }

  const createdAt = sale.createdAt
  const time = createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const date = createdAt.toLocaleDateString('tr-TR')

  return {
    id: sale.id,
    saleNo: `#${sale.id}`,
    time,
    date,
    createdAt: createdAt.toISOString(),
    payment: 'debt' as const,
    paymentType: sale.paymentType,
    total: round2(toNumber(sale.total)),
    subtotal: round2(toNumber(sale.subtotal)),
    discount: round2(toNumber(sale.discount)),
    personnel: sale.user.fullName,
    personnelRole: sale.user.role,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    },
    itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
    payments: sale.payments.map((p) => ({
      id: p.id,
      type: p.type,
      amount: round2(toNumber(p.amount)),
      createdAt: p.createdAt.toISOString(),
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
        unitPrice: round2(toNumber(item.unitPrice)),
        total: round2(toNumber(item.totalPrice)),
      }
    }),
  }
}

export async function collectPayment(input: {
  userId: number
  customerId: number
  amount: number
  note?: string
}) {
  const amount = round2(input.amount)
  if (!(amount > 0)) {
    throw new AppError('Ödeme tutarı 0’dan büyük olmalıdır.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({
      where: { id: input.customerId },
    })
    if (!customer) {
      throw new AppError('Müşteri bulunamadı.', 404)
    }

    const currentDebt = round2(toNumber(customer.totalDebt))
    if (currentDebt <= 0) {
      throw new AppError('Bu müşterinin borcu bulunmuyor.', 400)
    }
    if (amount > currentDebt) {
      throw new AppError('Ödeme tutarı mevcut borçtan fazla olamaz.', 400)
    }

    const newDebt = round2(currentDebt - amount)
    if (newDebt < 0) {
      throw new AppError('Borç negatif olamaz.', 400)
    }

    const description =
      input.note?.trim() ||
      `Tahsilat · ${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`

    const transaction = await tx.creditTransaction.create({
      data: {
        customerId: customer.id,
        type: CreditTransactionType.PAYMENT,
        amount: decimal(amount),
        description,
      },
    })

    const updated = await tx.customer.update({
      where: { id: customer.id },
      data: { totalDebt: decimal(newDebt) },
    })

    await writeAuditLog(tx, {
      userId: input.userId,
      actionType: 'PAYMENT',
      title: 'Borç tahsilatı',
      description: `${customer.name} · ${amount.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
      })} ₺ tahsil edildi`,
      entityId: customer.id,
      entityLabel: customer.name,
      oldValues: { totalDebt: currentDebt },
      newValues: { totalDebt: newDebt, amount, transactionId: transaction.id },
    })

    return {
      customerId: updated.id,
      name: updated.name,
      previousDebt: currentDebt,
      amount,
      remainingDebt: round2(toNumber(updated.totalDebt)),
      status: debtStatus(round2(toNumber(updated.totalDebt))),
      transaction: {
        id: transaction.id,
        date: transaction.createdAt.toISOString(),
        description: transaction.description,
        amount,
        type: CreditTransactionType.PAYMENT,
      },
    }
  })
}

export async function createDebtCustomer(input: {
  userId: number
  fullName: string
  phone?: string | null
  openingDebt?: number
  note?: string | null
}) {
  const name = input.fullName.trim()
  if (!name) {
    throw new AppError('Ad soyad zorunludur.', 400)
  }

  const phone = input.phone?.trim() ? input.phone.trim() : null
  const openingDebt = round2(input.openingDebt ?? 0)
  if (openingDebt < 0) {
    throw new AppError('Açılış borcu negatif olamaz.', 400)
  }

  const note = input.note?.trim() ? input.note.trim() : null

  return prisma.$transaction(async (tx) => {
    if (phone) {
      const duplicate = await tx.customer.findFirst({ where: { phone } })
      if (duplicate) {
        throw new AppError('Bu telefon numarasıyla kayıtlı bir borçlu zaten var.', 409)
      }
    }

    const customer = await tx.customer.create({
      data: {
        name,
        phone,
        note,
        totalDebt: decimal(openingDebt),
      },
    })

    if (openingDebt > 0) {
      await tx.creditTransaction.create({
        data: {
          customerId: customer.id,
          type: CreditTransactionType.DEBT,
          amount: decimal(openingDebt),
          description: 'Borç hesabı açılış bakiyesi',
        },
      })
    }

    await writeAuditLog(tx, {
      userId: input.userId,
      actionType: 'CREATE_DEBT_CUSTOMER',
      title: 'Borçlu hesabı oluşturuldu',
      description: name,
      entityId: customer.id,
      entityLabel: name,
      newValues: {
        name,
        phone,
        openingDebt,
        note,
      },
    })

    return {
      id: customer.id,
      fullName: customer.name,
      phone: customer.phone,
      currentDebt: openingDebt,
      note: customer.note,
      createdAt: customer.createdAt.toISOString(),
    }
  })
}

export async function getCreditSummary() {
  const { start, end } = todayRange()

  const [debtors, debtAgg, todayDebtAgg, todayPayAgg] = await Promise.all([
    prisma.customer.count({
      where: { totalDebt: { gt: 0 } },
    }),
    prisma.customer.aggregate({
      _sum: { totalDebt: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: CreditTransactionType.DEBT,
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    prisma.creditTransaction.aggregate({
      where: {
        type: CreditTransactionType.PAYMENT,
        createdAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
  ])

  return {
    totalCustomers: debtors,
    totalDebt: round2(toNumber(debtAgg._sum.totalDebt)),
    todayDebtSales: round2(toNumber(todayDebtAgg._sum.amount)),
    todayPayments: round2(toNumber(todayPayAgg._sum.amount)),
  }
}
