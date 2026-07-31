import fs from 'fs'
import path from 'path'

/**
 * Writable data root.
 * Electron sets ELECTRON_USER_DATA_PATH → AppData (uploads/backups/logs/config).
 * Dev without Electron → project root (../.. from backend/dist).
 */
function resolveDataRoot(): string {
  const electronData = process.env.ELECTRON_USER_DATA_PATH?.trim()
  if (electronData) {
    return path.resolve(electronData)
  }
  // backend/dist → project root
  return path.resolve(__dirname, '../..')
}

export const ROOT_DIR = resolveDataRoot()
export const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads')
export const SETTINGS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'settings')
export const PRODUCTS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'products')
export const DEFAULT_BACKUPS_DIR = path.join(ROOT_DIR, 'backups')
export const LOGS_DIR = path.join(ROOT_DIR, 'logs')
export const CONFIG_DIR = path.join(ROOT_DIR, 'config')

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

/** Resolve and ensure a path stays under an allowed root (path traversal guard). */
export function resolveUnderRoot(rootDir: string, relativeOrAbsolute: string): string {
  const resolvedRoot = path.resolve(rootDir)
  const candidate = path.resolve(relativeOrAbsolute)
  const relative = path.relative(resolvedRoot, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Geçersiz dosya yolu.')
  }
  return candidate
}

export function isPathInside(parent: string, child: string): boolean {
  const resolvedParent = path.resolve(parent)
  const resolvedChild = path.resolve(child)
  const relative = path.relative(resolvedParent, resolvedChild)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export function safeUnlink(filePath: string, allowedRoots: string[]): void {
  const resolved = path.resolve(filePath)
  const allowed = allowedRoots.some((root) => isPathInside(root, resolved))
  if (!allowed) return
  if (fs.existsSync(resolved)) {
    fs.unlinkSync(resolved)
  }
}
