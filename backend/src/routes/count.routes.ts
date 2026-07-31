import { Router } from 'express'
import * as countController from '../controllers/count.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireRoles('ADMIN'))

router.get('/summary', countController.summary)
router.get('/history', countController.history)
router.get('/active', countController.active)
router.get('/', countController.list)
router.post('/', countController.create)
router.get('/:id', countController.getById)
router.patch('/:id/items/:itemId', countController.updateItem)
router.post('/:id/complete', countController.complete)

export default router
