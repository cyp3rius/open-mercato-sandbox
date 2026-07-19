/**
 * Runs Next app + optional MCP HTTP server side by side for local `yarn dev`.
 */
import { spawn, type ChildProcess } from 'node:child_process'

const children: ChildProcess[] = []

function start(label: string, args: string[]): ChildProcess {
  console.error(`[dev] starting ${label}: yarn ${args.join(' ')}`)
  const child = spawn('yarn', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    cwd: process.cwd(),
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (signal) return
    // If the app exits, tear down MCP (and vice versa when app dies).
    for (const other of children) {
      if (other !== child && !other.killed) other.kill('SIGTERM')
    }
    process.exit(code ?? 0)
  })
  return child
}

start('app', ['dev:app'])
start('mcp', ['mcp:dev:optional'])

const forward = (signal: NodeJS.Signals) => {
  for (const child of children) {
    if (!child.killed) child.kill(signal)
  }
}
process.on('SIGINT', () => forward('SIGINT'))
process.on('SIGTERM', () => forward('SIGTERM'))
