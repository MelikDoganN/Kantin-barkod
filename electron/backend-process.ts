import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import crypto from 'node:crypto'
import http from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  appendLog,
  getBackupsDir,
  getBackendEntry,
  getBackendPort,
  getBackendRoot,
  getConfigDir,
  getDatabaseFilePath,
  getDatabaseDir,
  getUserDataPath,
  isPackaged,
  resolveNodeBinary,
} from './paths'

let backendProcess: ChildProcess | null = null
let stopping = false

function log(message: string): void {
  appendLog('backend.log', message)
  // eslint-disable-next-line no-console
  console.log(`[backend] ${message}`)
}

function logDatabaseSetup(message: string): void {
  appendLog('db-setup.log', message)
  // eslint-disable-next-line no-console
  console.log(`[db-setup] ${message}`)
}

function prepareDatabase(
  databaseUrl: string,
  databaseFile: string,
  nodeBin: string,
  backendRoot: string,
): Promise<void> {
  const setupScript = path.join(backendRoot, 'prisma', 'prepare-database.mjs')
  if (!fs.existsSync(setupScript)) {
    return Promise.reject(new Error(`Veritabanı kurulum bileşeni bulunamadı: ${setupScript}`))
  }

  logDatabaseSetup('Güvenli veritabanı hazırlama kontrolü başlıyor.')
  return new Promise((resolve, reject) => {
    const setupEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SQLITE_DATABASE_PATH: databaseFile,
      SQLITE_BACKUP_DIR: getBackupsDir(),
      NODE_ENV: 'production',
    }
    const child = spawn(nodeBin, [setupScript], {
      cwd: backendRoot,
      env: setupEnv,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const collect = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      output += text
      for (const line of text.split(/\r?\n/).filter(Boolean)) logDatabaseSetup(line)
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.once('error', (error) => {
      reject(new Error(`Veritabanı hazırlama başlatılamadı: ${error.message}`))
    })
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
      } else {
        const detail = output.trim().split(/\r?\n/).slice(-12).join('\n')
        reject(
          new Error(
            `Veritabanı hazırlama başarısız oldu (kod ${code ?? signal ?? 'bilinmiyor'}).` +
              (detail ? `\n${detail}` : ''),
          ),
        )
      }
    })
  })
}

/** Minimal .env parser (KEY=VALUE lines). */
function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync(filePath)) return out
  const text = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function resolveEnvFilePaths(backendRoot: string): string[] {
  const paths: string[] = []
  const configEnv = path.join(getConfigDir(), '.env')
  const appDataEnv = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'Kantin POS', 'config', '.env')
    : ''
  const backendEnv = path.join(backendRoot, '.env')

  paths.push(configEnv)
  if (appDataEnv) paths.push(appDataEnv)
  paths.push(backendEnv)
  return paths
}

function waitForHealth(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now()

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
          return
        }
        retry()
      })

      req.on('error', () => {
        retry()
      })

      req.setTimeout(1500, () => {
        req.destroy()
        retry()
      })
    }

    const retry = () => {
      if (Date.now() - started >= timeoutMs) {
        reject(new Error(`Backend health check timed out after ${timeoutMs}ms (port ${port})`))
        return
      }
      setTimeout(attempt, 400)
    }

    attempt()
  })
}

async function isAlreadyHealthy(port: number): Promise<boolean> {
  try {
    await waitForHealth(port, 1500)
    return true
  } catch {
    return false
  }
}

/**
 * Start backend if needed, wait until /api/health succeeds.
 * Skips spawn when an API is already listening on the port (e.g. `npm run dev` in backend).
 */
