import { PaymentType, Prisma, SaleStatus, UserRole, UserStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl } from '../utils/product-image-url'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** YYYY-MM-DD → [startInclusive, endExclusive) */
export function parseDateRange(startDate?: string, endDate?: string): { start: Date; end: Date } {
  const today = new Date()
  const defaultStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const defaultEnd = new Date(defaultStart)
  defaultEnd.setDate(defaultEnd.getDate() + 1)

  if (!startDate && !endDate) {
    return { start: defaultStart, end: defaultEnd }
  }

  if (!startDate || !endDate) {
    throw new AppError('startDate ve endDate birlikte gönderilmelidir.', 400)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new AppError('Tarih formatı YYYY-MM-DD olmalıdır.', 400)
  }

  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0)
  const end = new Date(ey, em - 1, ed + 1, 0, 0, 0, 0)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Geçersiz tarih aralığı.', 400)
  }
  if (start >= end) {
    throw new AppError('Başlangıç tarihi bitiş tarihinden sonra olamaz.', 400)
  }

  return { start, end }
}

function saleCreatedAtFilter(start: Date, end: Date): Prisma.SaleWhereInput {
  return { createdAt: { gte: start, lt: end }, status: SaleStatus.COMPLETED }
}

export async function getSummary(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)
  const where = saleCreatedAtFilter(start, end)

  const [salesAgg, itemsAgg, paymentGroups, profitRows] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: where },
      _sum: { quantity: true },
    }),
    prisma.sale.groupBy({
      by: ['paymentType'],
      where,
      _sum: { total: true },
    }),
    prisma.$queryRaw<Array<{ profit: Prisma.Decimal | number | null }>>`
      SELECT COALESCE(SUM((si."unitPrice" - p."purchasePrice") * si.quantity), 0) AS profit
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."createdAt" >= ${start} AND s."createdAt" < ${end}
        AND s.status = 'COMPLETED'
    `,
  ])

  const totalSales = round2(toNumber(salesAgg._sum.total))
  const totalOrders = salesAgg._count._all
  const soldProducts = itemsAgg._sum.quantity ?? 0
  const estimatedProfit = round2(toNumber(profitRows[0]?.profit))
  const averageBasket = totalOrders > 0 ? round2(totalSales / totalOrders) : 0

  let cashAmount = 0
  let cardAmount = 0
  let creditAmount = 0
  for (const row of paymentGroups) {
    const amount = toNumber(row._sum.total)
    if (row.paymentType === PaymentType.CASH) cashAmount = amount
    else if (row.paymentType === PaymentType.CARD) cardAmount = amount
    else if (row.paymentType === PaymentType.CREDIT) creditAmount = amount
  }

  return {
    totalSales,
    totalOrders,
    soldProducts,
    estimatedProfit,
    averageBasket,
    cashAmount: round2(cashAmount),
    cardAmount: round2(cardAmount),
    creditAmount: round2(creditAmount),
  }
}

export async function getSalesTrend(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)

  const rows = await prisma.$queryRaw<Array<{ date: Date; total: Prisma.Decimal | number }>>`
    SELECT DATE_TRUNC('day', s."createdAt") AS date,
           COALESCE(SUM(s.total), 0) AS total
    FROM "Sale" s
    WHERE s."createdAt" >= ${start} AND s."createdAt" < ${end}
      AND s.status = 'COMPLETED'
    GROUP BY DATE_TRUNC('day', s."createdAt")
    ORDER BY date ASC
  `

  return rows.map((row) => {
    const d = row.date instanceof Date ? row.date : new Date(row.date)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return {
      date: `${yyyy}-${mm}-${dd}`,
      total: round2(toNumber(row.total)),
    }
  })
}

export async function getPaymentSummary(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)

  const groups = await prisma.sale.groupBy({
    by: ['paymentType'],
    where: saleCreatedAtFilter(start, end),
    _sum: { total: true },
  })

  const byType: Record<PaymentType, number> = {
    CASH: 0,
    CARD: 0,
    CREDIT: 0,
  }
  for (const row of groups) {
    if (!row.paymentType) continue
    byType[row.paymentType] = round2(toNumber(row._sum.total))
  }

  const grand = byType.CASH + byType.CARD + byType.CREDIT

  return (['CASH', 'CARD', 'CREDIT'] as PaymentType[]).map((type) => ({
    type,
    amount: byType[type],
    percent: grand > 0 ? round2((byType[type] / grand) * 100) : 0,
  }))
}

export async function getTopProducts(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)

  const rows = await prisma.$queryRaw<
    Array<{
      product_id: number
      product_name: string
      product_image: string | null
      quantity: bigint | number
      revenue: Prisma.Decimal | number
      profit: Prisma.Decimal | number
    }>
  >`
    SELECT p.id AS product_id,
           p.name AS product_name,
           p.image AS product_image,
           COALESCE(SUM(si.quantity), 0) AS quantity,
           COALESCE(SUM(si."totalPrice"), 0) AS revenue,
           COALESCE(SUM((si."unitPrice" - p."purchasePrice") * si.quantity), 0) AS profit
    FROM "SaleItem" si
    INNER JOIN "Sale" s ON s.id = si."saleId"
    INNER JOIN "Product" p ON p.id = si."productId"
    WHERE s."createdAt" >= ${start} AND s."createdAt" < ${end}
      AND s.status = 'COMPLETED'
    GROUP BY p.id, p.name, p.image
    ORDER BY quantity DESC, revenue DESC
    LIMIT 10
  `

  return rows.map((row) => {
    const imagePath = row.product_image ?? null
    return {
      productId: row.product_id,
      product: row.product_name,
      image: imagePath,
      imagePath,
      imageUrl: buildImageUrl(imagePath),
      quantity: Number(row.quantity),
      revenue: round2(toNumber(row.revenue)),
      estimatedProfit: round2(toNumber(row.profit)),
    }
  })
}

