import { Router } from 'express'
import * as creditController from '../controllers/credit.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.get('/summary', creditController.summary)
router.get('/customers', creditController.listCustomers)
router.post('/customers', creditController.createCustomer)
router.get('/customers/:id/sales/:saleId', creditController.getCustomerSale)
router.get('/customers/:id', creditController.getCustomer)
router.post('/payment', creditController.payment)

export default router
