/**
 * Finds Inno Setup Compiler (ISCC.exe) and builds Kantin-POS-Setup.exe
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const iss = path.join(root, 'installer', 'KantinPOS.iss')
const unpacked = path.join(root, 'release', 'win-unpacked', 'Kantin POS.exe')
const nodeExe = path.join(root, 'resources', 'runtime', 'node', 'node.exe')
const backendEntry = path.join(
  root,
  'release',
  'win-unpacked',
  'resources',
  'backend',
  'dist',
  'index.js',
)

function findIscc() {
  const envPath = process.env.INNO_SETUP_ISCC
  if (envPath && fs.existsSync(envPath)) return envPath

  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 6', 'ISCC.exe'),
    path.join(process.env.ProgramFiles || '', 'Inno Setup 6', 'ISCC.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Inno Setup 5', 'ISCC.exe'),
  ]
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c
  }
  return null
}

function main() {
  if (!fs.existsSync(iss)) throw new Error(`Missing ${iss}`)
  if (!fs.existsSync(unpacked)) {
    throw new Error('Missing release/win-unpacked. Run: npm run dist')
  }
  if (!fs.existsSync(nodeExe)) {
    throw new Error('Missing portable Node. Run: npm run download:node')
  }
  if (!fs.existsSync(backendEntry)) {
    throw new Error(
      'Packaged backend missing under release/win-unpacked/resources/backend. Re-run npm run dist',
    )
  }

  const iscc = findIscc()
  if (!iscc) {
    throw new Error(
      'Inno Setup Compiler (ISCC.exe) not found.\n' +
        'Install Inno Setup 6 from https://jrsoftware.org/isinfo.php\n' +
        'Or set INNO_SETUP_ISCC to ISCC.exe path.',
    )
  }

  console.log(`Using ISCC: ${iscc}`)
  const result = spawnSync(iscc, [iss], { cwd: root, stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`ISCC failed with code ${result.status}`)
  }

  const out = path.join(root, 'dist-installer', 'Kantin-Barkod-Setup.exe')
  if (!fs.existsSync(out)) {
    throw new Error(`Expected output missing: ${out}`)
  }
  console.log(`Installer ready: ${out}`)
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
