import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { OperationsTask } from '@open-mercato/core/modules/procurement/data/entities'
import { ServiceCase } from '@open-mercato/core/modules/cases/data/entities'
import { UserTask } from '@open-mercato/core/modules/workflows/data/entities'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['dashboards.view'] },
}

export async function GET(req: Request) {
  try {
    const { translate } = await resolveTranslations()
    const container = await createRequestContainer()
    const auth = await getAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: translate('errors.unauthorized', 'Unauthorized') }, { status: 401 })
    }
    const isSuperAdmin = (auth as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const tenantId = auth.tenantId ?? null
    if (!tenantId && !isSuperAdmin) {
      return NextResponse.json({ error: translate('errors.badRequest', 'Bad request') }, { status: 400 })
    }
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope?.selectedId ?? auth.orgId ?? null
    const rbac = container.resolve('rbacService') as RbacService
    const scopeArg = { tenantId, organizationId }

    const canResources = await rbac.userHasAnyFeature(
      auth.sub,
      [
        'resources.view',
        'procurement.processes.view',
        'resources.*',
        'procurement.*',
      ],
      scopeArg,
    )
    const canCases = await rbac.userHasAnyFeature(auth.sub, ['cases.view', 'cases.*'], scopeArg)
    const canWorkflows = await rbac.userHasAnyFeature(
      auth.sub,
      ['workflows.view_tasks', 'workflows.view', 'workflows.*'],
      scopeArg,
    )

    const em = (container.resolve('em') as EntityManager).fork()
    const now = new Date()
    const slaCutoff = new Date(now.getTime() - 48 * 3600000)

    let overdueResourceTasks: number | null = null
    if (canResources && tenantId) {
      overdueResourceTasks = await em.count(OperationsTask, {
        tenantId,
        ...(organizationId ? { organizationId } : {}),
        contextType: 'resource',
        deletedAt: null,
        dueAt: { $lt: now },
        taskStatus: { $nin: ['done', 'cancelled'] },
      })
    }

    let openCasesSla: number | null = null
    if (canCases && tenantId) {
      openCasesSla = await em.count(ServiceCase, {
        tenantId,
        ...(organizationId ? { organizationId } : {}),
        deletedAt: null,
        closedAt: null,
        openedAt: { $lt: slaCutoff },
        statusValue: { $nin: ['closed', 'resolved'] },
      })
    }

    let qcPending: number | null = null
    if (canWorkflows && tenantId) {
      qcPending = await em.count(UserTask, {
        tenantId,
        ...(organizationId ? { organizationId } : {}),
        dueDate: { $lt: now },
        status: { $in: ['PENDING', 'IN_PROGRESS', 'ESCALATED'] },
        completedAt: null,
      })
    }

    return NextResponse.json({
      overdueResourceTasks,
      openCasesSla,
      qcPending,
      fetchedAt: now.toISOString(),
    })
  } catch (err) {
    console.error('crm kpis GET', err)
    const { translate } = await resolveTranslations()
    return NextResponse.json({ error: translate('dashboards.crm.kpisError', 'Failed to load KPIs.') }, { status: 500 })
  }
}
