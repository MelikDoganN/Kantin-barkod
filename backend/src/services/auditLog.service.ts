import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'passwordHash',
  'currentpassword',
  'currentPassword',
  'newpassword',
  'newPassword',
  'newpasswordconfirm',
  'newPasswordConfirm',
  'passwordconfirm',
  'passwordConfirm',
  'token',
  'accesstoken',
  'accessToken',
  'refreshtoken',
  'refreshToken',
  'jwt',
  'jwt_secret',
  'JWT_SECRET',
  'secret',
  'authorization',
])

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
  if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(normalized)) return true
  return (
    normalized.includes('password') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('hash')
  )
}

function sanitizeJson(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { value }
  }
  const result: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) continue
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      result[key] = sanitizeJson(raw as Prisma.JsonValue)
    } else {
      result[key] = raw
    }
  }
  return result
}

function deriveStatus(actionType: string): 'success' | 'failed' {
  const upper = actionType.toUpperCase()
  if (upper.includes('FAILED') || upper.includes('FAIL') || upper === 'ERROR') {
    return 'failed'
  }
  return 'success'
}

function parseDay(date?: string): { start: Date; end: Date; date: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let iso = date?.trim()
  if (!iso) {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    iso = `${y}-${m}-${d}`
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    throw new AppError('Tarih formatı YYYY-MM-DD olmalıdır.', 400)
  }

  const [y, m, d] = iso.split('-').map(Number)
  const start = new Date(y, m - 1, d, 0, 0, 0, 0)
  if (Number.isNaN(start.getTime())) {
    throw new AppError('Geçersiz tarih.', 400)
  }
  if (start.getTime() > today.getTime()) {
    throw new AppError('Gelecek tarih seçilemez.', 400)
  }

  const end = new Date(y, m - 1, d, 23, 59, 59, 999)
  return { start, end, date: iso }
}

function serializeUser(
  user:
    | {
        id: number
        fullName: string
        username: string
        role: string
      }
    | null
    | undefined,
) {
  if (!user) return null
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  }
}

function serializeItem(row: {
  id: number
  createdAt: Date
  module: string
  actionType: string
  title: string
  description: string | null
  entityType: string
  entityId: number | null
  entityLabel: string | null
  deviceName: string | null
  ipAddress: string | null
  user: { id: number; fullName: string; username: string; role: string } | null
}) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    time: row.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    user: serializeUser(row.user),
    module: row.module,
    actionType: row.actionType,
    title: row.title,
    description: row.description,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    status: deriveStatus(row.actionType),
    deviceName: row.deviceName,
    ipAddress: row.ipAddress,
  }
}

function buildWhere(filters: {
  date?: string
  userId?: number
  module?: string
  actionType?: string
  status?: string
  search?: string
}): { where: Prisma.AuditLogWhereInput; day: { start: Date; end: Date; date: string } } {
  const day = parseDay(filters.date)
  const and: Prisma.AuditLogWhereInput[] = [
    { createdAt: { gte: day.start, lte: day.end } },
  ]

  if (filters.userId) and.push({ userId: filters.userId })
  if (filters.module) and.push({ module: filters.module })
  if (filters.actionType) and.push({ actionType: filters.actionType })

  if (filters.status) {
    const status = filters.status.toLowerCase()
    if (status === 'failed') {
      and.push({
        OR: [
          { actionType: { contains: 'FAILED' } },
          { actionType: { equals: 'FAIL' } },
        ],
      })
    } else if (status === 'success') {
      and.push({
        NOT: {
          OR: [
            { actionType: { contains: 'FAILED' } },
            { actionType: { equals: 'FAIL' } },
          ],
        },
      })
    } else {
      throw new AppError('Durum success veya failed olmalıdır.', 400)
    }
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim()
    and.push({
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { entityLabel: { contains: q } },
        { user: { username: { contains: q } } },
        { user: { fullName: { contains: q } } },
      ],
    })
  }

  return { where: { AND: and }, day }
}

export async function listAuditLogs(filters: {
  date?: string
  userId?: number
  module?: string
  actionType?: string
  status?: string
  search?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, filters.page ?? 1)
  let limit = filters.limit ?? 25
  if (limit < 1) limit = 25
  if (limit > 100) limit = 100

  const { where } = buildWhere(filters)
  const skip = (page - 1) * limit

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, username: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return {
    items: rows.map(serializeItem),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function getAuditLogById(id: number) {
  const row = await prisma.auditLog.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, username: true, role: true } },
    },
  })
  if (!row) throw new AppError('Log kaydı bulunamadı.', 404)

  return {
    ...serializeItem(row),
    oldValues: sanitizeJson(row.oldValues as Prisma.JsonValue | null),
    newValues: sanitizeJson(row.newValues as Prisma.JsonValue | null),
    metadata: null as Record<string, unknown> | null,
  }
}

export async function getAuditSummary(date?: string) {
  const day = parseDay(date)

  const [total, modules, failed] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: { gte: day.start, lte: day.end } },
    }),
    prisma.auditLog.groupBy({
      by: ['module'],
      where: { createdAt: { gte: day.start, lte: day.end } },
      _count: { _all: true },
      orderBy: { _count: { module: 'desc' } },
    }),
    prisma.auditLog.count({
      where: {
        createdAt: { gte: day.start, lte: day.end },
        OR: [
          { actionType: { contains: 'FAILED' } },
          { actionType: { contains: 'FAIL' } },
        ],
      },
    }),
  ])

  const moduleMap = new Map(modules.map((m) => [m.module.toUpperCase(), m._count._all]))
  const countOf = (...keys: string[]) =>
    keys.reduce((sum, key) => sum + (moduleMap.get(key) ?? 0), 0)

  return {
    totalOperations: total,
    saleOperations: countOf('SALE', 'SALES'),
    stockOperations: countOf('STOCK', 'COUNT', 'PERSONNEL_CONSUMPTION'),
    userOperations: countOf('USER', 'AUTH', 'PERSONNEL'),
    failedOperations: failed,
    modules: modules.map((m) => ({
      module: m.module,
      count: m._count._all,
    })),
  }
}

export async function getAuditFilters() {
  const [users, modules, actionTypes] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, fullName: true, username: true, status: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['module'],
      select: { module: true },
      orderBy: { module: 'asc' },
    }),
    prisma.auditLog.findMany({
      distinct: ['actionType'],
      select: { actionType: true },
      orderBy: { actionType: 'asc' },
    }),
  ])

  return {
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      status: u.status,
    })),
    modules: modules.map((m) => m.module),
    actionTypes: actionTypes.map((a) => a.actionType),
  }
}
