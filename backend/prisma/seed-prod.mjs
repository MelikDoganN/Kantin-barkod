/**
 * Production seed (plain Node ESM) — no tsx required.
 * Safe by default: if any user exists, exit 0 without changes.
 * Admin: admin / admin123
 *
 * Usage:
 *   node prisma/seed-prod.mjs
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Ensure Prisma loads .env from backend root / DOTENV_CONFIG_PATH
try {
  const dotenv = require('dotenv')
  if (process.env.DOTENV_CONFIG_PATH) {
    dotenv.config({ path: process.env.DOTENV_CONFIG_PATH })
  }
  dotenv.config({ path: path.join(__dirname, '..', '.env') })
} catch {
  // dotenv optional if DATABASE_URL already set
}

const { PrismaClient, UserRole, UserStatus } = require('@prisma/client')
const argon2 = require('argon2')

const prisma = new PrismaClient()

async function main() {
  const force = process.env.SEED_FORCE === '1'
  const userCount = await prisma.user.count()

  console.log('Production seed (seed-prod.mjs) starting...')

  if (userCount > 0 && !force) {
    console.log(`Seed skipped: ${userCount} user(s) already exist (safe mode).`)
    return
  }

  if (force && userCount > 0) {
    console.log('SEED_FORCE=1 — refusing wipe in seed-prod.mjs (use prisma/seed.ts for wipe).')
    return
  }

  const settings = await prisma.systemSetting.findFirst()
  if (!settings) {
    await prisma.systemSetting.create({ data: { businessName: 'Kantin POS' } })
    console.log('Created SystemSetting')
  }

  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existingAdmin) {
    console.log('Admin already exists')
    return
  }

  const passwordHash = await argon2.hash('admin123')
  const admin = await prisma.user.create({
    data: {
      fullName: 'Sistem Yoneticisi',
      username: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  const ok = await argon2.verify(admin.passwordHash, 'admin123')
  if (!ok) throw new Error('Admin password verify failed')

  console.log(`Created admin: ${admin.username}`)
  console.log('Login: admin / admin123')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
