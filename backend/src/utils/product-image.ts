import fs from 'fs'
import path from 'path'
import {
  PRODUCTS_UPLOADS_DIR,
  UPLOADS_DIR,
  ensureDir,
  isPathInside,
  safeUnlink,
} from './paths'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MAX_BYTES = 3 * 1024 * 1024

export function ensureProductUploadsDir(): string {
  ensureDir(PRODUCTS_UPLOADS_DIR)
  return PRODUCTS_UPLOADS_DIR
}

export function toPublicProductImagePath(fileName: string): string {
  return `/uploads/products/${fileName}`
}

export function resolveProductImageAbsolute(publicPath: string | null | undefined): string | null {
  if (!publicPath) return null
  const normalized = publicPath.replace(/^\/uploads\//, '')
  const absolute = path.join(UPLOADS_DIR, normalized)
  if (!isPathInside(PRODUCTS_UPLOADS_DIR, absolute)) return null
  return absolute
}

export function validateProductImageFile(file: {
  originalname: string
  mimetype: string
  size: number
}): { ext: string } {
  const ext = path.extname(file.originalname).toLowerCase()
  if (ext === '.svg' || !ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
    throw new Error('Yalnızca JPG, PNG veya WEBP dosyaları yüklenebilir.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error('Görsel boyutu en fazla 3 MB olabilir.')
  }
  return { ext }
}

export function saveProductImageBuffer(buffer: Buffer, ext: string): string {
  ensureProductUploadsDir()
  const uniqueName = `product-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`
  const absolute = path.join(PRODUCTS_UPLOADS_DIR, uniqueName)
  fs.writeFileSync(absolute, buffer)
  return toPublicProductImagePath(uniqueName)
}

export function deleteProductImageFile(publicPath: string | null | undefined): void {
  const absolute = resolveProductImageAbsolute(publicPath)
  if (!absolute) return
  safeUnlink(absolute, [PRODUCTS_UPLOADS_DIR])
}
