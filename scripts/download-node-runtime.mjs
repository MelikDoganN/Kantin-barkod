/**
 * Downloads portable Node.js (Windows x64) into resources/runtime/node
 * so customers do not need a system Node install.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outDir = path.join(root, 'resources', 'runtime', 'node')
const cacheDir = path.join(root, 'installer', 'vendor', 'cache')

/** Pin a Node 20 LTS build that matches typical argon2 prebuilds. */
const NODE_VERSION = process.env.KANTIN_NODE_VERSION || '20.18.1'
const ZIP_NAME = `node-v${NODE_VERSION}-win-x64.zip`
const ZIP_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${ZIP_NAME}`

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function main() {
  const nodeExe = path.join(outDir, 'node.exe')
  if (fs.existsSync(nodeExe) && process.env.KANTIN_FORCE_NODE_DOWNLOAD !== '1') {
    console.log(`Portable Node already present: ${nodeExe}`)
    return
  }

  fs.mkdirSync(cacheDir, { recursive: true })
  fs.mkdirSync(path.dirname(outDir), { recursive: true })

  const zipPath = path.join(cacheDir, ZIP_NAME)
  const extractFolderName = `node-v${NODE_VERSION}-win-x64`
  const extractRoot = path.join(cacheDir, extractFolderName)

  if (!fs.existsSync(zipPath)) {
    console.log(`Downloading ${ZIP_URL} …`)
    const dl = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri ${psQuote(ZIP_URL)} -OutFile ${psQuote(zipPath)}`,
      ],
      { stdio: 'inherit' },
    )
    if (dl.status !== 0) {
      throw new Error('Failed to download Node.js zip')
    }
  } else {
    console.log(`Using cached zip: ${zipPath}`)
  }

  if (fs.existsSync(extractRoot)) {
    fs.rmSync(extractRoot, { recursive: true, force: true })
  }

  const expand = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -Path ${psQuote(zipPath)} -DestinationPath ${psQuote(cacheDir)} -Force`,
    ],
    { stdio: 'inherit' },
  )
  if (expand.status !== 0) {
    throw new Error('Failed to extract Node.js zip')
  }

  if (!fs.existsSync(extractRoot)) {
    throw new Error(`Extracted folder missing: ${extractRoot}`)
  }

  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true })
  }
  fs.renameSync(extractRoot, outDir)

  if (!fs.existsSync(nodeExe)) {
    throw new Error(`node.exe missing after extract: ${nodeExe}`)
  }

  console.log(`Portable Node ready: ${nodeExe}`)
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
