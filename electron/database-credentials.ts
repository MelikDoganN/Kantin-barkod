import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { getConfigDir } from './paths'

export interface DatabaseCredentials {
  host: string
  port: number
  username: string
  password: string
  database: string
}

const credentialsPath = () => path.join(getConfigDir(), 'db-credentials.bin')

export function saveDatabasePassword(password: string): void {
  if (!password.trim()) throw new Error('PostgreSQL şifresi boş olamaz.')
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Bu Windows hesabı için güvenli kimlik bilgisi saklama kullanılamıyor.')
  }

  const credentials: DatabaseCredentials = {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password,
    database: 'kantin_pos',
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(credentials))
  const file = credentialsPath()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, encrypted, { mode: 0o600 })
}

export function loadDatabaseCredentials(): DatabaseCredentials | null {
  const file = credentialsPath()
  if (!fs.existsSync(file)) return null
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Bu Windows hesabı için güvenli kimlik bilgisi saklama kullanılamıyor.')
  }

  try {
    const decrypted = safeStorage.decryptString(fs.readFileSync(file))
    const credentials = JSON.parse(decrypted) as DatabaseCredentials
    if (
      !credentials.host ||
      !Number.isInteger(credentials.port) ||
      !credentials.username ||
      !credentials.password ||
      !credentials.database
    ) {
      return null
    }
    return credentials
  } catch {
    return null
  }
}

export function toDatabaseUrl(credentials: DatabaseCredentials): string {
  const username = encodeURIComponent(credentials.username)
  const password = encodeURIComponent(credentials.password)
  const database = encodeURIComponent(credentials.database)
  return `postgresql://${username}:${password}@${credentials.host}:${credentials.port}/${database}?schema=public`
}
