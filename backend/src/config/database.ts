import { Prisma, PrismaClient } from '@prisma/client'
import { env } from './env'

const moneyFields = new Set([
  'purchasePrice',
  'salePrice',
  'openingCash',
  'closingCash',
  'expectedCash',
  'difference',
  'subtotal',
  'discount',
  'total',
  'unitPrice',
  'totalPrice',
  'amount',
  'totalDebt',
  'totalSales',
  'cashAmount',
  'cardAmount',
  'creditAmount',
  'cashDifference',
  'cost',
])

function toCents(value: number): number {
  const cents = Math.round((Math.abs(value) + Number.EPSILON) * 100) * Math.sign(value)
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 2147483647) {
    throw new Error('Para tutarı desteklenen sınırın dışında.')
  }
  return cents
}

const relations = new Map(Prisma.dmmf.datamodel.models.map((model) => [
  model.name, new Map(model.fields.filter((field) => field.kind === 'object').map((field) => [field.name, field.type])),
]))

function mapMoney(value: unknown, direction: 'store' | 'read', model: string, key?: string): unknown {
  if (['oldValues', 'newValues', '_count'].includes(key ?? '')) return value
  if (value instanceof Date || Buffer.isBuffer(value)) return value
  if (key && moneyFields.has(key) && (key !== 'difference' || model === 'Shift')) {
    if (typeof value === 'number') return direction === 'store' ? toCents(value) : value / 100
    if (Array.isArray(value)) {
      return value.map((entry) =>
        typeof entry === 'number' ? (direction === 'store' ? toCents(entry) : entry / 100) : entry,
      )
    }
    if (value && typeof value === 'object') {
      const operations = value as Record<string, unknown>
      return Object.fromEntries(
        Object.entries(operations).map(([operation, operand]) => [
          operation,
          ['multiply', 'divide'].includes(operation)
            ? operand
            : mapMoney(operand, direction, model, key),
        ]),
      )
    }
    return value
  }
  if (Array.isArray(value)) return value.map((entry) => mapMoney(entry, direction, model))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, child]) => [
        childKey,
        mapMoney(child, direction, relations.get(model)?.get(childKey) ?? model, childKey),
      ]),
    )
  }
  return value
}

// Store every monetary field as integer cents; expose currency amounts to services/API.
function createPrismaClient() {
  return new PrismaClient({
    log: env.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query, operation, model }) {
          const storedArgs = Object.fromEntries(
            Object.entries(args ?? {}).map(([key, value]) => [
              key, ['data', 'create', 'update', 'where', 'having'].includes(key) ? mapMoney(value, 'store', model) : value,
            ]),
          ) as typeof args
          const result = await query(storedArgs)
          return operation === 'count' ? result : mapMoney(result, 'read', model)
        },
      },
    },
  })
}

type ExtendedPrismaClient = ReturnType<typeof createPrismaClient>
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrismaClient | undefined }
export const prisma = globalForPrisma.prisma ?? createPrismaClient()
export type AppTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma
}
