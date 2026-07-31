import { Router } from 'express'
import * as shiftController from '../controllers/shift.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/current', requireRoles('ADMIN', 'PERSONNEL'), shiftController.current)
router.post('/open', requireRoles('ADMIN', 'PERSONNEL'), shiftController.open)
router.get('/', requireRoles('ADMIN', 'PERSONNEL'), shiftController.list)
router.get('/:id', requireRoles('ADMIN', 'PERSONNEL'), shiftController.getById)
router.post('/:id/close', requireRoles('ADMIN', 'PERSONNEL'), shiftController.close)

export default router
