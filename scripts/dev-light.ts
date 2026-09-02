/**
 * Low-memory local dev: Next app + taxi-fleet platform CSV import worker.
 * Skips package watchers, MCP companion, full queue workers, and scheduler.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'

const PLATFORM_SYNC_QUEUE = 'taxi-fleet-platform-sync'
const appDir = path.join(process.cwd(), 'apps/mercato')
const queueBaseDir = path.join(appDir, '.mercato', 'queue')

console.error(
  '[dev:light] Starting app + platform sync worker (scheduled API sync; CSV import runs inline in app when QUEUE_STRATEGY=local).',
)
console.error('[dev:light] After editing packages/*, run: yarn build:packages')

const children: ChildProcess[] = []

const sharedEnv = {
  ...process.env,
  AUTO_SPAWN_WORKERS: 'false',
  AUTO_SPAWN_SCHEDULER: 'false',
  QUEUE_BASE_DIR: queueBaseDir,
}

const app = spawn('yarn', ['dev:app'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: process.cwd(),
  env: sharedEnv,
})
children.push(app)

const worker = spawn('yarn', ['mercato', 'queue', 'worker', PLATFORM_SYNC_QUEUE], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: appDir,
  env: sharedEnv,
})
children.push(worker)

const forward = (signal: NodeJS.Signals) => {
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}

process.on('SIGINT', () => forward('SIGINT'))
process.on('SIGTERM', () => forward('SIGTERM'))

const exitWhenAllDone = () => {
  const stillRunning = children.some((child) => child.exitCode === null && !child.killed)
  if (stillRunning) return
  const codes = children.map((child) => child.exitCode).filter((code): code is number => code != null)
  const failed = codes.find((code) => code !== 0)
  process.exit(failed ?? 0)
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) {
      forward('SIGTERM')
      process.exit(1)
      return
    }
    if (code !== 0 && code != null) {
      forward('SIGTERM')
      process.exit(code)
      return
    }
    exitWhenAllDone()
  })
}
