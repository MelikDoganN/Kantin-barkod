import { PaymentType, Prisma, SaleStatus, ShiftStatus } from '@prisma/client'
import { prisma } from '../config/database'
import { buildImageUrl } from '../utils/product-image-url'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function todayRange(): { start: Date; end: Date; yesterdayStart: Date; yesterdayEnd: Date } {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const yesterdayStart = new Date(start)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const yesterdayEnd = start
  return { start, end, yesterdayStart, yesterdayEnd }
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export async function getDashboard() {
  const { start, end, yesterdayStart, yesterdayEnd } = todayRange()
  const todayWhere = { createdAt: { gte: start, lt: end }, status: SaleStatus.COMPLETED }

  const [
    todaySalesAgg,
    yesterdaySalesAgg,
    todayItemsAgg,
    paymentGroups,
    profitRows,
    hourlyRows,
    topProductRows,
    openShift,
    criticalProducts,
    recentSales,
    recentAudit,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: todayWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.sale.aggregate({
      where: { createdAt: { gte: yesterdayStart, lt: yesterdayEnd }, status: SaleStatus.COMPLETED },
      _sum: { total: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: todayWhere },
      _sum: { quantity: true },
    }),
    prisma.sale.groupBy({
      by: ['paymentType'],
      where: todayWhere,
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
    prisma.$queryRaw<Array<{ hour: number; total: Prisma.Decimal | number }>>`
      SELECT EXTRACT(HOUR FROM s."createdAt")::int AS hour,
             COALESCE(SUM(s.total), 0) AS total
      FROM "Sale" s
      WHERE s."createdAt" >= ${start} AND s."createdAt" < ${end}
        AND s.status = 'COMPLETED'
      GROUP BY EXTRACT(HOUR FROM s."createdAt")
      ORDER BY hour ASC
    `,
    prisma.$queryRaw<
      Array<{
        product_id: number
        product_name: string
        product_image: string | null
        quantity: bigint | number
        revenue: Prisma.Decimal | number
      }>
    >`
      SELECT p.id AS product_id,
             p.name AS product_name,
             p.image AS product_image,
             COALESCE(SUM(si.quantity), 0) AS quantity,
             COALESCE(SUM(si."totalPrice"), 0) AS revenue
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s.id = si."saleId"
      INNER JOIN "Product" p ON p.id = si."productId"
      WHERE s."createdAt" >= ${start} AND s."createdAt" < ${end}
        AND s.status = 'COMPLETED'
      GROUP BY p.id, p.name, p.image
      ORDER BY quantity DESC
      LIMIT 5
    `,
    prisma.shift.findFirst({
      where: { status: ShiftStatus.OPEN },
      orderBy: { startTime: 'desc' },
      include: {
        user: { select: { id: true, fullName: true } },
        sales: {
          where: { status: SaleStatus.COMPLETED },
          select: { paymentType: true, total: true },
        },
      },
    }),
    prisma.product.findMany({
      where: {
        isActive: true,
        inventory: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        image: true,
        minimumStock: true,
        inventory: { select: { shelfQuantity: true } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    }),
    prisma.sale.findMany({
      where: todayWhere,
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        total: true,
        createdAt: true,
        paymentType: true,
        user: { select: { fullName: true } },
        items: {
          select: { quantity: true, product: { select: { name: true } } },
          take: 2,
        },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        title: true,
        description: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
    }),
  ])

  const dailySales = round2(toNumber(todaySalesAgg._sum.total))
  const yesterdaySales = round2(toNumber(yesterdaySalesAgg._sum.total))
  const dailySalesTrend =
    yesterdaySales > 0
      ? round2(((dailySales - yesterdaySales) / yesterdaySales) * 100)
      : dailySales > 0
        ? 100
        : 0

  let cashSales = 0
  let cardSales = 0
  let creditSales = 0
  for (const row of paymentGroups) {
    const amount = toNumber(row._sum.total)
    if (row.paymentType === PaymentType.CASH) cashSales = amount
    else if (row.paymentType === PaymentType.CARD) cardSales = amount
    else creditSales = amount
  }

  const hourMap = new Map(hourlyRows.map((r) => [Number(r.hour), round2(toNumber(r.total))]))
  const chartHours = [8, 10, 12, 14, 16, 18, 20]
  const salesChart = chartHours.map((h) => ({
    label: formatHourLabel(h),
    amount: hourMap.get(h) ?? 0,
  }))
  // Fill any hour that has data but isn't in the defaults
  for (const [hour, amount] of hourMap) {
    if (!chartHours.includes(hour) && amount > 0) {
      salesChart.push({ label: formatHourLabel(hour), amount })
    }
  }
  salesChart.sort((a, b) => a.label.localeCompare(b.label))

  let activeShift: {
    id: number
    personnel: string
    startTime: string
    openingCash: number
    cashSales: number
    cardSales: number
    creditSales: number
    totalSales: number
  } | null = null

  if (openShift) {
    let shiftCash = 0
    let shiftCard = 0
    let shiftCredit = 0
    for (const sale of openShift.sales) {
      const amount = toNumber(sale.total)
      if (sale.paymentType === PaymentType.CASH) shiftCash += amount
      else if (sale.paymentType === PaymentType.CARD) shiftCard += amount
      else if (sale.paymentType === PaymentType.CREDIT) shiftCredit += amount
    }
    activeShift = {
      id: openShift.id,
      personnel: openShift.user.fullName,
      startTime: openShift.startTime.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      openingCash: round2(toNumber(openShift.openingCash)),
      cashSales: round2(shiftCash),
      cardSales: round2(shiftCard),
      creditSales: round2(shiftCredit),
      totalSales: round2(shiftCash + shiftCard + shiftCredit),
    }
  }

  const criticalStock = criticalProducts
    .filter((p) => (p.inventory?.shelfQuantity ?? 0) <= p.minimumStock)
    .slice(0, 4)
    .map((p) => {
      const imagePath = p.image ?? null
      return {
        id: p.id,
        name: p.name,
        icon: '📦',
        imagePath,
        imageUrl: buildImageUrl(imagePath),
        shelfStock: p.inventory?.shelfQuantity ?? 0,
        criticalLevel: p.minimumStock,
      }
    })

  const recentSaleActivities = recentSales.map((sale) => {
    const itemLabel =
      sale.items.length === 0
        ? 'satış'
        : sale.items.length === 1
          ? `${sale.items[0].quantity} adet ${sale.items[0].product.name}`
          : `${sale.items.map((i) => i.product.name).join(', ')}`
    return {
      id: `sale-${sale.id}`,
      time: sale.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      user: sale.user.fullName,
      description: `${itemLabel} sattı · ${round2(toNumber(sale.total)).toLocaleString('tr-TR')} ₺`,
    }
  })

  const recentAuditActivities = recentAudit.map((log) => ({
    id: `audit-${log.id}`,
    time: log.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    user: log.user?.fullName ?? 'Sistem',
    description: log.description?.trim() || log.title,
  }))

  const recentActivities = [...recentSaleActivities, ...recentAuditActivities]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 8)

  return {
    todaySales: dailySales,
    todayOrders: todaySalesAgg._count._all,
    soldProducts: todayItemsAgg._sum.quantity ?? 0,
    cashSales: round2(cashSales),
    cardSales: round2(cardSales),
    creditSales: round2(creditSales),
    estimatedProfit: round2(toNumber(profitRows[0]?.profit)),
    dailySalesTrend,
    salesChart,
    topProducts: topProductRows.map((row) => {
      const imagePath = row.product_image ?? null
      return {
        id: String(row.product_id),
        name: row.product_name,
        icon: '📦',
        imagePath,
        imageUrl: buildImageUrl(imagePath),
        quantity: Number(row.quantity),
        total: round2(toNumber(row.revenue)),
      }
    }),
    activeShift,
    criticalStock,
    recentSales: recentSales.map((s) => ({
      id: s.id,
      time: s.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      personnel: s.user.fullName,
      paymentType: s.paymentType,
      total: round2(toNumber(s.total)),
    })),
    recentActivities,
  }
}
