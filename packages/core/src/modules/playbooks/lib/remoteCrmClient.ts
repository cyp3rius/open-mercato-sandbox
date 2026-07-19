export type RemoteCrmConfig = {
  baseUrl: string
  apiKey: string
  organizationId?: string
}

export type RemoteCrmJson = Record<string, unknown>

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function resolveRemoteCrmConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): RemoteCrmConfig {
  const baseUrl = (env.OPEN_MERCATO_BASE_URL ?? env.MERCATO_BASE_URL ?? '').trim()
  const apiKey = (env.OPEN_MERCATO_API_KEY ?? env.MERCATO_API_KEY ?? '').trim()
  const organizationId = (
    env.OPEN_MERCATO_ORGANIZATION_ID ??
    env.OPEN_MERCATO_ORG_ID ??
    env.MERCATO_ORGANIZATION_ID ??
    ''
  ).trim()

  if (!baseUrl) {
    throw new Error('Missing OPEN_MERCATO_BASE_URL (remote CRM origin, e.g. https://crm.example.com)')
  }
  if (!apiKey) {
    throw new Error('Missing OPEN_MERCATO_API_KEY (API key secret with playbooks features)')
  }

  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    organizationId: organizationId || undefined,
  }
}

export class RemoteCrmClient {
  readonly config: RemoteCrmConfig

  constructor(config: RemoteCrmConfig) {
    this.config = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    }
  }

  private headers(extra?: HeadersInit): Headers {
    const headers = new Headers(extra)
    headers.set('x-api-key', this.config.apiKey)
    headers.set('accept', 'application/json')
    if (this.config.organizationId) {
      headers.set('x-organization-id', this.config.organizationId)
      headers.set('cookie', `om_selected_org=${this.config.organizationId}`)
    }
    return headers
  }

  async request<T = RemoteCrmJson>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    const init: RequestInit = {
      method,
      headers: this.headers(body !== undefined ? { 'content-type': 'application/json' } : undefined),
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }
    const res = await fetch(url, init)
    const text = await res.text()
    let json: unknown = null
    if (text) {
      try {
        json = JSON.parse(text) as unknown
      } catch {
        json = { raw: text }
      }
    }
    if (!res.ok) {
      const message =
        json && typeof json === 'object' && json !== null && 'error' in json
          ? String((json as { error: unknown }).error)
          : `HTTP ${res.status}`
      const err = new Error(message) as Error & { status?: number; body?: unknown }
      err.status = res.status
      err.body = json
      throw err
    }
    return (json ?? {}) as T
  }

  compileMarkdown(markdown: string) {
    return this.request('POST', '/api/playbooks/from-markdown', { markdown, dryRun: true })
  }

  applyMarkdown(markdown: string, dryRun = false) {
    return this.request('POST', '/api/playbooks/from-markdown', { markdown, dryRun })
  }

  applyMarkdownBatch(documents: string[], dryRun = false) {
    return this.request('POST', '/api/playbooks/from-markdown', { documents, dryRun })
  }

  exportMarkdown(params: { slug?: string; id?: string }) {
    const query = new URLSearchParams()
    if (params.id) query.set('id', params.id)
    else if (params.slug) query.set('slug', params.slug.trim().toLowerCase())
    return this.request('GET', `/api/playbooks/to-markdown?${query.toString()}`)
  }

  exportMarkdownBatch(params: { ids?: string[]; slugs?: string[] }) {
    return this.request('POST', '/api/playbooks/to-markdown', params)
  }

  listPlaybooks(params?: { search?: string; slug?: string; pageSize?: number }) {
    const query = new URLSearchParams()
    query.set('page', '1')
    query.set('pageSize', String(params?.pageSize ?? 50))
    query.set('isActive', 'true')
    if (params?.search?.trim()) query.set('search', params.search.trim())
    if (params?.slug?.trim()) query.set('slug', params.slug.trim().toLowerCase())
    return this.request('GET', `/api/playbooks?${query.toString()}`)
  }

  getPlaybookBySlug(slug: string) {
    return this.listPlaybooks({ slug, pageSize: 1 })
  }

  getPlaybookById(id: string) {
    const query = new URLSearchParams({ ids: id, pageSize: '1', isActive: 'true' })
    return this.request('GET', `/api/playbooks?${query.toString()}`)
  }
}
