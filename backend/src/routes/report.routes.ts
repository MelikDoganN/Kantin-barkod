import { Router } from 'express'
import * as reportController from '../controllers/report.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.get('/summary', reportController.summary)
router.get('/sales-trend', reportController.salesTrend)
router.get('/payment-summary', reportController.paymentSummary)
router.get('/top-products', reportController.topProducts)
router.get('/stock', reportController.stock)
router.get('/personnel', reportController.personnel)
router.get('/day-end', reportController.dayEnd)
router.get('/consumption', reportController.consumption)

export default router
