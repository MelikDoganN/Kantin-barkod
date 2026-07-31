import {
  CreditTransactionType,
  PaymentType,
  Prisma,
  SaleStatus,
  StockMovementType,
} from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'
import { requireOpenShift } from './shift.service'

export interface SaleItemInput {
  productId: number
  quantity: number
}

export interface CreateSaleInput {
  items: SaleItemInput[]
  paymentType: PaymentType
  customerId?: number
  discount?: number
}

export interface UpdateDraftSaleInput {
  items: SaleItemInput[]
  discount?: number
}

export interface FinalizeDraftSaleInput {
  paymentType: PaymentType
  customerId?: number
  discount?: number
}

const draftProductSelect = {
  id: true,
  name: true,
  barcode: true,
  image: true,
  salePrice: true,
  purchasePrice: true,
  unitType: true,
  unitsPerCarton: true,
  minimumStock: true,
  isActive: true,
  categoryId: true,
  category: { select: { id: true, name: true, isActive: true } },
  inventory: { select: { warehouseQuantity: true, shelfQuantity: true } },
} as const

const saleInclude = {
  user: { select: { id: true, fullName: true, username: true, role: true } },
  cancelledBy: { select: { id: true, fullName: true, username: true, role: true } },
  shift: {
    select: {
      id: true,
      startTime: true,
      status: true,
      dayEnd: { select: { id: true } },
    },
  },
  items: {
    include: {
      product: {
        select: { id: true, name: true, barcode: true, image: true },
      },
    },
  },
  payments: true,
  creditTransactions: {
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
} as const

const draftSaleInclude = {
  user: { select: { id: true, fullName: true, username: true, role: true } },
  shift: { select: { id: true, startTime: true, status: true } },
  items: {
    include: {
      product: { select: draftProductSelect },
    },
  },
  payments: true,
  creditTransactions: {
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  },
} as const

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2))
}

function toNumber(value: { toString(): string } | number): number {
  return typeof value === 'number' ? value : Number(value.toString())
}

function serializeProductImage(product: { image?: string | null }) {
  const imagePath = product.image ?? null
  return { imagePath, imageUrl: buildImageUrl(imagePath) }
}

function serializeDraftProduct(product: {
  id: number
  name: string
  barcode: string | null
  image: string | null
  salePrice: { toString(): string } | number
  purchasePrice: { toString(): string } | number
  unitType: string
  unitsPerCarton: number
  minimumStock: number
  isActive: boolean
  categoryId: number
  category: { id: number; name: string; isActive: boolean }
  inventory: { warehouseQuantity: number; shelfQuantity: number } | null
}) {
  const { imagePath, imageUrl } = serializeProductImage(product)
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    categoryId: product.categoryId,
    purchasePrice: toNumber(product.purchasePrice),
    salePrice: toNumber(product.salePrice),
    unitType: product.unitType,
    unitsPerCarton: product.unitsPerCarton,
    minimumStock: product.minimumStock,
    isActive: product.isActive,
    imagePath,
    imageUrl,
    category: product.category,
    inventory: product.inventory,
  }
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
      module: 'SALE',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Sale',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

function mergeItems(items: SaleItemInput[]) {
  const merged = new Map<number, number>()
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity)
  }
  return merged
}

function validateItemsInput(items: SaleItemInput[]) {
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError('Ürün miktarı 0\'dan büyük olmalıdır.', 400)
    }
  }
}

async function buildLineItems(
  tx: Prisma.TransactionClient,
  items: SaleItemInput[],
  checkStock: boolean,
) {
  const merged = mergeItems(items)
  const lineItems: Array<{
    productId: number
    quantity: number
    unitPrice: number
    totalPrice: number
    productName: string
    beforeShelf: number
    afterShelf: number
    beforeWarehouse: number
    afterWarehouse: number
  }> = []

  let subtotal = 0

  for (const [productId, quantity] of merged) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: { inventory: true },
    })

    if (!product || !product.isActive) {
      throw new AppError('Ürün bulunamadı veya pasif.', 404)
    }

    let inventory = product.inventory
    if (!inventory) {
      inventory = await tx.inventory.create({
        data: { productId, warehouseQuantity: 0, shelfQuantity: 0 },
      })
    }

    if (checkStock && inventory.shelfQuantity < quantity) {
      throw new AppError(`Yetersiz stok: ${product.name}`, 400)
    }

    const unitPrice = toNumber(product.salePrice)
    const totalPrice = unitPrice * quantity
    subtotal += totalPrice

    lineItems.push({
      productId,
      quantity,
      unitPrice,
      totalPrice,
      productName: product.name,
      beforeShelf: inventory.shelfQuantity,
      afterShelf: inventory.shelfQuantity - quantity,
      beforeWarehouse: inventory.warehouseQuantity,
      afterWarehouse: inventory.warehouseQuantity,
    })
  }

  return { lineItems, subtotal }
}

