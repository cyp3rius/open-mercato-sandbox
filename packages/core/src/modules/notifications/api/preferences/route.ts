import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/core'
import type { Knex } from 'knex'
import { resolveRequestContext } from '@open-mercato/shared/lib/api/context'
import { getModules } from '@open-mercato/shared/lib/i18n/server'
import type { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { saveNotificationPreferencesSchema } from '../../data/preferenceValidators'
import {
  buildNotificationPreferenceGroups,
  getRoleGrantedFeaturesForUser,
  getStoredPreferenceMap,
  saveNotificationPreferences,
} from '../../lib/notificationPreferenceService'

export const metadata = {
  GET: { requireAuth: true },
  PUT: { requireAuth: true },
}

function getKnex(em: EntityManager): Knex {
  return (em.getConnection() as unknown as { getKnex: () => Knex }).getKnex()
}

async function loadFeatureCatalog(): Promise<Array<{ id: string; title: string }>> {
  const modules = getModules() ?? []
  return modules
    .filter((module) => typeof module.id === 'string' && module.id.length > 0)
    .map((module) => ({
      id: module.id,
      title: (module.info as { title?: string } | undefined)?.title ?? module.id,
    }))
}

export async function GET(req: Request) {
  const { ctx } = await resolveRequestContext(req)
  const userId = ctx.auth?.sub
  const tenantId = ctx.auth?.tenantId
  if (!userId || !tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const em = ctx.container.resolve('em') as EntityManager
  const rbac = ctx.container.resolve('rbacService') as RbacService
  const knex = getKnex(em)

  const [acl, roleFeatures, storedPreferences, modules] = await Promise.all([
    rbac.loadAcl(userId, { tenantId, organizationId: ctx.selectedOrganizationId ?? null }),
    getRoleGrantedFeaturesForUser(knex, userId, tenantId),
    getStoredPreferenceMap(em, userId, tenantId),
    loadFeatureCatalog(),
  ])

  const groups = buildNotificationPreferenceGroups({
    userFeatures: acl.features,
    roleFeatures,
    storedPreferences,
    modules,
  })

  return NextResponse.json({ groups })
}

export async function PUT(req: Request) {
  const { ctx } = await resolveRequestContext(req)
  const userId = ctx.auth?.sub
  const tenantId = ctx.auth?.tenantId
  if (!userId || !tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const input = saveNotificationPreferencesSchema.parse(body)

  const em = ctx.container.resolve('em') as EntityManager
  const rbac = ctx.container.resolve('rbacService') as RbacService
  const knex = getKnex(em)

  const [acl, roleFeatures] = await Promise.all([
    rbac.loadAcl(userId, { tenantId, organizationId: ctx.selectedOrganizationId ?? null }),
    getRoleGrantedFeaturesForUser(knex, userId, tenantId),
  ])

  await saveNotificationPreferences(em, {
    userId,
    tenantId,
    userFeatures: acl.features,
    roleFeatures,
    preferences: input.preferences,
  })

  return NextResponse.json({ ok: true })
}

export default { GET, PUT }
