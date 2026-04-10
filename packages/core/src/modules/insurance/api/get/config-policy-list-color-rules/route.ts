import { NextResponse } from 'next/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  parsePolicyListColorRules,
  policyListColorRulesSchema,
  POLICY_LIST_COLOR_RULES_CONFIG_MODULE,
  POLICY_LIST_COLOR_RULES_CONFIG_NAME,
} from '../../../lib/policyListColorRules'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-policy-list-color-rules',
  GET: { requireAuth: true, requireFeatures: ['insurance.policies.view'] },
}

async function GET(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.policies.view'])

    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    const raw = await configService.getValue<unknown>(
      POLICY_LIST_COLOR_RULES_CONFIG_MODULE,
      POLICY_LIST_COLOR_RULES_CONFIG_NAME,
      { defaultValue: null },
    )
    const payload = parsePolicyListColorRules(raw)
    return NextResponse.json(payload)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[insurance/config-policy-list-color-rules.GET] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = policyListColorRulesSchema

const getDoc: OpenApiMethodDoc = {
  summary: 'Policy list row color rules (ordered by priority)',
  tags: ['Insurance'],
  responses: [{ status: 200, description: 'Color rules', schema: responseSchema }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Get policy list conditional row colors',
  methods: {
    GET: getDoc,
  },
}

export default GET
