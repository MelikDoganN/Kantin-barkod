import { Router } from 'express'
import * as dayEndController from '../controllers/dayEnd.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/eligible-shifts', requireRoles('ADMIN', 'PERSONNEL'), dayEndController.eligibleShifts)
router.get('/', requireRoles('ADMIN', 'PERSONNEL'), dayEndController.list)
router.post('/', requireRoles('ADMIN', 'PERSONNEL'), dayEndController.create)
router.get('/:id/sales/:saleId', requireRoles('ADMIN', 'PERSONNEL'), dayEndController.getSaleDetail)
router.get('/:id', requireRoles('ADMIN', 'PERSONNEL'), dayEndController.getById)

export default router
