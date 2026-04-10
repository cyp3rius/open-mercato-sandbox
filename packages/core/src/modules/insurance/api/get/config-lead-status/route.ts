import { NextResponse } from 'next/server'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import {
  LEAD_STATUS_DICTIONARY_CONFIG_MODULE,
  LEAD_STATUS_DICTIONARY_CONFIG_NAME,
  leadStatusDictionarySchema,
  mergeWithDefaultLeadStatusDictionary,
} from '../../../lib/leadStatusDictionary'
import { requireInsuranceFeatures, resolveInsuranceRouteContext } from '../../context'

export const metadata = {
  path: '/insurance/config-lead-status',
  GET: { requireAuth: true, requireFeatures: ['insurance.leads.view'] },
}

async function GET(req: Request) {
  try {
    const context = await resolveInsuranceRouteContext(req)
    await requireInsuranceFeatures(context, ['insurance.leads.view'])

    const configService = context.container.resolve('moduleConfigService') as ModuleConfigService
    const raw = await configService.getValue<unknown>(
      LEAD_STATUS_DICTIONARY_CONFIG_MODULE,
      LEAD_STATUS_DICTIONARY_CONFIG_NAME,
      { defaultValue: null },
    )
    return NextResponse.json(mergeWithDefaultLeadStatusDictionary(raw))
  } catch (err) {
    if (err instanceof CrudHttpError) {
      return NextResponse.json(err.body, { status: err.status })
    }
    console.error('[insurance/config-lead-status.GET] Unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const responseSchema = leadStatusDictionarySchema

const getDoc: OpenApiMethodDoc = {
  summary: 'Insurance lead status dictionary',
  tags: ['Insurance'],
  responses: [{ status: 200, description: 'Lead status dictionary', schema: responseSchema }],
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Insurance',
  summary: 'Get configurable lead inquiry status entries',
  methods: {
    GET: getDoc,
  },
}

export default GET
