import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { CrudHttpError, isCrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { PartnerIncentiveLedgerEntry } from '../../../data/entities'
import { summarizeLedgerBalances } from '../../../lib/incentiveCalculation'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['partner_programs.view'] },
}

async function buildContext(
  req: Request,
): Promise<{ ctx: CommandRuntimeContext; translate: (key: string, fallback?: string) => string }> {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  const { translate } = await resolveTranslations()
  if (!auth) throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const ctx: CommandRuntimeContext = {
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
    organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
    request: req,
  }
  return { ctx, translate }
}

const querySchema = z.object({
  customerEntityId: z.string().uuid(),
})

export async function GET(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      customerEntityId: url.searchParams.get('customerEntityId'),
    })
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: translate(
            'partner_programs.errors.customerEntityIdRequired',
            'customerEntityId is required.',
          ),
        },
        { status: 400 },
      )
    }
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const orgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
    const tenantId = ctx.auth?.tenantId ?? undefined
    const rows = await em.find(PartnerIncentiveLedgerEntry, {
      customerEntityId: parsed.data.customerEntityId,
      tenantId,
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
    })
    const currencies = summarizeLedgerBalances(
      rows.map((row) => ({
        kind: row.kind,
        amount: row.amount,
        currencyCode: row.currencyCode,
      })),
    )
    return NextResponse.json({ currencies })
  } catch (err) {
    if (isCrudHttpError(err)) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('partner_programs incentives balance GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('partner_programs.incentives.errors.loadBalance', 'Failed to load balance.') },
      { status: 500 },
    )
  }
}
