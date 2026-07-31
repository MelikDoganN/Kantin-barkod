import express from 'express'
import cors from 'cors'
import path from 'path'
import { env } from './config/env'
import { success } from './utils/apiResponse'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import {
  UPLOADS_DIR,
  ensureDir,
  DEFAULT_BACKUPS_DIR,
  LOGS_DIR,
  CONFIG_DIR,
} from './utils/paths'
import { checkScheduledBackup } from './services/backup.service'
import authRoutes from './routes/auth.routes'
import categoryRoutes from './routes/category.routes'
import productRoutes from './routes/product.routes'
import inventoryRoutes from './routes/inventory.routes'
import salesRoutes from './routes/sales.routes'
import customerRoutes from './routes/customer.routes'
import shiftRoutes from './routes/shift.routes'
import dayEndRoutes from './routes/dayEnd.routes'
import reportRoutes from './routes/report.routes'
import dashboardRoutes from './routes/dashboard.routes'
import creditRoutes from './routes/credit.routes'
import countRoutes from './routes/count.routes'
import personnelConsumptionRoutes from './routes/personnelConsumption.routes'
import userRoutes from './routes/user.routes'
import auditLogRoutes from './routes/auditLog.routes'
import settingsRoutes from './routes/settings.routes'
import backupRoutes from './routes/backup.routes'
import cashAdjustmentRoutes from './routes/cashAdjustment.routes'

const app = express()

ensureDir(UPLOADS_DIR)
ensureDir(path.join(UPLOADS_DIR, 'settings'))
ensureDir(path.join(UPLOADS_DIR, 'products'))
ensureDir(DEFAULT_BACKUPS_DIR)
ensureDir(LOGS_DIR)
ensureDir(CONFIG_DIR)

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(UPLOADS_DIR))

app.get('/api/health', (_req, res) => {
  success(res, { status: 'ok' }, 'Kantin POS API çalışıyor')
})

app.use('/api/auth', authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/products', productRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/shifts', shiftRoutes)
app.use('/api/day-end', dayEndRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/credits', creditRoutes)
app.use('/api/counts', countRoutes)
app.use('/api/personnel-consumption', personnelConsumptionRoutes)
app.use('/api/users', userRoutes)
app.use('/api/audit-logs', auditLogRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/backups', backupRoutes)
app.use('/api/cash-adjustments', cashAdjustmentRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Kantin POS API http://localhost:${env.port} adresinde çalışıyor`)

  void checkScheduledBackup()
})
