import { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { buildImageUrl, serializeProductBrief } from '../utils/product-image-url'

export type StockStatus = 'Normal' | 'Düşük' | 'Kritik'

function computeStatus(shelfQuantity: number, minimumStock: number): StockStatus {
  if (shelfQuantity <= minimumStock) return 'Kritik'
  if (shelfQuantity <= minimumStock * 2) return 'Düşük'
  return 'Normal'
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  params: {
    userId: number | null
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
      module: 'STOCK',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'Product',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

async function getProductWithInventory(tx: Prisma.TransactionClient, productId: number) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    include: { inventory: true, category: { select: { id: true, name: true } } },
  })
  if (!product) {
    throw new AppError('Ürün bulunamadı.', 404)
  }
  if (!product.isActive) {
    throw new AppError('Pasif ürünler için stok işlemi yapılamaz.', 400)
  }

  let inventory = product.inventory
  if (!inventory) {
    inventory = await tx.inventory.create({
      data: { productId, warehouseQuantity: 0, shelfQuantity: 0 },
    })
  }

  return { product, inventory }
}

export async function listInventory() {
  const rows = await prisma.product.findMany({
    where: { inventory: { isNot: null } },
    include: {
      category: { select: { id: true, name: true } },
      inventory: true,
    },
    orderBy: { name: 'asc' },
  })

  // Inventory kaydı olmayan aktif ürünleri de listeye dahil et
  const withoutInventory = await prisma.product.findMany({
    where: { inventory: null },
    include: {
      category: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  })

  const mapped = [
    ...rows.map((p) => {
      const warehouseQuantity = p.inventory?.warehouseQuantity ?? 0
      const shelfQuantity = p.inventory?.shelfQuantity ?? 0
      return {
        productId: p.id,
        product: serializeProductBrief(p),
        warehouseQuantity,
        shelfQuantity,
        totalQuantity: warehouseQuantity + shelfQuantity,
        minimumStock: p.minimumStock,
        unitsPerCarton: p.unitsPerCarton,
        unitType: p.unitType,
        isActive: p.isActive,
        status: computeStatus(shelfQuantity, p.minimumStock),
      }
    }),
    ...withoutInventory.map((p) => ({
      productId: p.id,
      product: serializeProductBrief({ ...p, image: null }),
      warehouseQuantity: 0,
      shelfQuantity: 0,
      totalQuantity: 0,
      minimumStock: p.minimumStock,
      unitsPerCarton: p.unitsPerCarton,
      unitType: p.unitType,
      isActive: p.isActive,
      status: computeStatus(0, p.minimumStock),
    })),
  ]

  return mapped.sort((a, b) => a.product.name.localeCompare(b.product.name, 'tr'))
}

export async function getInventorySummary() {
  const items = await listInventory()
  return {
    totalProducts: items.length,
    warehouseStock: items.reduce((sum, i) => sum + i.warehouseQuantity, 0),
    shelfStock: items.reduce((sum, i) => sum + i.shelfQuantity, 0),
    criticalCount: items.filter((i) => i.status === 'Kritik').length,
  }
}

export interface ReceiptInput {
  productId: number
  quantity: number
  unitType: 'unit' | 'case'
  cartonCount?: number
  description?: string
}

export async function goodsReceipt(input: ReceiptInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const { product, inventory } = await getProductWithInventory(tx, input.productId)

    let units: number
    if (input.unitType === 'case') {
      const cartonCount = input.cartonCount ?? input.quantity
      if (!Number.isInteger(cartonCount) || cartonCount <= 0) {
        throw new AppError('Koli adedi 0\'dan büyük olmalıdır.', 400)
      }
      units = cartonCount * product.unitsPerCarton
    } else {
      if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
        throw new AppError('Miktar 0\'dan büyük olmalıdır.', 400)
      }
      units = input.quantity
    }

    const beforeWarehouse = inventory.warehouseQuantity
    const beforeShelf = inventory.shelfQuantity
    const afterWarehouse = beforeWarehouse + units
    const afterShelf = beforeShelf

    const updated = await tx.inventory.update({
      where: { productId: product.id },
      data: { warehouseQuantity: afterWarehouse },
    })

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.PURCHASE,
        quantity: units,
        beforeWarehouse,
        afterWarehouse,
        beforeShelf,
        afterShelf,
        description: input.description ?? 'Mal kabul',
        userId,
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'PURCHASE',
      title: 'Mal kabul yapıldı',
      description: `${product.name} için depoya ${units} adet eklendi`,
      entityId: product.id,
      entityLabel: product.name,
      oldValues: { warehouseQuantity: beforeWarehouse, shelfQuantity: beforeShelf },
      newValues: { warehouseQuantity: afterWarehouse, shelfQuantity: afterShelf },
    })

    return { inventory: updated, movement, units }
  })
}

