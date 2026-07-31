import { Router } from 'express'
import multer from 'multer'
import * as productController from '../controllers/product.controller'
import { authenticate } from '../middleware/auth.middleware'
import { requireRoles } from '../middleware/role.middleware'
import { AppError } from '../middleware/errorHandler'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
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

router.get('/', requireRoles('ADMIN', 'PERSONNEL'), productController.list)
router.get('/barcode/:barcode', requireRoles('ADMIN', 'PERSONNEL'), productController.getByBarcode)
router.post('/', requireRoles('ADMIN'), productController.create)
router.put('/:id', requireRoles('ADMIN'), productController.update)
router.patch('/:id/status', requireRoles('ADMIN'), productController.updateStatus)
router.delete('/:id', requireRoles('ADMIN'), productController.remove)

router.post(
  '/:id/image',
  requireRoles('ADMIN'),
  (req, res, next) => {
    upload.single('image')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          next(new AppError('Görsel boyutu en fazla 3 MB olabilir.', 400))
          return
        }
        next(new AppError('Görsel yüklenemedi.', 400))
        return
      }
      next(err)
    })
  },
  productController.uploadImage,
)

router.delete('/:id/image', requireRoles('ADMIN'), productController.removeImage)

export default router
