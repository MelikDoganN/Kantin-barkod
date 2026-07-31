import { Router } from 'express'
import * as categoryController from '../controllers/category.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), categoryController.list)
router.post('/', requireRoles('ADMIN'), categoryController.create)
router.put('/:id', requireRoles('ADMIN'), categoryController.update)
router.patch('/:id/status', requireRoles('ADMIN'), categoryController.updateStatus)
router.delete('/:id', requireRoles('ADMIN'), categoryController.remove)

export default router