async function applyCompletedSaleEffects(
  tx: Prisma.TransactionClient,
  params: {
    saleId: number
    userId: number
    paymentType: PaymentType
    customerId?: number
    total: number
    lineItems: Array<{
      productId: number
      quantity: number
      productName: string
      beforeShelf: number
      afterShelf: number
      beforeWarehouse: number
      afterWarehouse: number
    }>
  },
) {
  const { saleId, userId, paymentType, customerId, total, lineItems } = params

  await tx.payment.create({
    data: {
      saleId,
      type: paymentType,
      amount: decimal(total),
    },
  })

  for (const item of lineItems) {
    await tx.inventory.update({
      where: { productId: item.productId },
      data: { shelfQuantity: item.afterShelf },
    })

    await tx.stockMovement.create({
      data: {
        productId: item.productId,
        type: StockMovementType.SALE,
        quantity: item.quantity,
        beforeWarehouse: item.beforeWarehouse,
        afterWarehouse: item.afterWarehouse,
        beforeShelf: item.beforeShelf,
        afterShelf: item.afterShelf,
        description: `Satış #${saleId}`,
        userId,
      },
    })
  }

  let customer = null
  if (paymentType === PaymentType.CREDIT && customerId) {
    customer = await tx.customer.findUnique({ where: { id: customerId } })
    if (!customer) {
      throw new AppError('Müşteri bulunamadı.', 404)
    }

    const previousDebt = toNumber(customer.totalDebt)
    const newDebt = previousDebt + total

    await tx.customer.update({
      where: { id: customer.id },
      data: { totalDebt: decimal(newDebt) },
    })

    await tx.creditTransaction.create({
      data: {
        customerId: customer.id,
        saleId,
        type: CreditTransactionType.DEBT,
        amount: decimal(total),
        description: `Borç satış #${saleId}`,
      },
    })
  }

  await writeAuditLog(tx, {
    userId,
    actionType: 'SALE',
    title: 'Satış oluşturuldu',
    description: `${lineItems.length} kalem, toplam ₺${total.toFixed(2)} (${paymentType})`,
    entityId: saleId,
    entityLabel: `Satış #${saleId}`,
    newValues: {
      paymentType,
      total,
      itemCount: lineItems.length,
      customerId: customer?.id ?? null,
    },
  })
}

function serializeSale<T extends {
  status?: SaleStatus
  paymentType?: PaymentType | null
  subtotal: { toString(): string } | number
  discount: { toString(): string } | number
  total: { toString(): string } | number
  items?: Array<{
    unitPrice: { toString(): string } | number
    totalPrice: { toString(): string } | number
    product?: { id: number; name: string; barcode: string | null; image: string | null }
  }>
  payments?: Array<{ amount: { toString(): string } | number }>
  creditTransactions?: Array<{ amount: { toString(): string } | number }>
}>(sale: T) {
  return {
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    items: sale.items?.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      product: item.product
        ? {
            ...item.product,
            ...serializeProductImage(item.product),
          }
        : item.product,
    })),
    payments: sale.payments?.map((p) => ({
      ...p,
      amount: toNumber(p.amount),
    })),
    creditTransactions: sale.creditTransactions?.map((c) => ({
      ...c,
      amount: toNumber(c.amount),
    })),
  }
}

