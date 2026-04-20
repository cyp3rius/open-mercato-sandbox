import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { readJsonSafe } from '@open-mercato/shared/lib/http/readJsonSafe'
import {
  runCrudMutationGuardAfterSuccess,
  validateCrudMutationGuard,
} from '@open-mercato/shared/lib/crud/mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { resolveAuthActorId } from '../../../../customers/lib/interactionRequestContext'
import {
  procurementProcessCompleteSchema,
  type ProcurementProcessCompleteInput,
} from '../../../data/validators'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
}

export async function POST(req: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    const { translate } = await resolveTranslations()
    if (!auth || !auth.tenantId) {
      throw new CrudHttpError(401, { error: translate('errors.unauthorized', 'Unauthorized') })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const ctx: CommandRuntimeContext = {
      container,
      auth,
      organizationScope: scope,
      selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
      organizationIds: scope?.filterIds ?? (auth.orgId ? [auth.orgId] : null),
      request: req,
    }
    const body = await readJsonSafe<Record<string, unknown>>(req, {})
    const input = parseScopedCommandInput(procurementProcessCompleteSchema, body, ctx, translate)
    const guardUserId = resolveAuthActorId(auth)
    const guardResult = await validateCrudMutationGuard(container, {
      tenantId: auth.tenantId,
      organizationId: ctx.selectedOrganizationId,
      userId: guardUserId,
      resourceKind: 'procurement.process',
      resourceId: input.id,
      operation: 'custom',
      requestMethod: req.method,
      requestHeaders: req.headers,
      mutationPayload: { ...input } as Record<string, unknown>,
    })
    if (guardResult && !guardResult.ok) {
      return NextResponse.json(guardResult.body, { status: guardResult.status })
    }
    const commandBus = ctx.container.resolve('commandBus') as CommandBus
    const { result } = await commandBus.execute<ProcurementProcessCompleteInput, { processId: string }>(
      'procurement.processes.complete',
      { input, ctx },
    )
    if (guardResult?.ok && guardResult.shouldRunAfterSuccess) {
      await runCrudMutationGuardAfterSuccess(container, {
        tenantId: auth.tenantId,
        organizationId: ctx.selectedOrganizationId,
        userId: guardUserId,
        resourceKind: 'procurement.process',
        resourceId: input.id,
        operation: 'custom',
        requestMethod: req.method,
        requestHeaders: req.headers,
        metadata: guardResult.metadata ?? null,
      })
    }
    return NextResponse.json({ processId: result?.processId ?? null, ok: true })
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('errors.unexpected', 'Unexpected error') }, { status: 500 })
  }
}

const completeBodySchema = z.object({
  tenantId: z.uuid(),
  organizationId: z.uuid(),
  id: z.uuid(),
  resourceId: z.uuid(),
  salesInvoiceId: z.uuid().nullable().optional(),
})

export const openApi: OpenApiRouteDoc = {
  methods: {
    POST: {
      summary: 'Complete procurement process',
      description: 'Links the process to a resource, sets closed status, and records the final invoice reference when provided.',
      tags: ['Procurement'],
      security: ['bearerAuth'],
      requestBody: {
        schema: completeBodySchema,
      },
      responses: [
        {
          status: 200,
          description: 'Process completed',
          schema: z.object({
            ok: z.literal(true),
            processId: z.uuid().nullable(),
          }),
        },
      ],
    },
  },
}
