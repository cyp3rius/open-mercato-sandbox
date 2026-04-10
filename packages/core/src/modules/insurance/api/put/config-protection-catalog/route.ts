import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  protectionCatalogSchema,
  PROTECTION_CATALOG_CONFIG_MODULE,
  PROTECTION_CATALOG_CONFIG_NAME,
} from '../../../lib/protectionCatalog'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-protection-catalog',
  PUT: { requireAuth: true, requireFeatures: ['insurance.config.manage'] },
}

const bodySchema = protectionCatalogSchema

async function PUT(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.config.manage'])

    const body = bodySchema.parse(await req.json())
    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    await configService.setValue(PROTECTION_CATALOG_CONFIG_MODULE, PROTECTION_CATALOG_CONFIG_NAME, body)

    return NextResponse.json(body)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.issues }, { status: 400 })
    }
    console.error('[insurance/config-protection-catalog.PUT] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const putDoc: OpenApiMethodDoc = {
  summary: 'Replace insurance protection options catalog',
  tags: ['Insurance'],
  requestBody: { schema: bodySchema },
  responses: [{ status: 200, description: 'Updated catalog', schema: protectionCatalogSchema }],
  errors: [{ status: 400, description: 'Invalid body' }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Update protection catalog',
  methods: {
    PUT: putDoc,
  },
}

export default PUT
