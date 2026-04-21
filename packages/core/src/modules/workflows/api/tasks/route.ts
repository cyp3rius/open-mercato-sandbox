/**
 * User Tasks API
 *
 * Endpoints:
 * - GET /api/workflows/tasks - List user tasks
 */

import { NextRequest, NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { User } from '@open-mercato/core/modules/auth/data/entities'
import { UserTask } from '../../data/entities'
import { serializeUserTaskForApi } from '../../lib/serializeUserTask'
import { startOfLocalToday } from '../../lib/userTaskDue'
import {
  workflowsTag,
  userTaskListQuerySchema,
  userTaskListResponseSchema,
  workflowErrorSchema,
} from '../openapi'

export const metadata = {
  requireAuth: true,
  requireFeatures: ['workflows.tasks.view'],
}

/**
 * GET /api/workflows/tasks
 *
 * List user tasks with optional filters
 *
 * Query params:
 * - status: Filter by task status (PENDING, IN_PROGRESS, COMPLETED, CANCELLED)
 * - assignedTo: Filter by assigned user ID
 * - workflowInstanceId: Filter by workflow instance
 * - overdue: Filter overdue tasks (true/false)
 * - myTasks: Show only tasks assigned to or claimable by current user (true/false)
 * - limit: Number of results (default 50)
 * - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const container = await createRequestContainer()
    const em = container.resolve('em')
    const auth = await getAuthFromRequest(request)

    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const scope = await resolveOrganizationScopeForRequest({ container, auth, request })
    const tenantId = auth.tenantId
    const organizationId = scope?.selectedId ?? auth.orgId

    if (!tenantId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing tenant or organization context' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const assignedTo = searchParams.get('assignedTo')
    const workflowInstanceId = searchParams.get('workflowInstanceId')
    const overdue = searchParams.get('overdue') === 'true'
    const myTasks = searchParams.get('myTasks') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause with tenant scoping
    const where: any = {
      tenantId,
      organizationId,
    }

    if (status) {
      // Handle comma-separated status values
      const statusValues = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statusValues.length === 1) {
        where.status = statusValues[0]
      } else if (statusValues.length > 1) {
        where.status = { $in: statusValues }
      }
    }

    if (assignedTo) {
      where.assignedTo = assignedTo
    }

    if (workflowInstanceId) {
      where.workflowInstanceId = workflowInstanceId
    }

    if (overdue) {
      // Calendar-day overdue: due before start of today (not “same calendar day as now”)
      where.dueDate = { $lt: startOfLocalToday() }
      where.status = { $in: ['PENDING', 'IN_PROGRESS'] }
    }

    if (myTasks) {
      // Show tasks assigned to current user or to their roles
      where.$or = [
        { assignedTo: auth.sub },
        { assignedToRoles: { $overlap: auth.roles || [] } },
      ]
    }

    const [tasks, total] = await em.findAndCount(UserTask, where, {
      orderBy: { createdAt: 'DESC' },
      limit,
      offset,
    })

    const userIds = [
      ...new Set(
        tasks
          .flatMap((t) => [t.assignedTo, t.claimedBy])
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]
    const users =
      userIds.length > 0
        ? await em.find(User, { id: { $in: userIds as any[] }, deletedAt: null })
        : []
    const displayById = new Map(
      users.map((u) => {
        const name = typeof u.name === 'string' && u.name.trim().length ? u.name.trim() : null
        const label = name ?? u.email ?? u.id
        return [u.id, label] as const
      }),
    )

    const data = tasks.map((t) => ({
      ...serializeUserTaskForApi(t),
      assignedToDisplayName: t.assignedTo ? displayById.get(t.assignedTo) ?? null : null,
      claimedByDisplayName: t.claimedBy ? displayById.get(t.claimedBy) ?? null : null,
    }))

    return NextResponse.json({
      data,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + tasks.length < total,
      },
    })
  } catch (error) {
    console.error('Error listing user tasks:', error)
    return NextResponse.json(
      {
        error: 'Failed to list user tasks',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: workflowsTag,
  summary: 'User task management',
  methods: {
    GET: {
      summary: 'List user tasks',
      description: 'Returns paginated list of user tasks with optional filtering by status, assignee, workflow instance, overdue, and myTasks flags.',
      query: userTaskListQuerySchema,
      responses: [
        { status: 200, description: 'User tasks list with pagination', schema: userTaskListResponseSchema },
      ],
      errors: [
        { status: 400, description: 'Invalid query parameters or missing tenant context', schema: workflowErrorSchema },
        { status: 401, description: 'Unauthorized', schema: workflowErrorSchema },
        { status: 500, description: 'Internal server error', schema: workflowErrorSchema },
      ],
    },
  },
}
