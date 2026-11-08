import { Router } from 'express'
import * as backupController from '../controllers/backup.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.post('/', backupController.create)
router.get('/', backupController.list)
router.get('/:id/download', backupController.download)
router.post('/:id/restore', backupController.restore)
router.delete('/:id', backupController.remove)

export default router
