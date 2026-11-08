import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations')
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js')
const seedScript = path.join(backendRoot, 'prisma', 'seed-prod.mjs')
const databasePath = process.env.SQLITE_DATABASE_PATH
const backupDirectory = process.env.SQLITE_BACKUP_DIR

function log(message) {
  console.log(`[db-setup] ${message}`)
}

function runNodeScript(args, env, stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: backendRoot,
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stdout.on('data', (chunk) => process.stdout.write(chunk))
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
      process.stderr.write(chunk)
    })
    child.once('error', (error) => reject(new Error(`${stage} başlatılamadı: ${error.message}`)))
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${stage} başarısız oldu (çıkış kodu ${code ?? 'bilinmiyor'}). ${stderr.trim()}`))
    })
  })
}

function getAppliedMigrations(db) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='_prisma_migrations'").get()
  if (!exists) return null
  const failed = db.prepare('SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL').get()
  if (failed) throw new Error('Önceki migration tamamlanmamış. Veriler korundu; yedek ile teknik destek gerekli.')
  return new Set(
    db.prepare('SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
      .all()
      .map((row) => row.migration_name),
  )
}

function getProjectMigrations() {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, 'migration.sql')))
    .map((entry) => entry.name)
    .sort()
}

async function backupBeforeMigration() {
  if (!backupDirectory) throw new Error('Migration öncesi yedekleme klasörü ayarlı değil; veritabanı değiştirilmedi.')
  fs.mkdirSync(backupDirectory, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(backupDirectory, `kantin-pos-pre-migration-${stamp}.db`)
  const source = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    await source.backup(backupPath)
  } finally {
    source.close()
  }
  if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
    throw new Error('Migration öncesi güvenli yedek oluşturulamadı; veritabanı değiştirilmedi.')
  }
  log(`Migration öncesi yedek hazır: ${backupPath}`)
}

async function main() {
  if (!databasePath || !backupDirectory || !process.env.DATABASE_URL?.startsWith('file:')) {
    throw new Error('SQLite veritabanı dosya yolu ayarlanmamış.')
  }
  if (!fs.existsSync(prismaCli)) throw new Error('Paketlenmiş Prisma migration aracı bulunamadı.')
  if (!fs.existsSync(seedScript)) throw new Error('Paketlenmiş başlangıç verisi betiği bulunamadı.')

  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  fs.mkdirSync(backupDirectory, { recursive: true })
  log(`SQLite veritabanı hazırlanıyor: ${databasePath}`)

  let db
  let applied
  let hasUserTables
  try {
    db = new Database(databasePath)
    db.pragma('foreign_keys = ON')
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = FULL')
    db.pragma('busy_timeout = 5000')
    const integrity = db.pragma('quick_check')
    if (integrity[0]?.quick_check !== 'ok') {
      throw new Error(`SQLite veritabanı bütünlük kontrolü başarısız: ${integrity[0]?.quick_check ?? 'bilinmeyen hata'}`)
    }

    hasUserTables = db
      .prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .get().count > 0
    applied = getAppliedMigrations(db)
    if (hasUserTables && applied === null) {
      throw new Error(
        'Var olan SQLite dosyasında tablolar bulundu ancak Prisma migration geçmişi yok. Güvenlik için dosya değiştirilmedi.',
      )
    }
    if (applied) {
      const projectMigrations = getProjectMigrations()
      const unknown = [...applied].filter((name) => !projectMigrations.includes(name))
      if (unknown.length) {
        throw new Error('Veritabanı bu sürümle uyumsuz migration kayıtları içeriyor; dosya değiştirilmedi.')
      }
      const pending = projectMigrations.filter((name) => !applied.has(name))
      if (pending.length) {
        log(`${pending.length} bekleyen SQLite migration bulundu.`)
      } else {
        log('Tüm SQLite migration dosyaları zaten uygulanmış.')
      }
    } else {
      log('Boş veritabanı doğrulandı; SQLite başlangıç şeması oluşturulacak.')
    }
    db.close()
    db = undefined

    const projectMigrations = getProjectMigrations()
    const pending = !applied || projectMigrations.some((name) => !applied.has(name))
    if (pending) {
      if (hasUserTables) await backupBeforeMigration()
      await runNodeScript([prismaCli, 'migrate', 'deploy', '--schema', path.join(backendRoot, 'prisma', 'schema.prisma')], process.env, 'SQLite migration işlemi')
      log('SQLite migration işlemi tamamlandı.')
    }

    const verify = new Database(databasePath, { readonly: true, fileMustExist: true })
    try {
      verify.pragma('foreign_keys = ON')
      const integrity = verify.pragma('quick_check')
      if (integrity[0]?.quick_check !== 'ok') throw new Error('Migration sonrası SQLite bütünlük kontrolü başarısız.')
      if (verify.pragma('foreign_key_check').length) throw new Error('Veritabanında ilişki bütünlüğü ihlali var.')
    } finally {
      verify.close()
    }

    const seedEnv = { ...process.env }
    await runNodeScript([seedScript], seedEnv, 'İlk kullanıcı ve ayarların oluşturulması')
    log('SQLite veritabanı hazır.')
  } finally {
    db?.close()
  }
}

main().catch((error) => {
  log(`HATA: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
