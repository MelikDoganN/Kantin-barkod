import {
  Prisma,
  ShiftStatus,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { hashPassword, verifyPassword } from '../utils/password'

function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return typeof value === 'number' ? value : Number(value.toString())
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function writeUserAudit(
  tx: Prisma.TransactionClient | typeof prisma,
  params: {
    actorId: number
    actionType: string
    title: string
    description?: string
    entityId: number
    entityLabel: string
    module?: string
    oldValues?: Prisma.InputJsonValue
    newValues?: Prisma.InputJsonValue
  },
) {
  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      module: params.module ?? 'USER',
      actionType: params.actionType,
      title: params.title,
      description: params.description,
      entityType: 'User',
      entityId: params.entityId,
      entityLabel: params.entityLabel,
      oldValues: params.oldValues,
      newValues: params.newValues,
    },
  })
}

async function countActiveAdmins(tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.user.count({
    where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  })
}

function publicUser(user: {
  id: number
  fullName: string
  username: string
  phone: string | null
  role: UserRole
  status: UserStatus
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  shifts?: Array<{ id: number; startTime: Date; status: ShiftStatus }>
}) {
  const openShift = user.shifts?.[0] ?? null
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    activeShift: openShift
      ? {
          id: openShift.id,
          startTime: openShift.startTime.toISOString(),
          status: openShift.status,
        }
      : null,
  }
}

export async function listUsers(filters: {
  search?: string
  role?: string
  status?: string
} = {}) {
  const where: Prisma.UserWhereInput = {}

  if (filters.role) {
    const role = filters.role.toUpperCase()
    if (role !== 'ADMIN' && role !== 'PERSONNEL') {
      throw new AppError('Geçersiz rol filtresi.', 400)
    }
    where.role = role as UserRole
  }

  if (filters.status) {
    const status = filters.status.toUpperCase()
    if (status !== 'ACTIVE' && status !== 'PASSIVE') {
      throw new AppError('Geçersiz durum filtresi.', 400)
    }
    where.status = status as UserStatus
  }

  if (filters.search?.trim()) {
    const q = filters.search.trim()
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      fullName: true,
      username: true,
      phone: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      shifts: {
        where: { status: ShiftStatus.OPEN },
        select: { id: true, startTime: true, status: true },
        take: 1,
        orderBy: { startTime: 'desc' },
      },
    },
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
  })

  return users.map(publicUser)
}

export async function getUserDetail(id: number) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      username: true,
      phone: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      shifts: {
        where: { status: ShiftStatus.OPEN },
        select: { id: true, startTime: true, status: true, openingCash: true },
        take: 1,
        orderBy: { startTime: 'desc' },
      },
      sales: {
        select: { id: true, total: true },
      },
      _count: {
        select: { shifts: true, sales: true },
      },
      personnelConsumptions: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          quantity: true,
          cost: true,
          reason: true,
          createdAt: true,
          product: { select: { name: true } },
        },
      },
      dayEnds: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          totalSales: true,
          cashDifference: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (!user) throw new AppError('Kullanıcı bulunamadı.', 404)

  const totalRevenue = round2(user.sales.reduce((sum, s) => sum + toNumber(s.total), 0))
  const openShift = user.shifts[0] ?? null

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    activeShift: openShift
      ? {
          id: openShift.id,
          startTime: openShift.startTime.toISOString(),
          openingCash: round2(toNumber(openShift.openingCash)),
          status: openShift.status,
        }
      : null,
    totalSales: user._count.sales,
    totalRevenue,
    totalShifts: user._count.shifts,
    recentConsumptions: user.personnelConsumptions.map((c) => ({
      id: c.id,
      product: c.product.name,
      quantity: c.quantity,
      cost: round2(toNumber(c.cost)),
      reason: c.reason,
      createdAt: c.createdAt.toISOString(),
    })),
    recentDayEnds: user.dayEnds.map((d) => ({
      id: d.id,
      totalSales: round2(toNumber(d.totalSales)),
      cashDifference: round2(toNumber(d.cashDifference)),
      status: d.status,
      createdAt: d.createdAt.toISOString(),
    })),
  }
}

