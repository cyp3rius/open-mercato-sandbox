import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { CommandRuntimeContext, CommandBus } from '@open-mercato/shared/lib/commands'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { isValidPhoneNumber } from '@open-mercato/shared/lib/phone'
import {
  personCreateSchema,
  dealCreateSchema,
  commentCreateSchema,
  type PersonCreateInput,
  type DealCreateInput,
  type CommentCreateInput,
} from '@open-mercato/core/modules/customers/data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: {
    requireAuth: true,
    requireFeatures: ['lead_intake.submit'],
  },
}

const PERSON_NAME_MAX = 120

function mapFullNameToFirstAndLast(fullName: string): { firstName: string; lastName: string } {
  const collapsed = fullName.trim().replace(/\s+/g, ' ')
  const parts = collapsed.split(' ')
  let firstName = (parts[0] ?? '').trim()
  let rest = parts.slice(1).join(' ').trim()
  let lastName = rest.length > 0 ? rest : firstName
  if (firstName.length > PERSON_NAME_MAX) firstName = firstName.slice(0, PERSON_NAME_MAX)
  if (lastName.length > PERSON_NAME_MAX) lastName = lastName.slice(0, PERSON_NAME_MAX)
  return { firstName, lastName }
}

const leadIntakeBodySchema = z.object({
    fullName: z.string().trim().min(1).max(200),
    primaryEmail: z.string().trim().email().max(320),
    primaryPhone: z
      .string()
      .trim()
      .max(50)
      .refine((val) => !val || isValidPhoneNumber(val), { message: 'Invalid phone' })
      .optional(),
    vehicle: z.string().trim().min(1).max(2000),
    message: z.string().trim().min(1).max(8000),
    marketingConsent: z.boolean(),
  })
  .strict()

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

export async function POST(req: Request) {
  try {
    const { ctx, translate } = await buildContext(req)
    const rawBody = await req.json().catch(() => ({}))
    const body = leadIntakeBodySchema.parse(rawBody)
    const displayName = body.fullName.trim().replace(/\s+/g, ' ')
    const { firstName, lastName } = mapFullNameToFirstAndLast(body.fullName)

    const personBase = parseScopedCommandInput(personCreateSchema, {
      firstName,
      lastName,
      displayName,
      primaryEmail: body.primaryEmail,
      primaryPhone: body.primaryPhone && body.primaryPhone.trim().length ? body.primaryPhone : undefined,
      cf_customer_marketing_case: body.marketingConsent,
    }, ctx, translate) as PersonCreateInput & { customFields?: Record<string, unknown> }

    const commandBus = (ctx.container.resolve('commandBus') as CommandBus)
    const { result: personResult } = await commandBus.execute<typeof personBase, { entityId: string; personId: string }>(
      'customers.people.create',
      { input: personBase, ctx },
    )
    const entityId = personResult?.entityId
    if (!entityId) {
      return NextResponse.json({ error: translate('lead_intake.error.person', 'Failed to create person.') }, { status: 400 })
    }

    const dealTitle =
      body.vehicle.length > 200 ? `${body.vehicle.slice(0, 197)}…` : body.vehicle
    const dealInput = parseScopedCommandInput(dealCreateSchema, {
      title: dealTitle,
      description: null,
      status: 'open',
      personIds: [entityId],
      source: 'lead_intake',
    }, ctx, translate) as DealCreateInput & { customFields?: Record<string, unknown> }

    const { result: dealResult } = await commandBus.execute<typeof dealInput, { dealId: string }>(
      'customers.deals.create',
      { input: dealInput, ctx },
    )
    const dealId = dealResult?.dealId
    if (!dealId) {
      return NextResponse.json({ error: translate('lead_intake.error.deal', 'Failed to create deal.') }, { status: 400 })
    }

    const noteBody = `${translate('lead_intake.note.vehicle', 'Vehicle')}: ${body.vehicle}\n\n${body.message}`
    const commentInput = parseScopedCommandInput(commentCreateSchema, {
      entityId,
      dealId,
      body: noteBody,
    }, ctx, translate) as CommentCreateInput & { customFields?: Record<string, unknown> }

    const { result: commentResult } = await commandBus.execute<typeof commentInput, { commentId: string }>(
      'customers.comments.create',
      { input: commentInput, ctx },
    )

    return NextResponse.json({
      personEntityId: entityId,
      personProfileId: personResult?.personId ?? null,
      dealId,
      commentId: commentResult?.commentId ?? null,
    }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 })
    }
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    const { translate } = await resolveTranslations()
    console.error('lead-intake POST failed', err)
    return NextResponse.json({ error: translate('lead_intake.error.generic', 'Lead intake failed.') }, { status: 500 })
  }
}

const leadIntakeOpenBody = z.object({
  fullName: z.string(),
  primaryEmail: z.string(),
  primaryPhone: z.string().optional(),
  vehicle: z.string(),
  message: z.string(),
  marketingConsent: z.boolean(),
})

export const openApi: OpenApiRouteDoc = {
  tag: 'Lead intake',
  summary: 'Create person, deal, and note from a lead form',
  methods: {
    POST: {
      summary: 'Submit lead',
      requestBody: {
        contentType: 'application/json',
        schema: leadIntakeOpenBody,
      },
      responses: [
        {
          status: 201,
          description: 'Created',
          schema: z.object({
            personEntityId: z.string().uuid(),
            personProfileId: z.string().uuid().nullable(),
            dealId: z.string().uuid(),
            commentId: z.string().uuid().nullable(),
          }),
        },
      ],
      errors: [
        { status: 400, description: 'Validation error', schema: z.object({ error: z.unknown() }) },
        { status: 401, description: 'Unauthorized', schema: z.object({ error: z.string() }) },
      ],
    },
  },
}

export default POST
