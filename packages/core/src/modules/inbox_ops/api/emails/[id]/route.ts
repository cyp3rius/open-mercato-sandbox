import { NextResponse } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { ServiceCase } from '@open-mercato/core/modules/cases/data/entities'
import { InboxEmail } from '../../../data/entities'
import { inboxEmailLinkCaseSchema } from '../../../data/validators'
import {
  resolveRequestContext,
  extractPathSegment,
  UnauthorizedError,
} from '../../routeHelpers'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['inbox_ops.log.view'] },
  PATCH: { requireAuth: true, requireFeatures: ['inbox_ops.proposals.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['inbox_ops.proposals.manage'] },
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const id = extractPathSegment(url, 'emails')

    if (!id) {
      return NextResponse.json({ error: 'Missing email ID' }, { status: 400 })
    }

    const ctx = await resolveRequestContext(req)

    const email = await findOneWithDecryption(
      ctx.em,
      InboxEmail,
      {
        id,
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      undefined,
      ctx.scope,
    )

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    return NextResponse.json({ email })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[inbox_ops:emails:detail] Error:', err)
    return NextResponse.json({ error: 'Failed to load email' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const url = new URL(req.url)
    const id = extractPathSegment(url, 'emails')

    if (!id) {
      return NextResponse.json({ error: 'Missing email ID' }, { status: 400 })
    }

    const raw = await req.json().catch(() => null)
    const parsed = inboxEmailLinkCaseSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const ctx = await resolveRequestContext(req)

    const email = await findOneWithDecryption(
      ctx.em,
      InboxEmail,
      {
        id,
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      undefined,
      ctx.scope,
    )

    if (!email) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    const nextCaseId = parsed.data.caseId
    if (nextCaseId === null) {
      email.caseId = null
    } else {
      const caseRow = await ctx.em.findOne(ServiceCase, {
        id: nextCaseId,
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      })
      if (!caseRow) {
        return NextResponse.json({ error: 'Case not found' }, { status: 404 })
      }
      email.caseId = nextCaseId
    }

    await ctx.em.flush()

    return NextResponse.json({ email })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[inbox_ops:emails:patch] Error:', err)
    return NextResponse.json({ error: 'Failed to update email' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url)
    const id = extractPathSegment(url, 'emails')

    if (!id) {
      return NextResponse.json({ error: 'Missing email ID' }, { status: 400 })
    }

    const ctx = await resolveRequestContext(req)

    const updated = await ctx.em.nativeUpdate(
      InboxEmail,
      {
        id,
        organizationId: ctx.organizationId,
        tenantId: ctx.tenantId,
        deletedAt: null,
      },
      { deletedAt: new Date() },
    )

    if (updated === 0) {
      return NextResponse.json({ error: 'Email not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[inbox_ops:emails:delete] Error:', err)
    return NextResponse.json({ error: 'Failed to delete email' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'InboxOps',
  summary: 'Email detail',
  methods: {
    GET: {
      summary: 'Get email detail with parsed thread',
      responses: [
        { status: 200, description: 'Email detail' },
        { status: 404, description: 'Email not found' },
      ],
    },
    PATCH: {
      summary: 'Link or unlink inbox email to a CRM case',
      responses: [
        { status: 200, description: 'Email updated' },
        { status: 400, description: 'Invalid body' },
        { status: 404, description: 'Email or case not found' },
      ],
    },
    DELETE: {
      summary: 'Soft-delete an inbox email',
      responses: [
        { status: 200, description: 'Email deleted' },
        { status: 404, description: 'Email not found' },
      ],
    },
  },
}
