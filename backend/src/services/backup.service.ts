import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { AppError } from '../middleware/errorHandler'
import {
  DEFAULT_BACKUPS_DIR,
  ensureDir,
  isPathInside,
  safeUnlink,
} from '../utils/paths'
import {
  getAutoBackupConfig,
  getBackupDirectorySetting,
  markLastBackupAt,
} from './settings.service'

let backupInProgress = false

function parseDatabaseUrl(databaseUrl: string): {
  host: string
  port: string
  user: string
  password: string
  database: string
} {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new AppError('Veritabanı bağlantı ayarları geçersiz.', 500)
  }

  const database = parsed.pathname.replace(/^\//, '').split('?')[0]
  if (!database) throw new AppError('Veritabanı adı çözümlenemedi.', 500)

  return {
    host: parsed.hostname || 'localhost',
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username || 'postgres'),
    password: decodeURIComponent(parsed.password || ''),
    database,
  }
}

function formatBackupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `kantin-pos-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.sql`
}

function resolvePgDumpCommand(): string {
  const configured = process.env.PG_DUMP_PATH?.trim()
  if (configured) return configured
  return process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump'
}

function sanitizeErrorMessage(raw: string): string {
  let message = raw.replace(/\s+/g, ' ').trim()
  if (!message) return 'Yedekleme sırasında bir hata oluştu.'

  const sensitive = [env.databaseUrl, process.env.PGPASSWORD ?? '']
  for (const secret of sensitive) {
    if (secret && secret.length > 3) {
      message = message.split(secret).join('[gizli]')
    }
  }
  message = message.replace(/postgresql:\/\/[^\s]+/gi, '[gizli]')
  message = message.replace(/password[=:]\s*\S+/gi, 'password=[gizli]')

  if (/not found|ENOENT|is not recognized|cannot find/i.test(message)) {
    return 'PostgreSQL yedekleme aracı bulunamadı. PostgreSQL bin klasörünü kontrol edin.'
  }
  if (/permission|EACCES|yazılamıyor|access is denied/i.test(message)) {
    return 'Seçilen yedekleme dizinine yazılamıyor.'
  }
  return message.slice(0, 240)
}

async function writeBackupAudit(params: {
  userId: number | null
  actionType: string
  title: string
  description?: string
  entityLabel?: string
  oldValues?: Prisma.InputJsonValue
  newValues?: Prisma.InputJsonValue
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? undefined,
        module: 'BACKUP',
        actionType: params.actionType,
        title: params.title,
        description: params.description,
        entityType: 'BackupRecord',
        entityId: null,
        entityLabel: params.entityLabel ?? 'Yedek',
        oldValues: params.oldValues,
        newValues: params.newValues,
      },
    })
  } catch {
    /* audit failures must not block backup flow */
  }
}

function runPgDump(args: {
  host: string
  port: string
  user: string
  password: string
  database: string
  filePath: string
}): Promise<void> {
  const command = resolvePgDumpCommand()
  const cliArgs = [
    '--host',
    args.host,
    '--port',
    args.port,
    '--username',
    args.user,
    '--dbname',
    args.database,
    '--format=p',
    '--no-owner',
    '--no-acl',
    '--file',
    args.filePath,
  ]

  return new Promise((resolve, reject) => {
    const child = spawn(command, cliArgs, {
      env: {
        ...process.env,
        PGPASSWORD: args.password,
      },
      windowsHide: true,
    })

    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `pg_dump exit code ${code}`))
    })
  })
}

