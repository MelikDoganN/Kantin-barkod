import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** Dev (vite) vs packaged Electron. */
export function isPackaged(): boolean {
  return app.isPackaged
}

/** Writable app data: %APPDATA%/Kantin POS (or Electron default). */
export function getUserDataPath(): string {
  return app.getPath('userData')
}

export function getLogsDir(): string {
  return path.join(getUserDataPath(), 'logs')
}

export function getConfigDir(): string {
  return path.join(getUserDataPath(), 'config')
}

export function getUploadsDir(): string {
  return path.join(getUserDataPath(), 'uploads')
}

export function getBackupsDir(): string {
  return path.join(getUserDataPath(), 'backups')
}

/** Ensure uploads / backups / logs / config under userData (never Program Files). */
export function ensureUserDataDirs(): string {
  const root = getUserDataPath()
  for (const dir of [
    getUploadsDir(),
    getBackupsDir(),
    getLogsDir(),
    getConfigDir(),
  ]) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return root
}

/**
 * Backend package root.
 * Packaged: resources/backend
 * Dev: <project>/backend
 */
export function getBackendRoot(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend')
  }
  return path.join(__dirname, '..', 'backend')
}

export function getBackendEntry(): string {
  return path.join(getBackendRoot(), 'dist', 'index.js')
}

/** Renderer build output (Vite dist). */
export function getRendererDist(): string {
  return path.join(__dirname, '..', 'dist')
}

/**
 * Node binary used to spawn the Express API.
 * Order: KANTIN_NODE_PATH → bundled runtime → PATH `node`
 */
export function resolveNodeBinary(): string {
  if (process.env.KANTIN_NODE_PATH?.trim()) {
    return process.env.KANTIN_NODE_PATH.trim()
  }

  const bundled = app.isPackaged
    ? path.join(process.resourcesPath, 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node')
    : path.join(__dirname, '..', 'resources', 'runtime', 'node', process.platform === 'win32' ? 'node.exe' : 'node')

  if (fs.existsSync(bundled)) {
    return bundled
  }

  return process.platform === 'win32' ? 'node.exe' : 'node'
}

export function getBackendPort(): number {
  const raw = process.env.PORT ?? process.env.KANTIN_API_PORT ?? '3001'
  const port = Number(raw)
  return Number.isFinite(port) && port > 0 ? port : 3001
}

export function appendLog(fileName: string, line: string): void {
  try {
    const logsDir = getLogsDir()
    fs.mkdirSync(logsDir, { recursive: true })
    const stamp = new Date().toISOString()
    fs.appendFileSync(path.join(logsDir, fileName), `[${stamp}] ${line}\n`, 'utf8')
  } catch {
    // logging must never crash the app
  }
}
