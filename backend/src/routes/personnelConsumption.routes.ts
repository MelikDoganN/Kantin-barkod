import { Router } from 'express'
import * as controller from '../controllers/personnelConsumption.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/summary', requireRoles('ADMIN'), controller.summary)
router.get('/personnel', requireRoles('ADMIN'), controller.personnel)
router.get('/', requireRoles('ADMIN', 'PERSONNEL'), controller.list)
router.post('/', requireRoles('ADMIN', 'PERSONNEL'), controller.create)
router.get('/:id', requireRoles('ADMIN', 'PERSONNEL'), controller.getById)

export default router
