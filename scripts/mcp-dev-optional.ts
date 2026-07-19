/**
 * Optional MCP companion for `yarn dev`.
 * Starts mcp:dev when OPEN_MERCATO_MCP_API_KEY (or legacy aliases / .mcp.json) is present;
 * otherwise logs a clear skip message and exits 0 so the app keeps running.
 */
import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { config as loadDotenv } from 'dotenv'

async function findMcpJson(startDir: string): Promise<string | null> {
  let dir = startDir
  const root = resolve('/')
  while (dir !== root) {
    const candidate = resolve(dir, '.mcp.json')
    try {
      await access(candidate)
      return candidate
    } catch {
      dir = dirname(dir)
    }
  }
  return null
}

async function apiKeyFromMcpJson(): Promise<string | undefined> {
  try {
    const path = await findMcpJson(process.cwd())
    if (!path) return undefined
    const content = await readFile(path, 'utf-8')
    const parsed = JSON.parse(content) as {
      mcpServers?: Record<string, { headers?: Record<string, string> }>
    }
    const servers = parsed.mcpServers ?? {}
    const preferred =
      servers['open-mercato-local'] ??
      servers['open-mercato'] ??
      Object.values(servers).find((entry) => typeof entry?.headers?.['x-api-key'] === 'string')
    const key = preferred?.headers?.['x-api-key']?.trim()
    return key && key.length > 0 ? key : undefined
  } catch {
    return undefined
  }
}

function apiKeyFromEnv(): string | undefined {
  const candidates = [
    'OPEN_MERCATO_MCP_API_KEY',
    'OPEN_MERCATO_API_KEY',
    'MCP_API_KEY',
    'MCP_SERVER_API_KEY',
  ]
  for (const name of candidates) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return undefined
}

async function main(): Promise<void> {
  loadDotenv({ path: resolve(process.cwd(), 'apps/mercato/.env') })

  const key = apiKeyFromEnv() ?? (await apiKeyFromMcpJson())
  if (!key) {
    console.error(
      '[dev:mcp] Skipping MCP — set OPEN_MERCATO_MCP_API_KEY=omk_… in apps/mercato/.env ' +
        '(Settings → API Keys), then restart yarn dev. Manual: yarn mcp:dev',
    )
    process.exit(0)
  }

  console.error('[dev:mcp] Starting MCP with the app (OPEN_MERCATO_MCP_API_KEY configured)…')
  const child = spawn('yarn', ['mcp:dev'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    cwd: process.cwd(),
  })

  const shutdown = (signal: NodeJS.Signals) => {
    if (!child.killed) child.kill(signal)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  child.on('exit', (code, signal) => {
    if (signal) process.exit(0)
    process.exit(code ?? 0)
  })
}

void main()
