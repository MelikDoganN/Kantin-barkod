import { Router } from 'express'
import * as salesController from '../controllers/sales.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), salesController.listCustomers)
router.post('/', requireRoles('ADMIN', 'PERSONNEL'), salesController.createCustomer)

export default router
