import { Router } from 'express'
import * as auditLogController from '../controllers/auditLog.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.get('/summary', auditLogController.summary)
router.get('/filters', auditLogController.filters)
router.get('/', auditLogController.list)
router.get('/:id', auditLogController.getById)

export default router
