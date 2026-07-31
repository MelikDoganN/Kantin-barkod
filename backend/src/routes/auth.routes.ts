import { Router } from 'express'
import * as authController from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', authController.login)
router.get('/me', authenticate, authController.me)
router.post('/logout', authController.logout)

export default router
