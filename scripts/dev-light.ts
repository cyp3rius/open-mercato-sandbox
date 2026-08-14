/**
 * Low-memory local dev: Next app only.
 * Skips package watchers, MCP companion, queue workers, and scheduler.
 */
import { spawn } from 'node:child_process'

console.error(
  '[dev:light] Starting app only (no package watchers, no MCP, workers/scheduler off).',
)
console.error('[dev:light] After editing packages/*, run: yarn build:packages')

const child = spawn('yarn', ['dev:app'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  cwd: process.cwd(),
  env: {
    ...process.env,
    AUTO_SPAWN_WORKERS: 'false',
    AUTO_SPAWN_SCHEDULER: 'false',
  },
})

const forward = (signal: NodeJS.Signals) => {
  if (!child.killed) child.kill(signal)
}

process.on('SIGINT', () => forward('SIGINT'))
process.on('SIGTERM', () => forward('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) process.exit(1)
  process.exit(code ?? 0)
})
