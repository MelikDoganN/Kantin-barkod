/**
 * Stages backend runtime into resources/backend for electron-builder extraResources.
 *
 * Copies: dist/, prisma/, package.json, package-lock.json
 * Then installs production node_modules inside resources/backend.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const backendSrc = path.join(root, 'backend')
const outDir = path.join(root, 'resources', 'backend')

function mustExist(filePath, hint) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}\n${hint}`)
  }
}

function copyDir(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.cpSync(from, to, { recursive: true })
}

function main() {
  console.log('Preparing resources/backend …')

  mustExist(path.join(backendSrc, 'dist', 'index.js'), 'Run: cd backend && npm run build')
  mustExist(path.join(backendSrc, 'prisma', 'schema.prisma'), 'Prisma schema missing')
  mustExist(path.join(backendSrc, 'package.json'), 'backend/package.json missing')

  fs.rmSync(outDir, { recursive: true, force: true })
  fs.mkdirSync(outDir, { recursive: true })

  copyDir(path.join(backendSrc, 'dist'), path.join(outDir, 'dist'))
  copyDir(path.join(backendSrc, 'prisma'), path.join(outDir, 'prisma'))
  fs.copyFileSync(path.join(backendSrc, 'package.json'), path.join(outDir, 'package.json'))

  const lock = path.join(backendSrc, 'package-lock.json')
  if (fs.existsSync(lock)) {
    fs.copyFileSync(lock, path.join(outDir, 'package-lock.json'))
  }

  // Production deps + prisma CLI + tsx (seed on customer machines)
  const pkgPath = path.join(outDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  if (!pkg.dependencies) pkg.dependencies = {}
  const prismaVersion = pkg.devDependencies?.prisma ?? pkg.dependencies?.prisma
  if (prismaVersion && !pkg.dependencies.prisma) {
    pkg.dependencies.prisma = prismaVersion
  }
  const tsxVersion = pkg.devDependencies?.tsx
  if (tsxVersion && !pkg.dependencies.tsx) {
    pkg.dependencies.tsx = tsxVersion
  }
  // Drop prisma seed "tsx" reliance on npm PATH; installer invokes tsx directly.
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

  console.log('Installing production dependencies in resources/backend …')
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = spawnSync(npm, ['install', '--omit=dev'], {
    cwd: outDir,
    stdio: 'inherit',
    shell: true,
  })
  if (install.status !== 0) {
    throw new Error('npm install --omit=dev failed in resources/backend')
  }

  const generate = spawnSync(npm, ['exec', 'prisma', 'generate'], {
    cwd: outDir,
    stdio: 'inherit',
    shell: true,
  })
  if (generate.status !== 0) {
    throw new Error('prisma generate failed in resources/backend')
  }

  // Do not ship .env into the package
  for (const name of ['.env', '.env.local']) {
    const p = path.join(outDir, name)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  console.log('resources/backend ready.')
}

try {
  main()
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}