export async function createUser(
  actorId: number,
  input: {
    fullName: string
    username: string
    phone?: string
    password: string
    passwordConfirm: string
    role: 'ADMIN' | 'PERSONNEL'
    status: 'ACTIVE' | 'PASSIVE'
  },
) {
  const fullName = input.fullName.trim()
  const username = input.username.trim().toLowerCase()

  if (!fullName) throw new AppError('Ad soyad zorunludur.', 400)
  if (!username) throw new AppError('Kullanıcı adı zorunludur.', 400)
  if (input.password.length < 4) {
    throw new AppError('Şifre en az 4 karakter olmalıdır.', 400)
  }
  if (input.password !== input.passwordConfirm) {
    throw new AppError('Şifreler eşleşmiyor.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { username } })
    if (existing) {
      throw new AppError('Bu kullanıcı adı zaten kullanılıyor.', 409)
    }

    const passwordHash = await hashPassword(input.password)
    const user = await tx.user.create({
      data: {
        fullName,
        username,
        phone: input.phone?.trim() || null,
        passwordHash,
        role: input.role,
        status: input.status,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await writeUserAudit(tx, {
      actorId,
      actionType: 'CREATE_USER',
      title: 'Kullanıcı oluşturuldu',
      description: `${user.fullName} (@${user.username})`,
      entityId: user.id,
      entityLabel: user.username,
      newValues: {
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    })

    return publicUser({ ...user, shifts: [] })
  })
}

export async function updateUser(
  actorId: number,
  id: number,
  input: {
    fullName?: string
    username?: string
    phone?: string | null
    role?: 'ADMIN' | 'PERSONNEL'
    status?: 'ACTIVE' | 'PASSIVE'
  },
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } })
    if (!user) throw new AppError('Kullanıcı bulunamadı.', 404)

    const nextFullName = input.fullName !== undefined ? input.fullName.trim() : user.fullName
    const nextUsername =
      input.username !== undefined ? input.username.trim().toLowerCase() : user.username
    const nextPhone = input.phone !== undefined ? input.phone?.trim() || null : user.phone
    const nextRole = input.role ?? user.role
    const nextStatus = input.status ?? user.status

    if (!nextFullName) throw new AppError('Ad soyad zorunludur.', 400)
    if (!nextUsername) throw new AppError('Kullanıcı adı zorunludur.', 400)

    if (nextUsername !== user.username) {
      const clash = await tx.user.findUnique({ where: { username: nextUsername } })
      if (clash) throw new AppError('Bu kullanıcı adı zaten kullanılıyor.', 409)
    }

    const wasActiveAdmin = user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE
    if (wasActiveAdmin) {
      const adminCount = await countActiveAdmins(tx)
      if (adminCount <= 1) {
        if (nextStatus === UserStatus.PASSIVE) {
          throw new AppError('Son aktif yönetici pasife alınamaz.', 400)
        }
        if (nextRole === UserRole.PERSONNEL) {
          throw new AppError('Son aktif yöneticinin rolü Personel yapılamaz.', 400)
        }
      }
    }

    const updated = await tx.user.update({
      where: { id },
      data: {
        fullName: nextFullName,
        username: nextUsername,
        phone: nextPhone,
        role: nextRole,
        status: nextStatus,
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        shifts: {
          where: { status: ShiftStatus.OPEN },
          select: { id: true, startTime: true, status: true },
          take: 1,
        },
      },
    })

    await writeUserAudit(tx, {
      actorId,
      actionType: 'UPDATE_USER',
      title: 'Kullanıcı güncellendi',
      entityId: updated.id,
      entityLabel: updated.username,
      oldValues: {
        fullName: user.fullName,
        username: user.username,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      newValues: {
        fullName: updated.fullName,
        username: updated.username,
        phone: updated.phone,
        role: updated.role,
        status: updated.status,
      },
    })

    return publicUser(updated)
  })
}

