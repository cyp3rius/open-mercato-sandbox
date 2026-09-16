#!/usr/bin/env node
/**
 * Bump driver PWA version when driver-app files are staged for commit.
 * Keeps in sync:
 * - apps/mercato/src/modules/taxi_fleet/lib/driverAppVersion.ts
 * - apps/mercato/src/modules/taxi_fleet/lib/driverPwaHead.ts (icon cache-bust)
 * - apps/mercato/public/driver-sw.js
 *
 * Usage:
 *   node scripts/bump-driver-pwa-version.mjs           # bump if staged driver files
 *   node scripts/bump-driver-pwa-version.mjs --force   # always bump
 *   node scripts/bump-driver-pwa-version.mjs --check   # exit 1 if versions out of sync
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const VERSION_TS = path.join(
  ROOT,
  'apps/mercato/src/modules/taxi_fleet/lib/driverAppVersion.ts',
)
const HEAD_TS = path.join(ROOT, 'apps/mercato/src/modules/taxi_fleet/lib/driverPwaHead.ts')
const SW_JS = path.join(ROOT, 'apps/mercato/public/driver-sw.js')

const DRIVER_PATH_PREFIXES = [
  'apps/mercato/src/modules/taxi_fleet/frontend/driver/',
  'apps/mercato/src/modules/taxi_fleet/components/driverApp/',
  'apps/mercato/src/modules/taxi_fleet/lib/driverOffline/',
  'apps/mercato/src/modules/taxi_fleet/lib/driverPwaHead.ts',
  'apps/mercato/src/modules/taxi_fleet/lib/driverAppVersion.ts',
  'apps/mercato/src/modules/taxi_fleet/lib/driverPush/',
  'apps/mercato/src/modules/taxi_fleet/api/driver/',
  'apps/mercato/public/driver-sw.js',
  'apps/mercato/public/driver/',
]

const force = process.argv.includes('--force')
const check = process.argv.includes('--check')

function readVersionFromTs(filePath, exportName) {
  const text = fs.readFileSync(filePath, 'utf8')
  const match = text.match(new RegExp(`export const ${exportName} = '([^']+)'`))
  return match?.[1] ?? null
}

function readVersionFromSw(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const match = text.match(/const DRIVER_APP_VERSION = '([^']+)'/)
  return match?.[1] ?? null
}

function stagedFiles() {
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: ROOT,
      encoding: 'utf8',
    })
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function touchesDriverApp(files) {
  return files.some((file) =>
    DRIVER_PATH_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix)),
  )
}

function nextVersion(current) {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const dayStamp = `${y}${m}${d}`
  if (!current || !current.startsWith(dayStamp)) return `${dayStamp}a`
  const suffix = current.slice(dayStamp.length) || 'a'
  const code = suffix.charCodeAt(0)
  if (code >= 97 && code < 122) return `${dayStamp}${String.fromCharCode(code + 1)}`
  return `${dayStamp}${suffix}x`
}

function writeVersion(version) {
  fs.writeFileSync(
    VERSION_TS,
    `/**
 * Driver PWA build id — bump when shipping driver-app UX/runtime changes so
 * installed home-screen clients pick up a new service worker / cache.
 * Kept in sync with \`public/driver-sw.js\` (\`DRIVER_APP_VERSION\`) by
 * \`scripts/bump-driver-pwa-version.mjs\` (husky pre-commit).
 */
export const DRIVER_APP_VERSION = '${version}'
`,
  )

  let head = fs.readFileSync(HEAD_TS, 'utf8')
  head = head.replace(
    /export const DRIVER_PWA_ICON_VERSION = '[^']+'/,
    `export const DRIVER_PWA_ICON_VERSION = '${version}'`,
  )
  fs.writeFileSync(HEAD_TS, head)

  let sw = fs.readFileSync(SW_JS, 'utf8')
  sw = sw.replace(
    /const DRIVER_APP_VERSION = '[^']+'/,
    `const DRIVER_APP_VERSION = '${version}'`,
  )
  fs.writeFileSync(SW_JS, sw)
}

function stageVersionFiles() {
  execSync(
    `git add ${JSON.stringify(VERSION_TS)} ${JSON.stringify(HEAD_TS)} ${JSON.stringify(SW_JS)}`,
    { cwd: ROOT, stdio: 'inherit' },
  )
}

const appVersion = readVersionFromTs(VERSION_TS, 'DRIVER_APP_VERSION')
const iconVersion = readVersionFromTs(HEAD_TS, 'DRIVER_PWA_ICON_VERSION')
const swVersion = readVersionFromSw(SW_JS)

if (check) {
  if (!appVersion || appVersion !== iconVersion || appVersion !== swVersion) {
    console.error(
      `[bump-driver-pwa-version] version mismatch: app=${appVersion} icon=${iconVersion} sw=${swVersion}`,
    )
    process.exit(1)
  }
  console.log(`[bump-driver-pwa-version] ok ${appVersion}`)
  process.exit(0)
}

const staged = stagedFiles()
const shouldBump = force || touchesDriverApp(staged)

if (!shouldBump) {
  if (appVersion && (appVersion !== iconVersion || appVersion !== swVersion)) {
    console.error(
      `[bump-driver-pwa-version] versions out of sync (app=${appVersion} icon=${iconVersion} sw=${swVersion}). Run with --force.`,
    )
    process.exit(1)
  }
  process.exit(0)
}

const version = nextVersion(appVersion)
writeVersion(version)
try {
  stageVersionFiles()
} catch {
  // not in a git commit context
}
console.log(`[bump-driver-pwa-version] ${appVersion ?? '?'} → ${version}`)
