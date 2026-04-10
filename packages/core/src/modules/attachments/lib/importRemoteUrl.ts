import dns from 'node:dns/promises'
import { isIPv4, isIPv6 } from 'node:net'

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024
const MAX_REDIRECTS = 5

export class ImportRemoteUrlError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 400,
  ) {
    super(message)
    this.name = 'ImportRemoteUrlError'
  }
}

function maxBytes(): number {
  const raw = process.env.ATTACHMENT_IMPORT_MAX_BYTES
  if (raw && /^\d+$/.test(raw.trim())) {
    const n = Number.parseInt(raw.trim(), 10)
    if (n > 0 && n <= 200 * 1024 * 1024) return n
  }
  return DEFAULT_MAX_BYTES
}

function allowHttp(): boolean {
  return process.env.ATTACHMENT_IMPORT_ALLOW_HTTP === '1'
}

function isBlockedIp(address: string): boolean {
  if (isIPv4(address)) {
    const parts = address.split('.').map((x) => Number.parseInt(x, 10))
    const [a, b] = parts
    if (a === 10) return true
    if (a === 127) return true
    if (a === 0) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    return false
  }
  if (isIPv6(address)) {
    const h = address.toLowerCase()
    if (h === '::1') return true
    if (h.startsWith('fe80:')) return true
    if (h.startsWith('fc') || h.startsWith('fd')) return true
    return false
  }
  return false
}

function blockedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost') return true
  if (h.endsWith('.local')) return true
  if (h.endsWith('.localhost')) return true
  if (isBlockedIp(h)) return true
  return false
}

async function assertResolvableToPublicInternet(hostname: string): Promise<void> {
  if (blockedHostname(hostname)) {
    throw new ImportRemoteUrlError('URL host is not allowed', 400)
  }
  try {
    const res = await dns.lookup(hostname, { all: true })
    for (const r of res) {
      if (isBlockedIp(r.address)) {
        throw new ImportRemoteUrlError('URL resolves to a disallowed address', 400)
      }
    }
  } catch (e) {
    if (e instanceof ImportRemoteUrlError) throw e
    throw new ImportRemoteUrlError('Could not resolve URL host', 400)
  }
}

function parseUrl(raw: string): URL {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new ImportRemoteUrlError('Invalid URL', 400)
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && allowHttp())) {
    throw new ImportRemoteUrlError(allowHttp() ? 'Only http and https URLs are allowed' : 'Only https URLs are allowed', 400)
  }
  if (!parsed.hostname.length) {
    throw new ImportRemoteUrlError('Invalid URL', 400)
  }
  return parsed
}

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header || typeof header !== 'string') return null
  const m = /filename\*=UTF-8''([^;\s]+)|filename="([^"]+)"|filename=([^;\s]+)/i.exec(header)
  if (!m) return null
  const raw = m[1] || m[2] || m[3]
  if (!raw) return null
  try {
    return decodeURIComponent(raw.replace(/^"|"$/g, ''))
  } catch {
    return raw.replace(/^"|"$/g, '')
  }
}

function fileNameFromPath(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean).pop()
  if (!seg || seg.length > 512) return null
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

export type FetchedRemoteFile = {
  buffer: Buffer
  mimeType: string
  fileName: string
}

/**
 * Downloads a file from a remote URL for attachment import.
 * Validates scheme, blocks obvious SSRF targets, resolves DNS before fetch, follows redirects with re-validation.
 */
export async function fetchRemoteFileForAttachmentImport(sourceUrl: string): Promise<FetchedRemoteFile> {
  const limit = maxBytes()
  let current = parseUrl(sourceUrl.trim())
  await assertResolvableToPublicInternet(current.hostname)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    let res: Response
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: '*/*', 'User-Agent': 'OpenMercato-AttachmentImport/1.0' },
      })
    } catch (e) {
      clearTimeout(timeout)
      const msg = e instanceof Error && e.name === 'AbortError' ? 'Download timed out' : 'Download failed'
      throw new ImportRemoteUrlError(msg, 502)
    } finally {
      clearTimeout(timeout)
    }

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc || hop === MAX_REDIRECTS) {
        throw new ImportRemoteUrlError('Too many redirects or missing Location', 400)
      }
      const next = new URL(loc, current)
      current = parseUrl(next.toString())
      await assertResolvableToPublicInternet(current.hostname)
      continue
    }

    if (!res.ok) {
      throw new ImportRemoteUrlError(`Remote server returned ${res.status}`, 502)
    }

    const lenHeader = res.headers.get('content-length')
    if (lenHeader && /^\d+$/.test(lenHeader.trim())) {
      const n = Number.parseInt(lenHeader.trim(), 10)
      if (n > limit) {
        throw new ImportRemoteUrlError('Remote file exceeds size limit', 400)
      }
    }

    const arrayBuffer = await res.arrayBuffer()
    if (arrayBuffer.byteLength > limit) {
      throw new ImportRemoteUrlError('Remote file exceeds size limit', 400)
    }
    const buffer = Buffer.from(arrayBuffer)

    const mimeHeader = res.headers.get('content-type')
    const mimeType =
      mimeHeader && mimeHeader.trim().length > 0
        ? mimeHeader.split(';')[0].trim()
        : 'application/octet-stream'

    const fromCd = fileNameFromContentDisposition(res.headers.get('content-disposition'))
    const fromPath = fileNameFromPath(current.pathname)
    const baseName = fromCd || fromPath || 'download'
    const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 240) || 'download'

    return { buffer, mimeType, fileName: safeName }
  }

  throw new ImportRemoteUrlError('Too many redirects', 400)
}
