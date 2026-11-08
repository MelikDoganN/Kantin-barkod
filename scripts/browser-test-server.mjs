import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
const root = process.cwd()
const backend = path.join(root, 'backend')
const require = createRequire(path.join(backend, 'package.json'))
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kantin-browser-'))
const database = path.join(temporary, 'data', 'kantin.db')
Object.assign(process.env, {
  DATABASE_URL: `file:${database.replace(/\\/g, '/')}`,
  SQLITE_DATABASE_PATH: database,
  SQLITE_BACKUP_DIR: path.join(temporary, 'backups'),
  ELECTRON_USER_DATA_PATH: temporary,
  JWT_SECRET: 'browser-test-secret', NODE_ENV: 'production', PORT: '3017',
})
const prepared = spawnSync(process.execPath, ['prisma/prepare-database.mjs'], { cwd: backend, env: process.env, stdio: 'inherit' })
if (prepared.status !== 0) process.exit(1)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const admin = await prisma.user.findUniqueOrThrow({ where: { username: 'admin' } })
const category = await prisma.category.create({ data: { name: 'Test kategori' } })
await prisma.product.create({ data: { name: 'Test Su', barcode: '8690000000001', categoryId: category.id, purchasePrice: 105, salePrice: 245, inventory: { create: { shelfQuantity: 100, warehouseQuantity: 100 } } } })
await prisma.shift.create({ data: { userId: admin.id, openingCash: 10000 } })
await prisma.$disconnect()
const children = [
  spawn(process.execPath, ['dist/index.js'], { cwd: backend, env: process.env, stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
    cwd: root, env: { ...process.env, NODE_ENV: 'test', KANTIN_WEB_ONLY: '1', VITE_API_URL: 'http://127.0.0.1:3017/api' }, stdio: 'inherit',
  }),
]
let stopping = false
function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  // Leave temporary files to OS cleanup on Windows if handles have not closed yet.
  try { fs.rmSync(temporary, { recursive: true, force: true }) } catch {}
  process.exit(0)
}
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
for (const child of children) child.on('exit', () => { if (!stopping) stop() })
