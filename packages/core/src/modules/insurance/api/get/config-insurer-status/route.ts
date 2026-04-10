import { NextResponse } from 'next/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  mergeWithDefaultInsurerStatusDictionary,
  insurerStatusDictionarySchema,
  INSURER_STATUS_DICTIONARY_CONFIG_MODULE,
  INSURER_STATUS_DICTIONARY_CONFIG_NAME,
} from '../../../lib/insurerStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-insurer-status',
  GET: { requireAuth: true, requireFeatures: ['insurance.insurers.view'] },
}

async function GET(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.insurers.view'])

    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    const raw = await configService.getValue<unknown>(
      INSURER_STATUS_DICTIONARY_CONFIG_MODULE,
      INSURER_STATUS_DICTIONARY_CONFIG_NAME,
      { defaultValue: null },
    )
    const catalog = mergeWithDefaultInsurerStatusDictionary(raw)
    return NextResponse.json(catalog)
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[insurance/config-insurer-status.GET] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = insurerStatusDictionarySchema

const getDoc: OpenApiMethodDoc = {
  summary: 'Insurance insurer status dictionary (labels, icons, colors)',
  tags: ['Insurance'],
  responses: [{ status: 200, description: 'Insurer status dictionary', schema: responseSchema }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Get configurable insurer status entries',
  methods: {
    GET: getDoc,
  },
}

export default GET