function serializeDraftSale<T extends {
  id: number
  status: SaleStatus
  paymentType: PaymentType | null
  subtotal: { toString(): string } | number
  discount: { toString(): string } | number
  total: { toString(): string } | number
  createdAt: Date
  updatedAt: Date
  items: Array<{
    productId: number
    quantity: number
    unitPrice: { toString(): string } | number
    totalPrice: { toString(): string } | number
    product: Parameters<typeof serializeDraftProduct>[0]
  }>
}>(sale: T) {
  const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0)
  return {
    id: sale.id,
    status: sale.status,
    paymentType: sale.paymentType,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    itemCount,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt,
    items: sale.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      product: serializeDraftProduct(item.product),
    })),
  }
}

async function getOwnedDraftOrThrow(tx: Prisma.TransactionClient, saleId: number, userId: number) {
  const sale = await tx.sale.findUnique({
    where: { id: saleId },
    include: { items: true },
  })

  if (!sale) {
    throw new AppError('Satış bulunamadı.', 404)
  }
  if (sale.userId !== userId) {
    throw new AppError('Bu satışa erişim yetkiniz yok.', 403)
  }
  if (sale.status !== SaleStatus.DRAFT) {
    throw new AppError('Bu satış taslak değil.', 400)
  }

  return sale
}

export async function createSale(input: CreateSaleInput, userId: number) {
  if (!input.items?.length) {
    throw new AppError('Sepet boş olamaz.', 400)
  }

  validateItemsInput(input.items)

  if (input.paymentType === PaymentType.CREDIT && !input.customerId) {
    throw new AppError('Borç satışında müşteri seçimi zorunludur.', 400)
  }

  const discount = Math.max(0, input.discount ?? 0)

  return prisma.$transaction(async (tx) => {
    const shift = await requireOpenShift(tx, userId)
    const { lineItems, subtotal } = await buildLineItems(tx, input.items, true)
    const total = Math.max(subtotal - discount, 0)

    const sale = await tx.sale.create({
      data: {
        userId,
        shiftId: shift.id,
        status: SaleStatus.COMPLETED,
        paymentType: input.paymentType,
        subtotal: decimal(subtotal),
        discount: decimal(discount),
        total: decimal(total),
        items: {
          create: lineItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: decimal(item.unitPrice),
            totalPrice: decimal(item.totalPrice),
          })),
        },
      },
    })

    await applyCompletedSaleEffects(tx, {
      saleId: sale.id,
      userId,
      paymentType: input.paymentType,
      customerId: input.customerId,
      total,
      lineItems,
    })

    const full = await tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: saleInclude,
    })

    return serializeSale(full)
  })
}

export async function listDraftSales(userId: number) {
  const shift = await prisma.shift.findFirst({
    where: { userId, status: 'OPEN' },
    orderBy: { startTime: 'desc' },
  })

  if (!shift) {
    return []
  }

  const sales = await prisma.sale.findMany({
    where: {
      userId,
      shiftId: shift.id,
      status: SaleStatus.DRAFT,
    },
    include: draftSaleInclude,
    orderBy: { createdAt: 'asc' },
  })

  return sales.map(serializeDraftSale)
}

export async function createDraftSale(userId: number) {
  return prisma.$transaction(async (tx) => {
    const shift = await requireOpenShift(tx, userId)

    const sale = await tx.sale.create({
      data: {
        userId,
        shiftId: shift.id,
        status: SaleStatus.DRAFT,
        paymentType: null,
        subtotal: decimal(0),
        discount: decimal(0),
        total: decimal(0),
      },
    })

    const full = await tx.sale.findUniqueOrThrow({
      where: { id: sale.id },
      include: draftSaleInclude,
    })

    return serializeDraftSale(full)
  })
}

export async function updateDraftSale(saleId: number, userId: number, input: UpdateDraftSaleInput) {
  validateItemsInput(input.items)
  const discount = Math.max(0, input.discount ?? 0)

  return prisma.$transaction(async (tx) => {
    await getOwnedDraftOrThrow(tx, saleId, userId)
    await requireOpenShift(tx, userId)

    const { lineItems, subtotal } = input.items.length
      ? await buildLineItems(tx, input.items, false)
      : { lineItems: [], subtotal: 0 }

    const total = Math.max(subtotal - discount, 0)

    await tx.saleItem.deleteMany({ where: { saleId } })

    if (lineItems.length > 0) {
      await tx.saleItem.createMany({
        data: lineItems.map((item) => ({
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: decimal(item.unitPrice),
          totalPrice: decimal(item.totalPrice),
        })),
      })
    }

    await tx.sale.update({
      where: { id: saleId },
      data: {
        subtotal: decimal(subtotal),
        discount: decimal(discount),
        total: decimal(total),
      },
    })

    const full = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: draftSaleInclude,
    })

    return serializeDraftSale(full)
  })
}

