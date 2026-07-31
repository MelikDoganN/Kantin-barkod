import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

/**
 * Load env in order:
 * 1) DOTENV_CONFIG_PATH (set by Electron)
 * 2) ELECTRON_USER_DATA_PATH/config/.env
 * 3) %APPDATA%/Kantin POS/config/.env (installer default)
 * 4) cwd/.env (resources/backend when packaged)
 * 5) backend/.env next to dist
 */
function loadEnvFiles(): void {
  const candidates: string[] = []
  const loadedFrom: string[] = []

  if (process.env.DOTENV_CONFIG_PATH?.trim()) {
    candidates.push(process.env.DOTENV_CONFIG_PATH.trim())
  }

  const electronData = process.env.ELECTRON_USER_DATA_PATH?.trim()
  if (electronData) {
    candidates.push(path.join(electronData, 'config', '.env'))
  }

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, 'Kantin POS', 'config', '.env'))
  }

  candidates.push(path.resolve(process.cwd(), '.env'))
  // dist/index.js → ../.env (backend/.env)
  candidates.push(path.resolve(__dirname, '..', '.env'))

  const seen = new Set<string>()
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    if (!fs.existsSync(resolved)) continue

    // First found install/config file wins for empty keys; allow fill-in of DATABASE_URL
    const result = dotenv.config({ path: resolved, override: false })
    if (!result.error) {
      loadedFrom.push(resolved)
    }
  }

  // Fallback: default dotenv cwd search
  dotenv.config({ override: false })

  // eslint-disable-next-line no-console
  console.log(
    `[env] loadedFrom=${loadedFrom.length ? loadedFrom.join(' | ') : '(none)'} ` +
      `DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'MISSING'} ` +
      `cwd=${process.cwd()}`,
  )
}

loadEnvFiles()

interface AppEnv {
  port: number
  databaseUrl: string
  jwtSecret: string
  nodeEnv: string
}

export const env: AppEnv = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? '',
  nodeEnv: process.env.NODE_ENV ?? 'development',
}

if (!env.databaseUrl) {
  // eslint-disable-next-line no-console
  console.error(
    '[env] DATABASE_URL is missing. Checked DOTENV_CONFIG_PATH, ELECTRON_USER_DATA_PATH/config/.env, ' +
      '%APPDATA%/Kantin POS/config/.env, cwd/.env, and backend/.env',
  )
}
