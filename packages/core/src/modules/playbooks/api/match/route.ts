import { NextResponse } from 'next/server'
import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { Playbook } from '../../data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['playbooks.view'] },
}

export async function GET(req: Request) {
  try {
    const { translate } = await resolveTranslations()
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth) {
      return NextResponse.json({ error: translate('errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const url = new URL(req.url)
    const tagsRaw = url.searchParams.get('tags') ?? ''
    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
    const em = (container.resolve('em') as EntityManager).fork()
    const where: FilterQuery<Playbook> = {
      deletedAt: null,
      isActive: true,
    }
    if (auth.tenantId) {
      where.tenantId = auth.tenantId
    }
    if (organizationId) {
      where.organizationId = organizationId
    }
    const rows = await em.find(Playbook, where, { orderBy: { updatedAt: 'DESC' } })
    const activeRows = rows.filter((row) => row.isActive === true)
    const bySlug = new Map<string, Playbook>()
    for (const row of activeRows) {
      const key = row.slug.trim().toLowerCase()
      const prev = bySlug.get(key)
      if (!prev || row.version > prev.version) bySlug.set(key, row)
    }
    const heads = Array.from(bySlug.values())
    const filtered =
      tags.length === 0
        ? heads
        : heads.filter((row) => {
            const ct = Array.isArray(row.contextTags) ? row.contextTags.map((x) => String(x).toLowerCase()) : []
            return tags.some((tag) => ct.includes(tag))
          })
    const items = filtered.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      body: row.body,
      contextTags: row.contextTags,
      audience: row.audience,
      version: row.version,
      isActive: true as const,
    }))
    return NextResponse.json({ items })
  } catch (err) {
    console.error('playbooks match GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('playbooks.errors.match', 'Failed to match playbooks.') }, { status: 500 })
  }
}
