/**
 * Canonical MCP HTTP server environment variables.
 *
 * Preferred names (Open Mercato MCP*):
 * - OPEN_MERCATO_MCP_API_KEY — CRM API key (`omk_…`) used by mcp:dev / clients as `x-api-key`
 * - OPEN_MERCATO_MCP_HOST — listen address (default `0.0.0.0`)
 * - OPEN_MERCATO_MCP_PORT — listen port (default `3001`)
 * - OPEN_MERCATO_MCP_URL — base URL for in-app OpenCode → MCP (default derived from host/port)
 * - OPEN_MERCATO_MCP_DEBUG — `true` for verbose MCP logs
 *
 * Deprecated aliases (still read, prefer new names):
 * - OPEN_MERCATO_API_KEY, MCP_API_KEY, MCP_SERVER_API_KEY
 * - MCP_HOST, MCP_DEV_PORT, MCP_URL, MCP_DEBUG
 */

const warned = new Set<string>()

function warnDeprecated(oldName: string, newName: string): void {
  if (warned.has(oldName)) return
  warned.add(oldName)
  console.error(
    `[MCP] Deprecated env ${oldName} — use ${newName} instead. Old name still works for now.`,
  )
}

function firstDefined(
  pairs: Array<{ name: string; preferred?: boolean; mapsTo?: string }>,
): string | undefined {
  for (const pair of pairs) {
    const raw = process.env[pair.name]
    const value = typeof raw === 'string' ? raw.trim() : ''
    if (!value) continue
    if (!pair.preferred && pair.mapsTo) {
      warnDeprecated(pair.name, pair.mapsTo)
    }
    return value
  }
  return undefined
}

/** CRM API key for MCP auth (`omk_…`). */
export function resolveMcpApiKeyFromEnv(): string | undefined {
  return firstDefined([
    { name: 'OPEN_MERCATO_MCP_API_KEY', preferred: true },
    { name: 'OPEN_MERCATO_API_KEY', mapsTo: 'OPEN_MERCATO_MCP_API_KEY' },
    { name: 'MCP_API_KEY', mapsTo: 'OPEN_MERCATO_MCP_API_KEY' },
    { name: 'MCP_SERVER_API_KEY', mapsTo: 'OPEN_MERCATO_MCP_API_KEY' },
  ])
}

export function isMcpApiKeyConfigured(): boolean {
  return Boolean(resolveMcpApiKeyFromEnv())
}

export function resolveMcpHost(): string {
  return (
    firstDefined([
      { name: 'OPEN_MERCATO_MCP_HOST', preferred: true },
      { name: 'MCP_HOST', mapsTo: 'OPEN_MERCATO_MCP_HOST' },
    ]) ?? '0.0.0.0'
  )
}

export function resolveMcpPort(defaultPort = 3001): number {
  const raw = firstDefined([
    { name: 'OPEN_MERCATO_MCP_PORT', preferred: true },
    { name: 'MCP_DEV_PORT', mapsTo: 'OPEN_MERCATO_MCP_PORT' },
  ])
  const parsed = raw ? parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultPort
}

export function resolveMcpDebug(): boolean {
  const raw = firstDefined([
    { name: 'OPEN_MERCATO_MCP_DEBUG', preferred: true },
    { name: 'MCP_DEBUG', mapsTo: 'OPEN_MERCATO_MCP_DEBUG' },
  ])
  return raw === 'true'
}

/** Base URL used by the in-app assistant to reach the MCP HTTP server. */
export function resolveMcpBaseUrl(): string {
  const explicit = firstDefined([
    { name: 'OPEN_MERCATO_MCP_URL', preferred: true },
    { name: 'MCP_URL', mapsTo: 'OPEN_MERCATO_MCP_URL' },
  ])
  if (explicit) return explicit.replace(/\/$/, '')
  const port = resolveMcpPort()
  return `http://localhost:${port}`
}
