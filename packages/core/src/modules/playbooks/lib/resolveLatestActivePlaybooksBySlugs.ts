import type { EntityManager } from '@mikro-orm/postgresql'
import { Playbook } from '../data/entities'

export type ResolvedPlaybookHeadBySlug = {
  slug: string
  playbookId: string | null
  title: string | null
  version: number | null
}

export async function resolveLatestActivePlaybooksBySlugs(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
  slugs: string[],
): Promise<ResolvedPlaybookHeadBySlug[]> {
  const orderedUnique: string[] = []
  const seen = new Set<string>()
  for (const raw of slugs) {
    const slug = typeof raw === 'string' ? raw.trim().toLowerCase() : ''
    if (!slug.length || seen.has(slug)) continue
    seen.add(slug)
    orderedUnique.push(slug)
  }
  const out: ResolvedPlaybookHeadBySlug[] = []
  for (const slug of orderedUnique) {
    const row = await em.findOne(
      Playbook,
      {
        tenantId,
        organizationId,
        slug,
        deletedAt: null,
        isActive: true,
      },
      { orderBy: { version: 'DESC' } },
    )
    out.push({
      slug,
      playbookId: row?.id ?? null,
      title: typeof row?.title === 'string' ? row.title : null,
      version: row && typeof row.version === 'number' && Number.isFinite(row.version) ? Math.trunc(row.version) : null,
    })
  }
  return out
}
