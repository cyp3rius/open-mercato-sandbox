import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDriverProfile } from '@/modules/taxi_fleet/data/entities'
import { buildDriverApiContext } from '@/modules/taxi_fleet/lib/driverApiContext'
import {
  actorCanImpersonateDriver,
  applyDriverImpersonationCookie,
  clearDriverImpersonationCookie,
  DRIVER_IMPERSONATE_FEATURE,
} from '@/modules/taxi_fleet/lib/driverImpersonation'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: [DRIVER_IMPERSONATE_FEATURE] },
  DELETE: { requireAuth: true, requireFeatures: [DRIVER_IMPERSONATE_FEATURE] },
}

const startSchema = z.object({
  teamMemberId: z.string().uuid(),
})

export async function POST(req: Request) {
  try {
    const context = await buildDriverApiContext(req)
    const { translate } = await resolveTranslations()
    if (!(await actorCanImpersonateDriver(context))) {
      throw new CrudHttpError(403, {
        error: translate(
          'taxi_fleet.driverApp.impersonation.forbidden',
          'You are not allowed to preview the driver app.',
        ),
      })
    }
    const body = await req.json().catch(() => ({}))
    const parsed = startSchema.parse(body)
    const tenantId = context.organizationScope?.tenantId ?? context.auth?.tenantId ?? null
    const organizationId =
      context.selectedOrganizationId ?? context.organizationScope?.selectedId ?? context.auth?.orgId ?? null
    const em = context.container.resolve('em') as EntityManager
    const member = await findOneWithDecryption(
      em,
      StaffTeamMember,
      { id: parsed.teamMemberId, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    if (!member) {
      throw new CrudHttpError(404, {
        error: translate('taxi_fleet.errors.driverNotLinked', 'Driver profile not linked to staff member.'),
      })
    }
    const profile = await findOneWithDecryption(
      em,
      TaxiFleetDriverProfile,
      { teamMemberId: member.id, deletedAt: null },
      undefined,
      { tenantId, organizationId },
    )
    const res = NextResponse.json({
      ok: true,
      impersonation: {
        active: true as const,
        teamMemberId: member.id,
        displayName: member.displayName,
        profileId: profile?.id ?? null,
        readOnly: true as const,
      },
    })
    applyDriverImpersonationCookie(res, member.id)
    return res
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) return NextResponse.json(err.body, { status: err.status })
    console.error('[taxi_fleet/driver/impersonation] POST failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request) {
  try {
    const res = NextResponse.json({ ok: true })
    clearDriverImpersonationCookie(res)
    return res
  } catch (err) {
    console.error('[taxi_fleet/driver/impersonation] DELETE failed', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  POST: {
    summary: 'Start read-only driver app preview for a team member',
    tags: ['Taxi fleet driver'],
    requestBody: { schema: startSchema },
  },
  DELETE: {
    summary: 'Stop driver app preview impersonation',
    tags: ['Taxi fleet driver'],
  },
}

export default POST