export interface OpenCartonInput {
  productId: number
  cartonCount: number
  description?: string
}

export async function openCarton(input: OpenCartonInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const { product, inventory } = await getProductWithInventory(tx, input.productId)

    if (!Number.isInteger(input.cartonCount) || input.cartonCount <= 0) {
      throw new AppError('Açılacak koli adedi 0\'dan büyük olmalıdır.', 400)
    }

    const units = input.cartonCount * product.unitsPerCarton
    if (units <= 0) {
      throw new AppError('Bu ürün için koli içi adet tanımlı değil.', 400)
    }

    if (inventory.warehouseQuantity < units) {
      throw new AppError('Depo stoğu yetersiz.', 400)
    }

    const beforeWarehouse = inventory.warehouseQuantity
    const beforeShelf = inventory.shelfQuantity
    const afterWarehouse = beforeWarehouse - units
    const afterShelf = beforeShelf + units

    const updated = await tx.inventory.update({
      where: { productId: product.id },
      data: {
        warehouseQuantity: afterWarehouse,
        shelfQuantity: afterShelf,
      },
    })

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.CARTON_OPEN,
        quantity: units,
        beforeWarehouse,
        afterWarehouse,
        beforeShelf,
        afterShelf,
        description: input.description ?? `${input.cartonCount} koli açıldı`,
        userId,
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'CARTON_OPEN',
      title: 'Koli açıldı',
      description: `${product.name}: depodan ${units} adet rafa aktarıldı`,
      entityId: product.id,
      entityLabel: product.name,
      oldValues: { warehouseQuantity: beforeWarehouse, shelfQuantity: beforeShelf },
      newValues: { warehouseQuantity: afterWarehouse, shelfQuantity: afterShelf },
    })

    return { inventory: updated, movement, units }
  })
}

export interface WasteInput {
  productId: number
  quantity: number
  reason: string
  description?: string
}

export async function recordWaste(input: WasteInput, userId: number) {
  return prisma.$transaction(async (tx) => {
    const { product, inventory } = await getProductWithInventory(tx, input.productId)

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new AppError('Miktar 0\'dan büyük olmalıdır.', 400)
    }
    if (!input.reason.trim()) {
      throw new AppError('Fire sebebi zorunludur.', 400)
    }
    if (inventory.shelfQuantity < input.quantity) {
      throw new AppError('Raf stoğu yetersiz.', 400)
    }

    const beforeWarehouse = inventory.warehouseQuantity
    const beforeShelf = inventory.shelfQuantity
    const afterWarehouse = beforeWarehouse
    const afterShelf = beforeShelf - input.quantity

    const updated = await tx.inventory.update({
      where: { productId: product.id },
      data: { shelfQuantity: afterShelf },
    })

    const waste = await tx.wasteRecord.create({
      data: {
        productId: product.id,
        quantity: input.quantity,
        reason: input.reason.trim(),
        description: input.description?.trim() || null,
        userId,
      },
    })

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: StockMovementType.WASTE,
        quantity: input.quantity,
        beforeWarehouse,
        afterWarehouse,
        beforeShelf,
        afterShelf,
        description: input.description?.trim() || input.reason.trim(),
        userId,
      },
    })

    await writeAuditLog(tx, {
      userId,
      actionType: 'WASTE',
      title: 'Fire / zayi kaydı oluşturuldu',
      description: `${product.name}: raftan ${input.quantity} adet düşüldü (${input.reason})`,
      entityId: product.id,
      entityLabel: product.name,
      oldValues: { warehouseQuantity: beforeWarehouse, shelfQuantity: beforeShelf },
      newValues: { warehouseQuantity: afterWarehouse, shelfQuantity: afterShelf },
    })

    return { inventory: updated, waste, movement }
  })
}

export interface MovementFilters {
  productId?: number
  type?: StockMovementType
  date?: string
}

