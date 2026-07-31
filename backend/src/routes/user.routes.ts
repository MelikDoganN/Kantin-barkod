import { Router } from 'express'
import * as userController from '../controllers/user.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.post('/me/change-password', requireRoles('ADMIN'), userController.changePassword)

router.get('/', requireRoles('ADMIN'), userController.list)
router.post('/', requireRoles('ADMIN'), userController.create)
router.get('/:id', requireRoles('ADMIN'), userController.getById)
router.put('/:id', requireRoles('ADMIN'), userController.update)
router.patch('/:id/status', requireRoles('ADMIN'), userController.updateStatus)
router.post('/:id/reset-password', requireRoles('ADMIN'), userController.resetPassword)

export default router
