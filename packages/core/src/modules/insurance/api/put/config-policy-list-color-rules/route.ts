import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  policyListColorRulesSchema,
  POLICY_LIST_COLOR_RULES_CONFIG_MODULE,
  POLICY_LIST_COLOR_RULES_CONFIG_NAME,
} from '../../../lib/policyListColorRules'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-policy-list-color-rules',
  PUT: { requireAuth: true, requireFeatures: ['insurance.config.manage'] },
}

const bodySchema = policyListColorRulesSchema

async function PUT(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.config.manage'])

    const body = bodySchema.parse(await req.json())
    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    await configService.setValue(POLICY_LIST_COLOR_RULES_CONFIG_MODULE, POLICY_LIST_COLOR_RULES_CONFIG_NAME, body)

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[insurance/config-policy-list-color-rules.PUT] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace policy list color rules',
  tags: ['Insurance'],
  requestBody: { schema: bodySchema },
  responses: [{ status: 200, description: 'Updated rules', schema: policyListColorRulesSchema }],
  errors: [{ status: 400, description: 'Invalid body' }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Update policy list conditional row colors',
  methods: {
    PUT: putDoc,
  },
}

export default PUT