export async function listMovements(filters: MovementFilters = {}) {
  const where: Prisma.StockMovementWhereInput = {}

  if (filters.productId) {
    where.productId = filters.productId
  }
  if (filters.type) {
    where.type = filters.type
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

  const movements = await prisma.stockMovement.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, barcode: true, image: true } },
      user: { select: { id: true, fullName: true, username: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return movements.map((m) => ({
    id: m.id,
    productId: m.productId,
    product: m.product.name,
    barcode: m.product.barcode,
    productImagePath: m.product.image ?? null,
    productImageUrl: buildImageUrl(m.product.image ?? null),
    type: m.type,
    quantity: m.quantity,
    beforeWarehouse: m.beforeWarehouse,
    afterWarehouse: m.afterWarehouse,
    beforeShelf: m.beforeShelf,
    afterShelf: m.afterShelf,
    description: m.description,
    user: m.user?.fullName ?? 'Sistem',
    userId: m.userId,
    createdAt: m.createdAt,
  }))
}

export async function listWasteRecords() {
  const records = await prisma.wasteRecord.findMany({
    include: {
      product: { select: { id: true, name: true } },
      user: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return records.map((r) => ({
    id: r.id,
    productId: r.productId,
    product: r.product.name,
    quantity: r.quantity,
    reason: r.reason,
    description: r.description,
    user: r.user?.fullName ?? 'Sistem',
    createdAt: r.createdAt,
  }))
}

export async function listPurchaseMovements() {
  const movements = await listMovements({ type: StockMovementType.PURCHASE })
  return movements.map((m) => ({
    id: m.id,
    productName: m.product,
    quantity: m.quantity,
    date: m.createdAt,
    user: m.user,
    description: m.description,
  }))
}

export interface InitialLoadItem {
  productId: number
  depotQuantity: number
  shelfQuantity: number
}

export async function initialStockLoad(items: InitialLoadItem[], userId: number) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('En az bir ürün gönderilmelidir.', 400)
  }

  const seen = new Set<number>()
  for (const item of items) {
    if (seen.has(item.productId)) {
      throw new AppError(`Ürün #${item.productId} listede birden fazla kez yer alıyor.`, 400)
    }
    seen.add(item.productId)

    if (
      !Number.isInteger(item.depotQuantity) ||
      !Number.isInteger(item.shelfQuantity) ||
      item.depotQuantity < 0 ||
      item.shelfQuantity < 0
    ) {
      throw new AppError('Depo ve raf stokları negatif olmayan tam sayı olmalıdır.', 400)
    }
  }

  return prisma.$transaction(async (tx) => {
    const updatedItems: Array<{
      productId: number
      product: string
      beforeWarehouse: number
      afterWarehouse: number
      beforeShelf: number
      afterShelf: number
    }> = []

    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true },
      })
      if (!product) {
        throw new AppError(`Ürün bulunamadı (#${item.productId}).`, 404)
      }

      let inventory = product.inventory
      if (!inventory) {
        inventory = await tx.inventory.create({
          data: { productId: product.id, warehouseQuantity: 0, shelfQuantity: 0 },
        })
      }

      const beforeWarehouse = inventory.warehouseQuantity
      const beforeShelf = inventory.shelfQuantity
      const afterWarehouse = item.depotQuantity
      const afterShelf = item.shelfQuantity

      if (beforeWarehouse === afterWarehouse && beforeShelf === afterShelf) {
        continue
      }

      await tx.inventory.update({
        where: { productId: product.id },
        data: {
          warehouseQuantity: afterWarehouse,
          shelfQuantity: afterShelf,
        },
      })

      const quantity =
        Math.abs(afterWarehouse - beforeWarehouse) + Math.abs(afterShelf - beforeShelf)

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: 'INITIAL_STOCK' as StockMovementType,
          quantity,
          beforeWarehouse,
          afterWarehouse,
          beforeShelf,
          afterShelf,
          description: 'İlk sistem kurulumu stok girişi',
          userId,
        },
      })

      updatedItems.push({
        productId: product.id,
        product: product.name,
        beforeWarehouse,
        afterWarehouse,
        beforeShelf,
        afterShelf,
      })
    }

    if (updatedItems.length === 0) {
      throw new AppError('Değişiklik yapılacak stok bulunamadı.', 400)
    }

    await tx.auditLog.create({
      data: {
        userId,
        module: 'INVENTORY',
        actionType: 'INITIAL_STOCK_LOAD',
        title: 'İlk stok girişi yapıldı',
        description: `${updatedItems.length} ürün için toplu stok tanımlandı`,
        entityType: 'Inventory',
        entityId: updatedItems[0]!.productId,
        entityLabel: `${updatedItems.length} ürün`,
        newValues: {
          count: updatedItems.length,
          items: updatedItems,
        },
      },
    })

    return {
      updatedCount: updatedItems.length,
      items: updatedItems,
    }
  })
}