export async function startBackendProcess(
): Promise<{ port: number; spawned: boolean }> {
  const port = getBackendPort()
  const userData = getUserDataPath()
  const backendRoot = getBackendRoot()
  const entry = getBackendEntry()

  if (!isPackaged() && await isAlreadyHealthy(port)) {
    log(`API already healthy on port ${port} - spawn skipped`)
    return { port, spawned: false }
  }

  if (!fs.existsSync(entry)) {
    throw new Error(
      `Backend entry not found: ${entry}\nBuild the API first (backend: npm run build).`,
    )
  }

  const nodeBin = resolveNodeBinary()
  const envCandidates = resolveEnvFilePaths(backendRoot)
  const databaseFile = getDatabaseFilePath()
  fs.mkdirSync(getDatabaseDir(), { recursive: true })
  const databaseUrl = pathToFileURL(databaseFile).href

  log(`userData=${userData}`)
  log(`backendRoot=${backendRoot}`)
  for (const p of envCandidates) {
    log(`env candidate: ${p} exists=${fs.existsSync(p)}`)
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV === 'development' ? 'development' : 'production',
    PORT: String(port),
    ELECTRON_USER_DATA_PATH: userData,
    DATABASE_URL: databaseUrl,
    SQLITE_DATABASE_PATH: databaseFile,
    SQLITE_BACKUP_DIR: getBackupsDir(),
  }

  // Load first existing .env into child process env (Prisma needs process.env.DATABASE_URL)
  let loadedEnvPath: string | null = null
  for (const candidate of envCandidates) {
    if (!fs.existsSync(candidate)) continue
    const parsed = parseEnvFile(candidate)
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] === undefined || env[key] === '') {
        env[key] = value
      }
    }
    if (parsed.JWT_SECRET) {
      env.JWT_SECRET = parsed.JWT_SECRET
    }
    loadedEnvPath = candidate
    env.DOTENV_CONFIG_PATH = candidate
    break
  }

  if (!env.JWT_SECRET) {
    const configDir = getConfigDir()
    fs.mkdirSync(configDir, { recursive: true })
    const secretFile = path.join(configDir, 'jwt-secret')
    if (!fs.existsSync(secretFile)) {
      fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 })
    }
    env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim()
  }

  log(`env file used: ${loadedEnvPath ?? '(none)'}`)
  log(`DATABASE_URL in spawn env: ${env.DATABASE_URL ? 'set' : 'MISSING'}`)

  env.DATABASE_URL = databaseUrl
  logDatabaseSetup(`SQLite database=${databaseFile}`)
  await prepareDatabase(databaseUrl, databaseFile, nodeBin, backendRoot)

  log(`Starting: ${nodeBin} ${entry}`)
  log(`cwd=${backendRoot}`)

  stopping = false
  const child = spawn(nodeBin, [entry], {
    cwd: backendRoot,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  backendProcess = child

  child.stdout?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trimEnd()
    if (text) log(text)
  })

  child.stderr?.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8').trimEnd()
    if (text) log(`[stderr] ${text}`)
  })

  child.on('error', (err) => {
    log(`Process error: ${err.message}`)
  })

  child.on('exit', (code, signal) => {
    const msg = `Process exited code=${code} signal=${signal ?? 'none'}`
    log(msg)
    backendProcess = null
    if (!stopping && code !== 0 && code !== null) {
      log('Backend stopped unexpectedly')
    }
  })

  let startupExitHandler: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined
  const exitedDuringStartup = new Promise<never>((_resolve, reject) => {
    startupExitHandler = (code, signal) => {
      reject(new Error(`Backend exited before readiness (code=${code}, signal=${signal ?? 'none'})`))
    }
    child.once('exit', startupExitHandler)
  })

  try {
    await Promise.race([waitForHealth(port, 45_000), exitedDuringStartup])
    log(`Healthy on http://127.0.0.1:${port}`)
  } catch (err) {
    stopBackendProcess()
    throw err
  } finally {
    if (startupExitHandler) child.off('exit', startupExitHandler)
  }

  return { port, spawned: true }
}

export function stopBackendProcess(): void {
  if (!backendProcess) return
  stopping = true
  const child = backendProcess
  backendProcess = null

  log('Stopping backend...')
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } else {
      child.kill('SIGTERM')
    }
  } catch (err) {
    log(`Stop failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export function isBackendRunning(): boolean {
  return backendProcess !== null && !backendProcess.killed
}
