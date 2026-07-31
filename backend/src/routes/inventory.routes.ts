import { Router } from 'express'
import * as inventoryController from '../controllers/inventory.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), inventoryController.list)
router.get('/movements', requireRoles('ADMIN', 'PERSONNEL'), inventoryController.movements)
router.get('/waste', requireRoles('ADMIN'), inventoryController.wasteList)

router.post('/receipt', requireRoles('ADMIN'), inventoryController.receipt)
router.post('/open-carton', requireRoles('ADMIN', 'PERSONNEL'), inventoryController.openCarton)
router.post('/waste', requireRoles('ADMIN'), inventoryController.waste)
router.post('/initial-load', requireRoles('ADMIN'), inventoryController.initialLoad)

export default router
