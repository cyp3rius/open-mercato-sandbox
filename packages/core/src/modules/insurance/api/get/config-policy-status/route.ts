import { NextResponse } from 'next/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  mergeWithDefaultPolicyStatusDictionary,
  policyStatusDictionarySchema,
  POLICY_STATUS_DICTIONARY_CONFIG_MODULE,
  POLICY_STATUS_DICTIONARY_CONFIG_NAME,
} from '../../../lib/policyStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-policy-status',
  GET: { requireAuth: true, requireFeatures: ['insurance.policies.view'] },
}

async function GET(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.policies.view'])

    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    const raw = await configService.getValue<unknown>(
      POLICY_STATUS_DICTIONARY_CONFIG_MODULE,
      POLICY_STATUS_DICTIONARY_CONFIG_NAME,
      { defaultValue: null },
    )
    const catalog = mergeWithDefaultPolicyStatusDictionary(raw)
    return NextResponse.json(catalog)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[insurance/config-policy-status.GET] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = policyStatusDictionarySchema

const getDoc: OpenApiMethodDoc = {
  summary: 'Insurance policy status dictionary (labels, icons, colors)',
  tags: ['Insurance'],
  responses: [{ status: 200, description: 'Policy status dictionary', schema: responseSchema }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Get configurable policy status entries',
  methods: {
    GET: getDoc,
  },
}

export default GET
