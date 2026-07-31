import { Router } from 'express'
import * as cashAdjustmentController from '../controllers/cashAdjustment.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.get('/', requireRoles('ADMIN'), cashAdjustmentController.list)
router.post('/', requireRoles('ADMIN'), cashAdjustmentController.create)

export default router
