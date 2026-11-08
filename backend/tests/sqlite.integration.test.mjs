import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import Database from 'better-sqlite3'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kantin SQLite Türkçe % -'))
const database = path.join(temporary, 'data', 'kantin.db')
Object.assign(process.env, {
  DATABASE_URL: `file:${database.replace(/\\/g, '/')}`,
  SQLITE_DATABASE_PATH: database,
  SQLITE_BACKUP_DIR: path.join(temporary, 'backups'),
  ELECTRON_USER_DATA_PATH: temporary,
  JWT_SECRET: 'integration-test-secret',
  NODE_ENV: 'production',
})
function prepare(extra = {}) {
  return spawnSync(process.execPath, ['prisma/prepare-database.mjs'], {
    cwd: root, env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 60000,
  })
}
function prepared() {
  const result = prepare()
  assert.equal(result.status, 0, result.stdout + result.stderr)
}
let prisma
let api

test('SQLite offline lifecycle and POS regression', async (t) => {
  try {
    await t.test('first launch creates schema, WAL and initial administrator', () => {
      prepared()
      const db = new Database(database)
      assert.equal(db.pragma('journal_mode', { simple: true }), 'wal')
      assert.equal(db.prepare('SELECT COUNT(*) n FROM User').get().n, 1)
      assert.equal(db.pragma('quick_check', { simple: true }), 'ok')
      db.close()
    })
    ;({ prisma } = await import('../dist/config/database.js'))
    const auth = await import('../dist/services/auth.service.js')
    const products = await import('../dist/services/product.service.js')
    const inventory = await import('../dist/services/inventory.service.js')
    const sales = await import('../dist/services/sales.service.js')
    const shifts = await import('../dist/services/shift.service.js')
    const reports = await import('../dist/services/report.service.js')
    const backups = await import('../dist/services/backup.service.js')
    const dashboard = await import('../dist/services/dashboard.service.js')
    let admin, product, shift, sale, backup
    await t.test('login accepts initial password and rejects wrong password', async () => {
      admin = (await auth.login('admin', 'admin123', {})).user
      await assert.rejects(auth.login('admin', 'incorrect', {}))
    })
    await t.test('create/edit product, barcode lookup and integer cents storage', async () => {
      const category = await prisma.category.create({ data: { name: 'İçecek' } })
      const input = { name: 'Su', barcode: '8690000000001', categoryId: category.id, purchasePrice: 1.05, salePrice: 2.10 }
      product = await products.createProduct(input)
      product = await products.updateProduct(product.id, { ...input, salePrice: 2.35 })
      assert.equal((await products.getProductByBarcode(input.barcode)).salePrice, 2.35)
      const db = new Database(database, { readonly: true })
      assert.equal(db.prepare('SELECT salePrice FROM Product').get().salePrice, 235)
      db.close()
      await inventory.initialStockLoad([{ productId: product.id, depotQuantity: 20, shelfQuantity: 10 }], admin.id)
    })
    await t.test('money filters, atomic increments, aggregation counts, audit JSON', async () => {
      await prisma.product.update({ where: { id: product.id }, data: { salePrice: { increment: 0.10 } } })
      assert.equal((await prisma.product.findFirst({ where: { salePrice: { gte: 2.45 } } })).salePrice, 2.45)
      assert.equal((await prisma.product.aggregate({ _count: { salePrice: true } }))._count.salePrice, 1)
      const log = await prisma.auditLog.create({ data: { module: 'TEST', actionType: 'TEST', entityType: 'Test', title: 'test', newValues: { amount: 2.45 } } })
      assert.equal(log.newValues.amount, 2.45)
    })
    await t.test('cash sale decrements stock and insufficient stock rolls back', async () => {
      shift = await shifts.openShift(admin.id, 100.10)
      sale = await sales.createSale({ items: [{ productId: product.id, quantity: 3 }], paymentType: 'CASH', discount: 0.05 }, admin.id)
      assert.equal(sale.total, 7.30)
      assert.equal(sale.items[0].unitPrice, 2.45)
      assert.equal((await prisma.inventory.findUnique({ where: { productId: product.id } })).shelfQuantity, 7)
      const count = await prisma.sale.count()
      await assert.rejects(sales.createSale({ items: [{ productId: product.id, quantity: 99 }], paymentType: 'CASH' }, admin.id))
      assert.equal(await prisma.sale.count(), count)
      await assert.rejects(prisma.payment.create({ data: { saleId: 999999, type: 'CASH', amount: 1 } }))
    })
    await t.test('summary, daily trend and hourly dashboard use SQLite dates and currency', async () => {
      assert.equal((await reports.getSummary()).totalSales, 7.30)
      const trend = await reports.getSalesTrend()
      assert.equal(trend.length, 1)
      assert.equal(trend[0].date, new Date().toLocaleDateString('en-CA'))
      assert.equal(trend[0].total, 7.30)
      assert.equal((await reports.getTopProducts())[0].quantity, 3)
      const data = await dashboard.getDashboard()
      assert.ok(JSON.stringify(data).includes('7.3'))
      const raw = await prisma.$queryRaw`SELECT CAST(strftime('%H', "createdAt" / 1000, 'unixepoch', 'localtime') AS INTEGER) hour FROM Sale`
      assert.equal(Number(raw[0].hour), new Date().getHours())
    })
    await t.test('draft/card sale, credit debt, cancellation and cash/day-end remain consistent', async () => {
      const draft = await sales.createDraftSale(admin.id)
      await sales.updateDraftSale(draft.id, admin.id, { items: [{ productId: product.id, quantity: 1 }], discount: 0 })
      const card = await sales.finalizeDraftSale(draft.id, admin.id, { paymentType: 'CARD' })
      assert.equal(card.total, 2.45)
      await sales.cancelCompletedSale(card.id, admin.id, 'ADMIN', { reason: 'Test iptali' })
      const customer = await sales.createCustomer({ name: 'Test müşteri' })
      const credit = await sales.createSale({ items: [{ productId: product.id, quantity: 1 }], paymentType: 'CREDIT', customerId: customer.id }, admin.id)
      assert.equal((await prisma.customer.findUnique({ where: { id: customer.id } })).totalDebt, 2.45)
      await sales.cancelCompletedSale(credit.id, admin.id, 'ADMIN', { reason: 'Test iptali' })
      assert.equal((await prisma.customer.findUnique({ where: { id: customer.id } })).totalDebt, 0)
      assert.equal((await prisma.inventory.findUnique({ where: { productId: product.id } })).shelfQuantity, 7)
      const cash = await import('../dist/services/cashAdjustment.service.js')
      await cash.createCashAdjustment(admin.id, 'ADMIN', { amount: -0.10, description: 'Test düzeltmesi' })
      const dayEnd = await import('../dist/services/dayEnd.service.js')
      await shifts.closeShift(shift.id, admin.id, 'ADMIN', 107.40)
      await dayEnd.createDayEnd(admin.id, 'ADMIN', shift.id, 107.40)
      assert.equal((await prisma.dayEnd.findFirst()).totalSales, 7.30)
    })
    await t.test('WAL backup is consistent and restore preserves the snapshot', async () => {
      backup = await backups.createBackup(admin.id)
      const downloaded = await backups.getBackupDownload(backup.id)
      const db = new Database(downloaded.absolutePath, { readonly: true })
      assert.equal(db.pragma('quick_check', { simple: true }), 'ok')
      assert.equal(db.prepare('SELECT total FROM Sale').get().total, 730)
      db.close()
      await prisma.product.update({ where: { id: product.id }, data: { name: 'Changed' } })
      await backups.restoreBackup(admin.id, backup.id)
      assert.equal((await prisma.product.findUnique({ where: { id: product.id } })).name, 'Su')
      assert.equal((await prisma.sale.findUnique({ where: { id: sale.id } })).total, 7.30)
    })
    await t.test('relaunch preserves changed credentials, products, sales and migration history', async () => {
      const hash = (await prisma.user.findUnique({ where: { id: admin.id } })).passwordHash
      await prisma.user.update({ where: { id: admin.id }, data: { fullName: 'Kalıcı kullanıcı' } })
      await prisma.$disconnect()
      prepared()
      const user = await prisma.user.findUnique({ where: { id: admin.id } })
      assert.equal(user.passwordHash, hash)
      assert.equal(user.fullName, 'Kalıcı kullanıcı')
      assert.equal(await prisma.user.count(), 1)
      assert.equal(await prisma.product.count(), 1)
      assert.equal(await prisma.sale.count(), 3)
    })
    await t.test('HTTP backend starts without PostgreSQL and serves login, barcode and reports', async () => {
      // Reserve an unused local port for the API subprocess.
      const net = await import('node:net')
      const reservation = net.createServer()
      await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve))
      const port = reservation.address().port
      await new Promise(resolve => reservation.close(resolve))
      api = spawn(process.execPath, ['dist/index.js'], { cwd: root, env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] })
      let logs = ''
      api.stdout.on('data', c => logs += c)
      api.stderr.on('data', c => logs += c)
      const base = `http://127.0.0.1:${port}/api`
      let ready = false
      for (let i = 0; i < 100; i++) {
        try { ready = (await fetch(`${base}/health`)).ok } catch {}
        if (ready) break
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      assert.ok(ready, logs)
      const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) })
      assert.equal(login.status, 200)
      const token = (await login.json()).data.token
      for (const route of ['/products/barcode/8690000000001', '/reports/summary', '/sales']) {
        const response = await fetch(base + route, { headers: { Authorization: `Bearer ${token}` } })
        assert.equal(response.status, 200, await response.text())
      }
      const exited = once(api, 'exit')
      api.kill()
      await exited
      api = null
    })
    await t.test('migration backs up existing data before a failed SQL migration', async () => {
      await prisma.$disconnect()
      const fixture = path.join(root, 'prisma', 'migrations', '99999999999999_test_failure')
      fs.mkdirSync(fixture)
      fs.writeFileSync(path.join(fixture, 'migration.sql'), 'THIS IS INVALID SQL;')
      try {
        const result = prepare()
        assert.notEqual(result.status, 0)
        const files = fs.readdirSync(process.env.SQLITE_BACKUP_DIR).filter(f => f.includes('pre-migration'))
        assert.equal(files.length, 1)
        const db = new Database(path.join(process.env.SQLITE_BACKUP_DIR, files[0]), { readonly: true })
        assert.equal(db.prepare('SELECT COUNT(*) n FROM Sale').get().n, 3)
        db.close()
      } finally { fs.rmSync(fixture, { recursive: true, force: true }) }
    })
    await t.test('corrupt file is rejected without resetting it', () => {
      const corrupt = path.join(temporary, 'corrupt.db')
      fs.writeFileSync(corrupt, 'not a sqlite database')
      const before = fs.readFileSync(corrupt)
      const result = prepare({ DATABASE_URL: `file:${corrupt.replace(/\\/g, '/')}`, SQLITE_DATABASE_PATH: corrupt })
      assert.notEqual(result.status, 0)
      assert.deepEqual(fs.readFileSync(corrupt), before)
    })
  } finally {
    if (api && api.exitCode === null && api.signalCode === null) { const exited = once(api, 'exit'); api.kill(); await exited }
    await prisma?.$disconnect()
    fs.rmSync(temporary, { recursive: true, force: true })
  }
})
