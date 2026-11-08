import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const migrationsDir = path.join(backendRoot, 'prisma', 'migrations')
const prismaCli = path.join(backendRoot, 'node_modules', 'prisma', 'build', 'index.js')
const seedScript = path.join(backendRoot, 'prisma', 'seed-prod.mjs')
const databaseUrl = process.env.DATABASE_URL

function log(message) {
  console.log(`[db-setup] ${message}`)
}

function errorCode(error) {
  return error?.errorCode ?? error?.code ?? error?.meta?.code ?? 'unknown'
}

function safeErrorMessage(error) {
  return String(error?.message ?? error).replace(
    /postgres(?:ql)?:\/\/([^:\s/]+):([^@\s/]+)@/gi,
    'postgresql://$1:[REDACTED]@',
  )
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function maintenanceUrl(url) {
  const parsed = new URL(url)
  parsed.pathname = '/postgres'
  return parsed.toString()
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
    child.once('error', (error) => reject(new Error(`${stage} başlatılamadı: ${safeErrorMessage(error)}`)))
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${stage} başarısız oldu (çıkış kodu ${code ?? 'bilinmiyor'}). ${stderr.trim()}`))
    })
  })
}

async function getMigrationState(client) {
  const relation = await client.$queryRaw`SELECT to_regclass('public."_prisma_migrations"')::text AS name`
  if (!relation[0]?.name) {
    const objects = await client.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')) AS relations,
        (SELECT COUNT(*)::int FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND t.typtype IN ('e', 'c', 'd')) AS custom_types`
    const { relations, custom_types: customTypes } = objects[0]
    if (relations > 0 || customTypes > 0) {
      throw new Error(
        'Veritabanında tablolar veya özel tipler var ancak Prisma migration geçmişi bulunamadı. ' +
          'Veri güvenliği için şema değişikliği yapılmadı; veritabanı yedeği ve migration geçmişi uzman tarafından kontrol edilmelidir.',
      )
    }
    return { hasHistory: false, applied: new Set() }
  }

  const rows = await client.$queryRaw`
    SELECT migration_name FROM public."_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
  return { hasHistory: true, applied: new Set(rows.map((row) => row.migration_name)) }
}

async function main() {
  if (!databaseUrl) throw new Error('Güvenli PostgreSQL bağlantı bilgisi bulunamadı.')
  if (!fs.existsSync(prismaCli)) throw new Error('Paketlenmiş Prisma migration aracı bulunamadı.')
  if (!fs.existsSync(seedScript)) throw new Error('Paketlenmiş başlangıç verisi betiği bulunamadı.')

  const target = new URL(databaseUrl)
  const databaseName = decodeURIComponent(target.pathname.replace(/^\//, ''))
  const username = decodeURIComponent(target.username)
  if (!databaseName || !username) throw new Error('PostgreSQL veritabanı adı veya kullanıcı adı geçersiz.')

  log(`PostgreSQL sunucusu kontrol ediliyor: ${target.hostname}:${target.port || '5432'}`)
  let admin
  try {
    admin = new PrismaClient({ datasources: { db: { url: maintenanceUrl(databaseUrl) } } })
    await admin.$connect()
    const server = await admin.$queryRaw`SELECT current_setting('server_version') AS version`
    log(`PostgreSQL bağlantısı başarılı (sürüm ${server[0]?.version ?? 'bilinmiyor'}).`)

    const found = await admin.$queryRaw`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`
    if (found.length === 0) {
      log(`'${databaseName}' veritabanı yok; mevcut PostgreSQL kullanıcısı adına oluşturuluyor.`)
      await admin.$executeRawUnsafe(
        `CREATE DATABASE ${quoteIdentifier(databaseName)} OWNER ${quoteIdentifier(username)}`,
      )
      log(`'${databaseName}' veritabanı oluşturuldu.`)
    } else {
      log(`'${databaseName}' veritabanı zaten var; mevcut veriler korunuyor.`)
    }
  } catch (error) {
    const code = errorCode(error)
    if (code === 'P1000' || code === '28P01') {
      throw new Error('PostgreSQL kullanıcı adı veya şifre yanlış. Şifreyi tekrar girip deneyin.')
    }
    if (code === 'P1001' || code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
      throw new Error(
        'PostgreSQL sunucusuna ulaşılamadı. PostgreSQL 18 kurulu ve Windows hizmeti çalışır durumda olduğundan emin olun.',
      )
    }
    if (code === 'P1010' || code === '42501' || /permission denied|not allowed to create database/i.test(error?.message ?? '')) {
      throw new Error(
        "PostgreSQL'e bağlanıldı ancak bu hesap veritabanı oluşturamıyor. 'postgres' hesabı ve CREATEDB yetkisini kontrol edin.",
      )
    }
    throw new Error(`PostgreSQL hazırlığı başarısız (kod ${code}): ${safeErrorMessage(error)}`)
  } finally {
    await admin?.$disconnect().catch(() => undefined)
  }

  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  try {
    await db.$connect()
    const state = await getMigrationState(db)
    const migrationFolders = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, 'migration.sql')))
      .map((entry) => entry.name)
      .sort()

    if (!state.hasHistory) {
      log('Boş veritabanı doğrulandı; gerçek proje migration dosyaları uygulanacak.')
    } else {
      const unknownApplied = [...state.applied].filter((name) => !migrationFolders.includes(name))
      if (unknownApplied.length > 0) {
        throw new Error(
          'Veritabanında bu uygulama sürümünde bulunmayan migration kayıtları var. Geri alma veya şema değişikliği yapılmadı; sürüm uyumluluğu kontrol edilmeli.',
        )
      }
      const pending = migrationFolders.filter((name) => !state.applied.has(name))
      if (pending.length === 0) {
        log('Tüm migration dosyaları zaten uygulanmış; şema değişikliği gerekmiyor.')
      } else {
        log(`${pending.length} bekleyen migration bulundu; Prisma migrate deploy çalıştırılıyor.`)
      }
    }
    await db.$disconnect()

    if (!state.hasHistory || (await hasPendingMigrations(databaseUrl, migrationFolders))) {
      await runNodeScript([prismaCli, 'migrate', 'deploy'], process.env, 'Veritabanı migration işlemi')
      log('Migration işlemi tamamlandı.')
    }

    const check = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
    let userCount
    try {
      await check.$connect()
      userCount = await check.user.count()
    } finally {
      await check.$disconnect().catch(() => undefined)
    }

    if (userCount === 0) {
      log('Kullanıcı kaydı yok; güvenli başlangıç seed işlemi çalıştırılıyor (mevcut kayıtları silmez).')
      await runNodeScript([seedScript], process.env, 'Başlangıç kayıtları işlemi')
    } else {
      log(`Mevcut ${userCount} kullanıcı bulundu; başlangıç seed işlemi atlandı.`)
    }
    log('Veritabanı hazır.')
  } finally {
    await db.$disconnect().catch(() => undefined)
  }
}

async function hasPendingMigrations(url, migrationFolders) {
  const client = new PrismaClient({ datasources: { db: { url } } })
  try {
    await client.$connect()
    const state = await getMigrationState(client)
    return !state.hasHistory || migrationFolders.some((name) => !state.applied.has(name))
  } finally {
    await client.$disconnect()
  }
}

main().catch((error) => {
  log(`HATA: ${safeErrorMessage(error)}`)
  process.exitCode = 1
})
