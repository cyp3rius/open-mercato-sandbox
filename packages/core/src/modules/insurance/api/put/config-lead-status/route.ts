import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  LEAD_STATUS_DICTIONARY_CONFIG_MODULE,
  LEAD_STATUS_DICTIONARY_CONFIG_NAME,
  leadStatusDictionarySchema,
} from '../../../lib/leadStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-lead-status',
  PUT: { requireAuth: true, requireFeatures: ['insurance.config.manage'] },
}

const bodySchema = leadStatusDictionarySchema

async function PUT(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.config.manage'])

    const body = bodySchema.parse(await req.json())
    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    await configService.setValue(LEAD_STATUS_DICTIONARY_CONFIG_MODULE, LEAD_STATUS_DICTIONARY_CONFIG_NAME, body)

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[insurance/config-lead-status.PUT] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace insurance lead status dictionary',
  tags: ['Insurance'],
  requestBody: { schema: bodySchema },
  responses: [{ status: 200, description: 'Updated dictionary', schema: leadStatusDictionarySchema }],
  errors: [{ status: 400, description: 'Invalid body' }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Update lead inquiry status dictionary',
  methods: {
    PUT: putDoc,
  },
}

export default PUT
