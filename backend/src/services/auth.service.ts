import { prisma } from '../config/database'
import { AppError } from '../middleware/errorHandler'
import { generateToken } from '../utils/jwt'
import { verifyPassword } from '../utils/password'

const INVALID_CREDENTIALS = 'Kullanıcı adı veya şifre hatalı'

export interface RequestContext {
  deviceName?: string | null
  ipAddress?: string | null
}

export interface AuthenticatedUser {
  id: number
  fullName: string
  username: string
  role: string
}

export interface LoginResult {
  token: string
  user: AuthenticatedUser
}

async function writeAuditLog(params: {
  userId: number | null
  actionType: 'LOGIN' | 'FAILED_LOGIN'
  title: string
  description?: string
  entityId: number | null
  entityLabel: string
  context: RequestContext
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        module: 'AUTH',
        actionType: params.actionType,
        title: params.title,
        description: params.description,
        entityType: 'User',
        entityId: params.entityId,
        entityLabel: params.entityLabel,
        deviceName: params.context.deviceName ?? null,
        ipAddress: params.context.ipAddress ?? null,
      },
    })
  } catch {
    // Audit log yazımı ana akışı bloklamamalı.
  }
}

export async function login(
  username: string,
  password: string,
  context: RequestContext,
): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { username } })

  // 1) Kullanıcı yok
  if (!user) {
    await writeAuditLog({
      userId: null,
      actionType: 'FAILED_LOGIN',
      title: 'Başarısız giriş denemesi',
      description: `Bilinmeyen kullanıcı: ${username}`,
      entityId: null,
      entityLabel: username,
      context,
    })
    throw new AppError(INVALID_CREDENTIALS, 401)
  }

  // 2) Pasif kullanıcı giriş yapamaz
  if (user.status === 'PASSIVE') {
    await writeAuditLog({
      userId: user.id,
      actionType: 'FAILED_LOGIN',
      title: 'Pasif kullanıcı giriş denemesi',
      description: 'Hesap pasif durumda',
      entityId: user.id,
      entityLabel: user.username,
      context,
    })
    throw new AppError('Hesabınız pasif durumda, giriş yapamazsınız.', 403)
  }

  // 3) Şifre doğrulama
  const passwordValid = await verifyPassword(user.passwordHash, password)
  if (!passwordValid) {
    await writeAuditLog({
      userId: user.id,
      actionType: 'FAILED_LOGIN',
      title: 'Başarısız giriş denemesi',
      description: 'Hatalı şifre',
      entityId: user.id,
      entityLabel: user.username,
      context,
    })
    throw new AppError(INVALID_CREDENTIALS, 401)
  }

  // 4) Son giriş tarihi
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  // 5) Token üret
  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
  })

  // 6) Başarılı giriş audit log
  await writeAuditLog({
    userId: user.id,
    actionType: 'LOGIN',
    title: 'Kullanıcı giriş yaptı',
    entityId: user.id,
    entityLabel: user.username,
    context,
  })

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
    },
  }
}

export async function getUserById(id: number): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    return null
  }
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    role: user.role,
  }
}
