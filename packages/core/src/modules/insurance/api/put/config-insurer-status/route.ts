import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  insurerStatusDictionarySchema,
  INSURER_STATUS_DICTIONARY_CONFIG_MODULE,
  INSURER_STATUS_DICTIONARY_CONFIG_NAME,
} from '../../../lib/insurerStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-insurer-status',
  PUT: { requireAuth: true, requireFeatures: ['insurance.config.manage'] },
}

const bodySchema = insurerStatusDictionarySchema

async function PUT(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.config.manage'])

    const body = bodySchema.parse(await req.json())
    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    await configService.setValue(INSURER_STATUS_DICTIONARY_CONFIG_MODULE, INSURER_STATUS_DICTIONARY_CONFIG_NAME, body)

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[insurance/config-insurer-status.PUT] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace insurance insurer status dictionary',
  tags: ['Insurance'],
  requestBody: { schema: bodySchema },
  responses: [{ status: 200, description: 'Updated dictionary', schema: insurerStatusDictionarySchema }],
  errors: [{ status: 400, description: 'Invalid body' }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Update insurer status dictionary',
  methods: {
    PUT: putDoc,
  },
}

export default PUT
