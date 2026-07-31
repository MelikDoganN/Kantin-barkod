import { Router } from 'express'
import * as salesController from '../controllers/sales.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'

const router = Router()

router.use(authenticate)

router.get('/drafts', requireRoles('ADMIN', 'PERSONNEL'), salesController.listDrafts)
router.post('/drafts', requireRoles('ADMIN', 'PERSONNEL'), salesController.createDraft)
router.patch('/drafts/:id', requireRoles('ADMIN', 'PERSONNEL'), salesController.updateDraft)
router.post('/drafts/:id/finalize', requireRoles('ADMIN', 'PERSONNEL'), salesController.finalizeDraft)
router.delete('/drafts/:id', requireRoles('ADMIN', 'PERSONNEL'), salesController.cancelDraft)

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), salesController.list)
router.post('/', requireRoles('ADMIN', 'PERSONNEL'), salesController.create)
router.post('/:id/cancel', requireRoles('ADMIN'), salesController.cancelCompleted)
router.get('/:id', requireRoles('ADMIN', 'PERSONNEL'), salesController.getById)

export default router
