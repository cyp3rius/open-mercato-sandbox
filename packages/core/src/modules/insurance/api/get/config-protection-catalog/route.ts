import { NextResponse } from 'next/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  mergeWithDefaultCatalog,
  protectionCatalogSchema,
  PROTECTION_CATALOG_CONFIG_MODULE,
  PROTECTION_CATALOG_CONFIG_NAME,
} from '../../../lib/protectionCatalog'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-protection-catalog',
  GET: { requireAuth: true, requireFeatures: ['insurance.leads.view'] },
}

async function GET(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.leads.view'])

    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    const raw = await configService.getValue<unknown>(
      PROTECTION_CATALOG_CONFIG_MODULE,
      PROTECTION_CATALOG_CONFIG_NAME,
      { defaultValue: null },
    )
    const catalog = mergeWithDefaultCatalog(raw)
    return NextResponse.json(catalog)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[insurance/config-protection-catalog.GET] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = protectionCatalogSchema

const getDoc: OpenApiMethodDoc = {
  summary: 'Insurance protection options catalog (labels, descriptions, sub-options)',
  tags: ['Insurance'],
  responses: [{ status: 200, description: 'Protection catalog', schema: responseSchema }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Get configurable protection catalog for inquiries',
  methods: {
    GET: getDoc,
  },
}

export default GET
