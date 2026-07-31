/**
 * Kantin POS production seed (güvenli).
 *
 * Varsayılan:
 * - Veritabanında kullanıcı varsa HİÇBİR ŞEY SİLMEZ / DEĞİŞTİRMEZ.
 * - Boş DB ise SystemSetting + admin oluşturur.
 *
 * Zorla yeniden kurulum (yıkıcı):
 *   SEED_FORCE=1 npm run db:seed
 *
 * Admin: admin / admin123 (argon2)
 */
import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import { hashPassword, verifyPassword } from '../src/utils/password'

const prisma = new PrismaClient()

async function wipeOperationalData() {
  // FK sırasına göre sil (çocuk → ebeveyn)
  await prisma.cashAdjustment.deleteMany()
  await prisma.creditTransaction.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.saleItem.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.dayEnd.deleteMany()
  await prisma.shift.deleteMany()
  await prisma.stockCountItem.deleteMany()
  await prisma.stockCount.deleteMany()
  await prisma.wasteRecord.deleteMany()
  await prisma.personnelConsumption.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.backupRecord.deleteMany()
  await prisma.auditLog.deleteMany()

  await prisma.systemSetting.updateMany({ data: { defaultCategoryId: null } })
  await prisma.product.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.category.deleteMany()
  await prisma.setting.deleteMany()
  await prisma.user.deleteMany()
}

async function ensureSystemSettings() {
  const existing = await prisma.systemSetting.findFirst()
  if (existing) return existing

  return prisma.systemSetting.create({
    data: { businessName: 'Kantin POS' },
  })
}

async function createAdmin() {
  const passwordHash = await hashPassword('admin123')

  const admin = await prisma.user.create({
    data: {
      fullName: 'Sistem Yöneticisi',
      username: 'admin',
      passwordHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    },
  })

  const ok = await verifyPassword(admin.passwordHash, 'admin123')
  if (!ok) {
    throw new Error('Admin şifre doğrulaması başarısız (argon2).')
  }

  return admin
}

async function printCounts() {
  const [
    users,
    products,
    categories,
    sales,
    shifts,
    dayEnds,
    customers,
    inventory,
    movements,
    counts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.category.count(),
    prisma.sale.count(),
    prisma.shift.count(),
    prisma.dayEnd.count(),
    prisma.customer.count(),
    prisma.inventory.count(),
    prisma.stockMovement.count(),
    prisma.stockCount.count(),
  ])

  console.log('\n=== Veritabanı durumu ===')
  console.log(`  Kullanıcı: ${users}`)
  console.log(`  Ürün: ${products}`)
  console.log(`  Kategori: ${categories}`)
  console.log(`  Satış: ${sales}`)
  console.log(`  Vardiya: ${shifts}`)
  console.log(`  Gün sonu: ${dayEnds}`)
  console.log(`  Müşteri/borç: ${customers}`)
  console.log(`  Stok (inventory): ${inventory}`)
  console.log(`  Stok hareketi: ${movements}`)
  console.log(`  Sayım: ${counts}`)
}

async function main() {
  const force = process.env.SEED_FORCE === '1'
  const userCount = await prisma.user.count()

  console.log('Production seed başlıyor…')

  if (userCount > 0 && !force) {
    console.log(
      `Seed atlandı: veritabanında ${userCount} kullanıcı var (güvenli mod).`,
    )
    console.log('Yeniden seed için: SEED_FORCE=1 npm run db:seed')
    await printCounts()
    return
  }

  if (force && userCount > 0) {
    console.log('SEED_FORCE=1 — operasyonel veriler temizleniyor…')
    await wipeOperationalData()
  }

  console.log('Sistem ayarları kontrol ediliyor…')
  await ensureSystemSettings()

  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } })
  if (existingAdmin) {
    console.log(`  ✓ Admin zaten var: ${existingAdmin.username}`)
  } else {
    console.log('Admin kullanıcısı oluşturuluyor…')
    const admin = await createAdmin()
    console.log(`  ✓ ${admin.fullName} (${admin.username}) · ${admin.role}`)
  }

  await printCounts()
  console.log('\nSeed tamamlandı. İlk giriş: admin / admin123')
}

main()
  .catch((error) => {
    console.error('Seed hatası:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