export async function finalizeDraftSale(saleId: number, userId: number, input: FinalizeDraftSaleInput) {
  if (input.paymentType === PaymentType.CREDIT && !input.customerId) {
    throw new AppError('Borç satışında müşteri seçimi zorunludur.', 400)
  }

  const discount = Math.max(0, input.discount ?? 0)

  return prisma.$transaction(async (tx) => {
    const draft = await getOwnedDraftOrThrow(tx, saleId, userId)
    await requireOpenShift(tx, userId)

    if (draft.items.length === 0) {
      throw new AppError('Sepet boş olamaz.', 400)
    }

    const items = draft.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))

    const { lineItems, subtotal } = await buildLineItems(tx, items, true)
    const total = Math.max(subtotal - discount, 0)

    await tx.saleItem.deleteMany({ where: { saleId } })
    await tx.saleItem.createMany({
      data: lineItems.map((item) => ({
        saleId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: decimal(item.unitPrice),
        totalPrice: decimal(item.totalPrice),
      })),
    })

    await tx.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.COMPLETED,
        paymentType: input.paymentType,
        subtotal: decimal(subtotal),
        discount: decimal(discount),
        total: decimal(total),
      },
    })

    await applyCompletedSaleEffects(tx, {
      saleId,
      userId,
      paymentType: input.paymentType,
      customerId: input.customerId,
      total,
      lineItems,
    })

    const full = await tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: saleInclude,
    })

    return serializeSale(full)
  })
}

export async function cancelDraftSale(saleId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    await getOwnedDraftOrThrow(tx, saleId, userId)

    await tx.sale.update({
      where: { id: saleId },
      data: { status: SaleStatus.CANCELLED },
    })

    return { id: saleId, status: SaleStatus.CANCELLED }
  })
}

export interface CancelCompletedSaleInput {
  reason: string
  forceAfterDayEnd?: boolean
}

/** ADMIN: tamamlanmış satışı iptal eder, stokları geri alır. */
export async function cancelCompletedSale(
  saleId: number,
  adminUserId: number,
  adminRole: string,
  input: CancelCompletedSaleInput,
) {
  if (adminRole !== 'ADMIN') {
    throw new AppError('Satış iptali yalnızca yönetici tarafından yapılabilir.', 403)
  }

  const reason = input.reason.trim()
  if (reason.length < 3) {
    throw new AppError('İptal nedeni en az 3 karakter olmalıdır.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: true,
        payments: true,
        creditTransactions: true,
        shift: { include: { dayEnd: true } },
      },
    })

    if (!sale) {
      throw new AppError('Satış bulunamadı.', 404)
    }

    if (sale.status !== SaleStatus.COMPLETED) {
      throw new AppError('Yalnızca tamamlanmış satışlar iptal edilebilir.', 400)
    }

    const dayEndExists = !!sale.shift.dayEnd
    if (dayEndExists && !input.forceAfterDayEnd) {
      throw new AppError(
        'Bu satışın vardiyası için gün sonu alınmış. İptal için yönetici onayı (forceAfterDayEnd) gerekir.',
        409,
        'DAY_END_LOCKED',
      )
    }

    for (const item of sale.items) {
      const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } })
      if (!inventory) {
        throw new AppError('Stok kaydı bulunamadı.', 404)
      }

      const beforeShelf = inventory.shelfQuantity
      const afterShelf = beforeShelf + item.quantity
      const beforeWarehouse = inventory.warehouseQuantity

      await tx.inventory.update({
        where: { productId: item.productId },
        data: { shelfQuantity: afterShelf },
      })

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          type: StockMovementType.SALE_CANCEL,
          quantity: item.quantity,
          beforeWarehouse,
          afterWarehouse: beforeWarehouse,
          beforeShelf,
          afterShelf,
          description: `Satış iptali #${saleId}`,
          userId: adminUserId,
        },
      })
    }

    const total = toNumber(sale.total)
    if (sale.paymentType === PaymentType.CREDIT) {
      const debtTx = sale.creditTransactions.find((t) => t.type === CreditTransactionType.DEBT)
      if (debtTx) {
        const customer = await tx.customer.findUnique({ where: { id: debtTx.customerId } })
        if (customer) {
          const previousDebt = toNumber(customer.totalDebt)
          const newDebt = Math.max(0, previousDebt - total)
          await tx.customer.update({
            where: { id: customer.id },
            data: { totalDebt: decimal(newDebt) },
          })
          await tx.creditTransaction.create({
            data: {
              customerId: customer.id,
              saleId: sale.id,
              type: CreditTransactionType.PAYMENT,
              amount: decimal(total),
              description: `Satış iptali tahsilatı #${sale.id}`,
            },
          })
        }
      }
    }

    const cancelledAt = new Date()
    const updated = await tx.sale.update({
      where: { id: saleId },
      data: {
        status: SaleStatus.CANCELLED,
        cancelledAt,
        cancelledById: adminUserId,
        cancelReason: reason,
      },
      include: saleInclude,
    })

    await writeAuditLog(tx, {
      userId: adminUserId,
      actionType: 'CANCEL',
      title: 'Satış iptal edildi',
      description: reason,
      entityId: saleId,
      entityLabel: `Satış #${saleId}`,
      oldValues: {
        status: SaleStatus.COMPLETED,
        total,
        paymentType: sale.paymentType,
        dayEndLocked: dayEndExists,
      },
      newValues: {
        status: SaleStatus.CANCELLED,
        cancelReason: reason,
        cancelledAt: cancelledAt.toISOString(),
        forceAfterDayEnd: !!input.forceAfterDayEnd,
        stockRestored: sale.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      },
    })

    return serializeSale(updated)
  })
}