export async function updateUserStatus(
  actorId: number,
  id: number,
  status: 'ACTIVE' | 'PASSIVE',
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } })
    if (!user) throw new AppError('Kullanıcı bulunamadı.', 404)

    if (actorId === id && status === 'PASSIVE') {
      throw new AppError('Kullanıcı kendisini pasife alamaz.', 400)
    }

    if (
      user.role === UserRole.ADMIN &&
      user.status === UserStatus.ACTIVE &&
      status === 'PASSIVE'
    ) {
      const adminCount = await countActiveAdmins(tx)
      if (adminCount <= 1) {
        throw new AppError('Son aktif yönetici pasife alınamaz.', 400)
      }
    }

    if (status === 'PASSIVE') {
      const openShift = await tx.shift.findFirst({
        where: { userId: id, status: ShiftStatus.OPEN },
        select: { id: true },
      })
      if (openShift) {
        throw new AppError('Aktif vardiyası olan personel pasife alınamaz.', 400)
      }
    }

    const updated = await tx.user.update({
      where: { id },
      data: { status },
      select: {
        id: true,
        fullName: true,
        username: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        shifts: {
          where: { status: ShiftStatus.OPEN },
          select: { id: true, startTime: true, status: true },
          take: 1,
        },
      },
    })

    await writeUserAudit(tx, {
      actorId,
      actionType: 'UPDATE_STATUS',
      title: 'Kullanıcı durumu değiştirildi',
      entityId: updated.id,
      entityLabel: updated.username,
      oldValues: { status: user.status },
      newValues: { status: updated.status },
    })

    return publicUser(updated)
  })
}

export async function resetPassword(
  actorId: number,
  id: number,
  input: { newPassword: string; newPasswordConfirm: string },
) {
  if (!input.newPassword || !input.newPasswordConfirm) {
    throw new AppError('Yeni şifre alanları zorunludur.', 400)
  }
  if (input.newPassword.length < 4) {
    throw new AppError('Şifre en az 4 karakter olmalıdır.', 400)
  }
  if (input.newPassword !== input.newPasswordConfirm) {
    throw new AppError('Şifreler eşleşmiyor.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } })
    if (!user) throw new AppError('Kullanıcı bulunamadı.', 404)

    const passwordHash = await hashPassword(input.newPassword)
    await tx.user.update({
      where: { id },
      data: { passwordHash },
    })

    await writeUserAudit(tx, {
      actorId,
      actionType: 'RESET_PASSWORD',
      title: 'Şifre sıfırlandı',
      description: `${user.fullName} (@${user.username})`,
      entityId: user.id,
      entityLabel: user.username,
      newValues: { passwordReset: true },
    })

    return { id: user.id, username: user.username }
  })
}

export async function changeOwnPassword(
  userId: number,
  input: {
    currentPassword: string
    newPassword: string
    newPasswordConfirm: string
  },
) {
  if (!input.currentPassword || !input.newPassword || !input.newPasswordConfirm) {
    throw new AppError('Tüm şifre alanları zorunludur.', 400)
  }
  if (input.newPassword.length < 4) {
    throw new AppError('Yeni şifre en az 4 karakter olmalıdır.', 400)
  }
  if (input.newPassword !== input.newPasswordConfirm) {
    throw new AppError('Yeni şifreler eşleşmiyor.', 400)
  }
  if (input.newPassword === input.currentPassword) {
    throw new AppError('Yeni şifre mevcut şifreyle aynı olamaz.', 400)
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user) throw new AppError('Kullanıcı bulunamadı.', 404)
    if (user.role !== UserRole.ADMIN) {
      throw new AppError('Bu işlem için yetkiniz yok.', 403)
    }

    const valid = await verifyPassword(user.passwordHash, input.currentPassword)
    if (!valid) {
      throw new AppError('Mevcut şifre hatalı.', 400)
    }

    const passwordHash = await hashPassword(input.newPassword)
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    await writeUserAudit(tx, {
      actorId: userId,
      module: 'AUTH',
      actionType: 'CHANGE_PASSWORD',
      title: 'Şifre değiştirildi',
      entityId: user.id,
      entityLabel: user.username,
      newValues: { passwordChanged: true },
    })

    return { success: true }
  })
}
