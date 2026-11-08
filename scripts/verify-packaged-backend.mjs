// Run with the bundled Windows node.exe, so native modules are checked against its ABI.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const backend = path.resolve(process.argv[2])
assert.equal(process.platform, 'win32')
assert.equal(process.arch, 'x64')
const require = createRequire(path.join(backend, 'package.json'))
const Database = require('better-sqlite3')
const argon2 = require('argon2')
const { PrismaClient } = require('@prisma/client')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kantin-packaged-'))
const database = path.join(temporary, 'data', 'kantin.db')
Object.assign(process.env, {
  DATABASE_URL: pathToFileURL(database).href,
  SQLITE_DATABASE_PATH: database,
  SQLITE_BACKUP_DIR: path.join(temporary, 'backups'),
  ELECTRON_USER_DATA_PATH: temporary,
  JWT_SECRET: 'packaged-runtime-smoke-test',
  NODE_ENV: 'production',
})
const prisma = new PrismaClient()
try {
  for (let launch = 0; launch < 2; launch++) {
    const result = spawnSync(process.execPath, [path.join(backend, 'prisma', 'prepare-database.mjs')], {
      cwd: backend, env: process.env, encoding: 'utf8', timeout: 60000,
    })
    assert.equal(result.status, 0, result.stdout + result.stderr)
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } })
  assert.ok(await argon2.verify(admin.passwordHash, 'admin123'))
  assert.equal(await prisma.user.count(), 1)
  const category = await prisma.category.create({ data: { name: 'Native test' } })
  const product = await prisma.product.create({ data: { name: 'Test', barcode: '8690000000001', categoryId: category.id, salePrice: 235, purchasePrice: 105 } })
  assert.equal(product.salePrice, 235)
  const db = new Database(database, { readonly: true })
  try {
    assert.equal(db.pragma('quick_check', { simple: true }), 'ok')
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal')
    await db.backup(path.join(temporary, 'snapshot.db'))
  } finally { db.close() }
  console.log(`Bundled backend verified: ${process.platform} ${process.arch}, Node ${process.version}, ABI ${process.versions.modules}; Prisma, SQLite, WAL backup, migrations and argon2 passed.`)
} finally {
  await prisma.$disconnect()
  fs.rmSync(temporary, { recursive: true, force: true })
}