function serializeBackup(row: {
  id: string
  fileName: string
  fileSize: bigint | null
  status: string
  errorMessage: string | null
  createdAt: Date
  createdBy: { id: number; fullName: string; username: string } | null
}) {
  return {
    id: row.id,
    fileName: row.fileName,
    fileSize: row.fileSize != null ? Number(row.fileSize) : null,
    status: row.status,
    errorMessage: row.errorMessage,
    createdBy: row.createdBy
      ? {
          id: row.createdBy.id,
          fullName: row.createdBy.fullName,
          username: row.createdBy.username,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function createBackup(userId: number | null) {
  if (backupInProgress) {
    throw new AppError('Başka bir yedekleme işlemi devam ediyor.', 409)
  }

  backupInProgress = true
  const fileName = formatBackupFileName()
  let backupDir = DEFAULT_BACKUPS_DIR
  let filePath = ''

  try {
    backupDir = await getBackupDirectorySetting()
    try {
      ensureDir(backupDir)
      fs.accessSync(backupDir, fs.constants.W_OK)
    } catch {
      throw new AppError('Seçilen yedekleme dizinine yazılamıyor.', 400)
    }

    filePath = path.join(backupDir, fileName)
    const db = parseDatabaseUrl(env.databaseUrl)

    await runPgDump({
      host: db.host,
      port: db.port,
      user: db.user,
      password: db.password,
      database: db.database,
      filePath,
    })

    if (!fs.existsSync(filePath)) {
      throw new Error('Yedek dosyası oluşturulamadı.')
    }

    const stats = fs.statSync(filePath)
    const now = new Date()
    const record = await prisma.backupRecord.create({
      data: {
        fileName,
        filePath,
        fileSize: BigInt(stats.size),
        status: 'SUCCESS',
        createdById: userId ?? undefined,
      },
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
    })

    await markLastBackupAt(now)
    await writeBackupAudit({
      userId,
      actionType: 'CREATE_BACKUP',
      title: 'Veritabanı yedeği oluşturuldu',
      description: fileName,
      entityLabel: fileName,
      newValues: { fileName, fileSize: stats.size, status: 'SUCCESS' },
    })

    return {
      id: record.id,
      fileName: record.fileName,
      fileSize: Number(record.fileSize ?? 0),
      createdAt: record.createdAt.toISOString(),
    }
  } catch (error) {
    const safeMessage =
      error instanceof AppError
        ? error.message
        : sanitizeErrorMessage(error instanceof Error ? error.message : String(error))

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        /* ignore cleanup */
      }
    }

    await prisma.backupRecord.create({
      data: {
        fileName,
        filePath: filePath || path.join(backupDir, fileName),
        fileSize: null,
        status: 'FAILED',
        errorMessage: safeMessage,
        createdById: userId ?? undefined,
      },
    })

    await writeBackupAudit({
      userId,
      actionType: 'FAILED_CREATE_BACKUP',
      title: 'Veritabanı yedeği oluşturulamadı',
      description: safeMessage,
      entityLabel: fileName,
      newValues: { fileName, status: 'FAILED' },
    })

    if (error instanceof AppError) throw error
    throw new AppError(safeMessage, 500)
  } finally {
    backupInProgress = false
  }
}

export async function listBackups(filters: {
  page?: number
  limit?: number
  status?: 'SUCCESS' | 'FAILED'
  dateFrom?: string
  dateTo?: string
}) {
  const page = Math.max(1, filters.page ?? 1)
  let limit = filters.limit ?? 20
  if (limit < 1) limit = 20
  if (limit > 100) limit = 100

  const where: Prisma.BackupRecordWhereInput = {}
  if (filters.status) where.status = filters.status

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) {
      const start = new Date(filters.dateFrom)
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0)
        where.createdAt.gte = start
      }
    }
    if (filters.dateTo) {
      const end = new Date(filters.dateTo)
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }
  }

  const [total, rows] = await Promise.all([
    prisma.backupRecord.count({ where }),
    prisma.backupRecord.findMany({
      where,
      include: {
        createdBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return {
    items: rows.map(serializeBackup),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function getBackupDownload(id: string) {
  const record = await prisma.backupRecord.findUnique({ where: { id } })
  if (!record || record.status !== 'SUCCESS') {
    throw new AppError('İndirilebilir yedek bulunamadı.', 404)
  }

  const settingsDir = await getBackupDirectorySetting()
  const allowedRoots = [settingsDir, DEFAULT_BACKUPS_DIR]
  const resolved = path.resolve(record.filePath)
  const allowed = allowedRoots.some((root) => isPathInside(root, resolved))
  if (!allowed) throw new AppError('Geçersiz yedek dosya yolu.', 400)
  if (!fs.existsSync(resolved)) throw new AppError('Yedek dosyası bulunamadı.', 404)

  return {
    fileName: record.fileName,
    absolutePath: resolved,
  }
}

export async function deleteBackup(userId: number, id: string) {
  const record = await prisma.backupRecord.findUnique({ where: { id } })
  if (!record) throw new AppError('Yedek kaydı bulunamadı.', 404)

  const settingsDir = await getBackupDirectorySetting()
  safeUnlink(record.filePath, [settingsDir, DEFAULT_BACKUPS_DIR])

  await prisma.backupRecord.delete({ where: { id } })

  await writeBackupAudit({
    userId,
    actionType: 'DELETE_BACKUP',
    title: 'Yedek kaydı silindi',
    description: record.fileName,
    entityLabel: record.fileName,
    oldValues: { fileName: record.fileName, status: record.status },
  })

  return { id }
}

function isDue(lastBackupAt: Date | null, frequency: string): boolean {
  if (!lastBackupAt) return true
  const now = Date.now()
  const last = lastBackupAt.getTime()
  const day = 24 * 60 * 60 * 1000
  if (frequency === 'DAILY') return now - last >= day
  if (frequency === 'WEEKLY') return now - last >= 7 * day
  if (frequency === 'MONTHLY') return now - last >= 30 * day
  return false
}

export async function checkScheduledBackup(): Promise<void> {
  if (backupInProgress) return

  try {
    const config = await getAutoBackupConfig()
    if (!config.autoBackupEnabled || !config.autoBackupFrequency) return
    if (!isDue(config.lastBackupAt, config.autoBackupFrequency)) return

    // eslint-disable-next-line no-console
    console.log('[BACKUP] Zamanlanmış yedekleme başlatılıyor…')
    await createBackup(null)
    // eslint-disable-next-line no-console
    console.log('[BACKUP] Zamanlanmış yedekleme tamamlandı.')
  } catch (error) {
    const message =
      error instanceof Error ? sanitizeErrorMessage(error.message) : 'Bilinmeyen hata'
    // eslint-disable-next-line no-console
    console.error('[BACKUP] Zamanlanmış yedekleme başarısız:', message)
  }
}
