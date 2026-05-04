import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { ensurePlaybookProcedureStatusDictionary } from '../../../lib/ensurePlaybookProcedureStatusDictionary'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['playbooks.view'] },
}

export async function GET(req: Request) {
  try {
    const { translate } = await resolveTranslations()
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth || !auth.tenantId) {
      return NextResponse.json({ error: translate('errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    if (!organizationId) {
      return NextResponse.json(
        { error: translate('playbooks.dictionary.errors.organization', 'Organization context is required.') },
        { status: 400 },
      )
    }
    const em = (container.resolve('em') as EntityManager).fork()
    const result = await ensurePlaybookProcedureStatusDictionary(em, {
      tenantId: auth.tenantId,
      organizationId,
    })
    return NextResponse.json({ dictionaryId: result.dictionaryId })
  } catch (err) {
    console.error('[playbooks.dictionaries.procedure-status.GET]', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json(
      { error: translate('playbooks.dictionary.errors.ensure', 'Could not ensure playbook status dictionary.') },
      { status: 500 },
    )
  }
}
