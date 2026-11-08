import { beginDatabaseMaintenance, endDatabaseMaintenance } from '../middleware/databaseMaintenance'
import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { Prisma } from '@prisma/client'
import { prisma } from '../config/database'
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
let restoreInProgress = false

function formatBackupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `kantin-pos-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.db`
}

function sanitizeErrorMessage(raw: string): string {
  let message = raw.replace(/\s+/g, ' ').trim()
  if (!message) return 'Yedekleme sırasında bir hata oluştu.'

  message = message.replace(/password[=:]\s*\S+/gi, 'password=[gizli]')

  if (/SQLITE_BUSY|database is locked/i.test(message)) {
    return 'Veritabanı şu anda yoğun kullanımda. Biraz bekleyip yeniden deneyin.'
  }
  if (/not found|ENOENT|cannot find/i.test(message)) {
    return 'SQLite veritabanı veya yedekleme dosyasına erişilemiyor.'
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

async function createSqliteBackup(sourcePath: string, destinationPath: string): Promise<void> {
  if (!fs.existsSync(sourcePath)) throw new Error('SQLite veritabanı dosyası bulunamadı.')
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true })
  try {
    await source.backup(destinationPath)
  } finally {
    source.close()
  }
}

function serializeBackup(row: {
  id: string
  fileName: string
  fileSize: number | null
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
  if (backupInProgress || restoreInProgress) {
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
    const sourcePath = process.env.SQLITE_DATABASE_PATH?.trim()
    if (!sourcePath) throw new Error('Yerel SQLite veritabanı yolu ayarlanmamış.')
    await createSqliteBackup(sourcePath, filePath)

    if (!fs.existsSync(filePath)) {
      throw new Error('Yedek dosyası oluşturulamadı.')
    }

    const stats = fs.statSync(filePath)
    const now = new Date()
    const record = await prisma.backupRecord.create({
      data: {
        fileName,
        filePath,
        fileSize: stats.size,
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

export async function restoreBackup(userId: number, id: string) {
  if (restoreInProgress || backupInProgress) {
    throw new AppError('Başka bir yedekleme veya geri yükleme işlemi devam ediyor.', 409)
  }
  beginDatabaseMaintenance()
  restoreInProgress = true

  let record: Awaited<ReturnType<typeof prisma.backupRecord.findUnique>>
  let backupPath = ''
  let databasePath = ''
  try {
    record = await prisma.backupRecord.findUnique({ where: { id } })
    if (!record || record.status !== 'SUCCESS') {
      throw new AppError('Geri yüklenecek geçerli bir yedek bulunamadı.', 404)
    }

    const settingsDir = await getBackupDirectorySetting()
    const allowedRoots = [settingsDir, DEFAULT_BACKUPS_DIR]
    backupPath = path.resolve(record.filePath)
    if (!allowedRoots.some((root) => isPathInside(root, backupPath)) || !fs.existsSync(backupPath)) {
      throw new AppError('Yedek dosyası bulunamadı veya yolu geçersiz.', 400)
    }

    databasePath = process.env.SQLITE_DATABASE_PATH?.trim() ?? ''
    if (!databasePath || path.resolve(backupPath) === path.resolve(databasePath)) {
      throw new AppError('Geri yükleme için geçerli bir yerel SQLite veritabanı gerekli.', 500)
    }
  } catch (error) {
    restoreInProgress = false
    endDatabaseMaintenance()
    throw error
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safetyName = `kantin-pos-pre-restore-${stamp}.db`
  const safetyPath = path.join(DEFAULT_BACKUPS_DIR, safetyName)
  const stagedPath = path.join(path.dirname(databasePath), `.kantin-restore-${stamp}.db`)
  const displacedPath = path.join(path.dirname(databasePath), `.kantin-before-restore-${stamp}.db`)
  let displaced = false

  try {
    ensureDir(DEFAULT_BACKUPS_DIR)
    const source = new Database(backupPath, { readonly: true, fileMustExist: true })
    try {
      const integrity = source.pragma('quick_check') as Array<{ quick_check: string }>
      const tables = (source
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('User','Product','Sale','_prisma_migrations')")
        .all() as Array<{ name: string }>)
        .map((row) => row.name)
      if (integrity[0]?.quick_check !== 'ok' || !['User', 'Product', 'Sale', '_prisma_migrations'].every((name) => tables.includes(name))) {
        throw new AppError('Yedek bozuk veya Kantin Barkod POS veritabanı değil.', 400)
      }
    } finally {
      source.close()
    }

    const current = new Database(databasePath, { readonly: true, fileMustExist: true })
    try {
      const candidate = new Database(backupPath, { readonly: true, fileMustExist: true })
      try {
        const history = (db: Database.Database) => db.prepare('SELECT migration_name, checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name').all()
        if (JSON.stringify(history(candidate)) !== JSON.stringify(history(current))) {
          throw new AppError('Yedek farklı bir veritabanı sürümüne ait. Mevcut veritabanı değiştirilmedi.', 400)
        }
      } finally { candidate.close() }
      await current.backup(safetyPath)
    } finally {
      current.close()
    }
    if (!fs.existsSync(safetyPath) || fs.statSync(safetyPath).size === 0) {
      throw new AppError('Geri yükleme öncesi güvenlik yedeği oluşturulamadı. Mevcut veritabanı değiştirilmedi.', 500)
    }

    const stagedSource = new Database(backupPath, { readonly: true, fileMustExist: true })
    try {
      await stagedSource.backup(stagedPath)
    } finally {
      stagedSource.close()
    }

    await prisma.$disconnect()
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${databasePath}${suffix}`
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar)
    }
    fs.renameSync(databasePath, displacedPath)
    displaced = true
    fs.renameSync(stagedPath, databasePath)

    const restored = new Database(databasePath)
    try {
      restored.pragma('foreign_keys = ON')
      restored.pragma('journal_mode = WAL')
      const integrity = restored.pragma('quick_check') as Array<{ quick_check: string }>
      if (integrity[0]?.quick_check !== 'ok') throw new Error('Geri yüklenen veritabanı bütünlük kontrolünden geçemedi.')
      const violations = restored.pragma('foreign_key_check') as unknown[]
      if (violations.length) throw new Error('Geri yüklenen veritabanında ilişki bütünlüğü ihlali var.')
    } finally {
      restored.close()
    }

    const safetyStats = fs.statSync(safetyPath)
    const safetyRecord = await prisma.backupRecord.create({
      data: {
        fileName: safetyName,
        filePath: safetyPath,
        fileSize: safetyStats.size,
        status: 'SUCCESS',
        createdById: (await prisma.user.findUnique({ where: { id: userId } })) ? userId : null,
      },
    })
    await prisma.$connect()
    fs.unlinkSync(displacedPath)
    displaced = false
    return {
      restoredBackup: { id: record.id, fileName: record.fileName },
      safetyBackup: { id: safetyRecord.id, fileName: safetyName, fileSize: safetyStats.size },
    }
  } catch (error) {
    if (displaced && fs.existsSync(displacedPath)) {
      await prisma.$disconnect()
      for (const suffix of ['-wal', '-shm']) {
        if (fs.existsSync(`${databasePath}${suffix}`)) fs.unlinkSync(`${databasePath}${suffix}`)
      }
      if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath)
      fs.renameSync(displacedPath, databasePath)
    }
    await prisma.$connect().catch(() => undefined)
    if (error instanceof AppError) throw error
    throw new AppError(`Yedekten geri yükleme başarısız oldu; geri alma denendi. ${sanitizeErrorMessage(error instanceof Error ? error.message : String(error))}`, 500)
  } finally {
    restoreInProgress = false
    endDatabaseMaintenance()
    for (const file of [stagedPath]) {
      if (fs.existsSync(file)) safeUnlink(file, [path.dirname(databasePath)])
    }
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
  if (backupInProgress || restoreInProgress) return

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
