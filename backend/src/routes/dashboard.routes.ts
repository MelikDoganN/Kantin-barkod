import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.get('/', dashboardController.getDashboard)

export default router