export async function getStockReport() {
  const [products, inventoryAgg, wasteAgg] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        minimumStock: true,
        inventory: {
          select: { warehouseQuantity: true, shelfQuantity: true },
        },
      },
    }),
    prisma.inventory.aggregate({
      _sum: { warehouseQuantity: true, shelfQuantity: true },
    }),
    prisma.wasteRecord.aggregate({
      _sum: { quantity: true },
    }),
  ])

  let criticalProducts = 0
  let lowProducts = 0

  for (const p of products) {
    const shelf = p.inventory?.shelfQuantity ?? 0
    if (shelf <= p.minimumStock) criticalProducts += 1
    else if (shelf <= p.minimumStock * 2) lowProducts += 1
  }

  return {
    totalProducts: products.length,
    criticalProducts,
    lowProducts,
    totalWarehouse: inventoryAgg._sum.warehouseQuantity ?? 0,
    totalShelf: inventoryAgg._sum.shelfQuantity ?? 0,
    wasteCount: wasteAgg._sum.quantity ?? 0,
  }
}

export async function getPersonnelReport(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)

  const [saleGroups, shiftGroups, users] = await Promise.all([
    prisma.sale.groupBy({
      by: ['userId'],
      where: saleCreatedAtFilter(start, end),
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.shift.groupBy({
      by: ['userId'],
      where: { startTime: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [
          { role: UserRole.PERSONNEL },
          { sales: { some: saleCreatedAtFilter(start, end) } },
        ],
      },
      select: { id: true, fullName: true, status: true, role: true },
    }),
  ])

  const salesByUser = new Map(
    saleGroups.map((g) => [
      g.userId,
      { saleCount: g._count._all, totalSales: round2(toNumber(g._sum.total)) },
    ]),
  )
  const shiftsByUser = new Map(shiftGroups.map((g) => [g.userId, g._count._all]))

  return users
    .map((user) => {
      const sales = salesByUser.get(user.id) ?? { saleCount: 0, totalSales: 0 }
      return {
        userId: user.id,
        personnel: user.fullName,
        role: user.role,
        status: user.status === UserStatus.ACTIVE ? 'active' : 'passive',
        saleCount: sales.saleCount,
        totalSales: sales.totalSales,
        averageBasket: sales.saleCount > 0 ? round2(sales.totalSales / sales.saleCount) : 0,
        shiftCount: shiftsByUser.get(user.id) ?? 0,
      }
    })
    .sort((a, b) => b.totalSales - a.totalSales)
}

export async function getDayEndReport(limit = 10) {
  const rows = await prisma.dayEnd.findMany({
    take: Math.min(Math.max(limit, 1), 50),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      totalSales: true,
      cashDifference: true,
      status: true,
      user: { select: { id: true, fullName: true } },
    },
  })

  return rows.map((row) => ({
    id: row.id,
    date: row.createdAt.toLocaleDateString('tr-TR'),
    createdAt: row.createdAt.toISOString(),
    personnel: row.user.fullName,
    userId: row.user.id,
    sales: round2(toNumber(row.totalSales)),
    cashDifference: round2(toNumber(row.cashDifference)),
    status: row.status.toLowerCase(),
  }))
}

export async function getConsumptionSummary(startDate?: string, endDate?: string) {
  const { start, end } = parseDateRange(startDate, endDate)

  const [byUser, byProduct, costAgg] = await Promise.all([
    prisma.personnelConsumption.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: start, lt: end } },
      _sum: { quantity: true, cost: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 1,
    }),
    prisma.personnelConsumption.groupBy({
      by: ['productId'],
      where: { createdAt: { gte: start, lt: end } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 1,
    }),
    prisma.personnelConsumption.aggregate({
      where: { createdAt: { gte: start, lt: end } },
      _sum: { cost: true, quantity: true },
    }),
  ])

  let topPersonnel = '—'
  let topPersonnelItems = 0
  if (byUser[0]) {
    const user = await prisma.user.findUnique({
      where: { id: byUser[0].userId },
      select: { fullName: true },
    })
    topPersonnel = user?.fullName ?? '—'
    topPersonnelItems = byUser[0]._sum.quantity ?? 0
  }

  let topProduct = '—'
  let topProductItems = 0
  if (byProduct[0]) {
    const product = await prisma.product.findUnique({
      where: { id: byProduct[0].productId },
      select: { name: true },
    })
    topProduct = product?.name ?? '—'
    topProductItems = byProduct[0]._sum.quantity ?? 0
  }

  return {
    topPersonnel,
    topPersonnelItems,
    topProduct,
    topProductItems,
    totalQuantity: costAgg._sum.quantity ?? 0,
    totalCost: round2(toNumber(costAgg._sum.cost)),
    monthCost: round2(toNumber(costAgg._sum.cost)),
  }
}