export async function listSales(userId: number, role: string, shiftId?: number) {
  const where: Prisma.SaleWhereInput = {}

  if (shiftId) {
    where.shiftId = shiftId
    if (role === 'ADMIN') {
      where.OR = [
        { status: SaleStatus.COMPLETED },
        { status: SaleStatus.CANCELLED, cancelledAt: { not: null } },
      ]
    } else {
      where.userId = userId
      where.status = SaleStatus.COMPLETED
    }
  } else if (role === 'ADMIN') {
    where.status = SaleStatus.COMPLETED
  } else {
    where.userId = userId
    where.status = SaleStatus.COMPLETED
  }

  const sales = await prisma.sale.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, username: true } },
      cancelledBy: { select: { id: true, fullName: true } },
      shift: { include: { dayEnd: { select: { id: true } } } },
      items: { select: { id: true, quantity: true } },
      payments: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return sales.map((sale) => ({
    id: sale.id,
    status: sale.status,
    paymentType: sale.paymentType,
    subtotal: toNumber(sale.subtotal),
    discount: toNumber(sale.discount),
    total: toNumber(sale.total),
    createdAt: sale.createdAt,
    cancelledAt: sale.cancelledAt,
    cancelReason: sale.cancelReason,
    cancelledByName: sale.cancelledBy?.fullName ?? null,
    dayEndTaken: !!sale.shift.dayEnd,
    user: sale.user,
    itemCount: sale.items.reduce((sum, i) => sum + i.quantity, 0),
    payments: sale.payments.map((p) => ({
      ...p,
      amount: toNumber(p.amount),
    })),
  }))
}

export async function getSaleById(id: number, userId: number, role: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: saleInclude,
  })

  if (!sale) {
    throw new AppError('Satış bulunamadı.', 404)
  }

  if (role !== 'ADMIN' && sale.userId !== userId) {
    throw new AppError('Bu satışa erişim yetkiniz yok.', 403)
  }

  return serializeSale(sale)
}

export async function listCustomers() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: 'asc' },
  })
  return customers.map((c) => ({
    ...c,
    totalDebt: toNumber(c.totalDebt),
  }))
}

export async function createCustomer(input: {
  name: string
  phone?: string
  note?: string
}) {
  const customer = await prisma.customer.create({
    data: {
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      note: input.note?.trim() || null,
      totalDebt: 0,
    },
  })
  return {
    ...customer,
    totalDebt: toNumber(customer.totalDebt),
  }
}
