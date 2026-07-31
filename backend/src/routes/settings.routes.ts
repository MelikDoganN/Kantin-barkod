import { Router } from 'express'
import multer from 'multer'
import * as settingsController from '../controllers/settings.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'
import { AppError } from '../middleware/errorHandler'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
    if (!allowed.has(file.mimetype)) {
      cb(new AppError('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.', 400))
      return
    }
    cb(null, true)
  },
})

router.use(authenticate)

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), settingsController.getSettings)

router.put('/business', requireRoles('ADMIN'), settingsController.updateBusiness)
router.put('/system', requireRoles('ADMIN'), settingsController.updateSystem)
router.put('/barcode', requireRoles('ADMIN'), settingsController.updateBarcode)
router.put('/backup', requireRoles('ADMIN'), settingsController.updateBackup)

router.post(
  '/logo',
  requireRoles('ADMIN'),
  (req, res, next) => {
    upload.single('logo')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(new AppError('Logo dosyası en fazla 2 MB olabilir.', 400))
          return
        }
        next(new AppError('Logo yüklenemedi.', 400))
        return
      }
      next(err)
    })
  },
  settingsController.uploadLogo,
)

router.delete('/logo', requireRoles('ADMIN'), settingsController.deleteLogo)

export default router
