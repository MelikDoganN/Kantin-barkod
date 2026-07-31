import { PrismaClient } from '@prisma/client'
import { env } from './env'

// Geliştirme ortamında hot-reload sırasında birden fazla PrismaClient
// örneği oluşmasını engellemek için global cache kullanılır.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (env.nodeEnv !== 'production') {
  globalForPrisma.prisma = prisma
}
