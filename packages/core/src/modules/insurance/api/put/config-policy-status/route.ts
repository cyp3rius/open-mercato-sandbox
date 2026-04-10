import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  policyStatusDictionarySchema,
  POLICY_STATUS_DICTIONARY_CONFIG_MODULE,
  POLICY_STATUS_DICTIONARY_CONFIG_NAME,
} from '../../../lib/policyStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-policy-status',
  PUT: { requireAuth: true, requireFeatures: ['insurance.config.manage'] },
}

const bodySchema = policyStatusDictionarySchema

async function PUT(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.config.manage'])

    const body = bodySchema.parse(await req.json())
    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    await configService.setValue(POLICY_STATUS_DICTIONARY_CONFIG_MODULE, POLICY_STATUS_DICTIONARY_CONFIG_NAME, body)

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[insurance/config-policy-status.PUT] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace insurance policy status dictionary',
  tags: ['Insurance'],
  requestBody: { schema: bodySchema },
  responses: [{ status: 200, description: 'Updated dictionary', schema: policyStatusDictionarySchema }],
  errors: [{ status: 400, description: 'Invalid body' }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Update policy status dictionary',
  methods: {
    PUT: putDoc,
  },
}

export default PUT
