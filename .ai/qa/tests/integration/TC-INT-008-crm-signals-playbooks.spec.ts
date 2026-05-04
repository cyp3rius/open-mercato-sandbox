import { expect, test } from '@playwright/test'
import { getAuthToken, apiRequest } from '../helpers/api'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

function decodeJwtPayload(token: string): { tenantId?: string; orgId?: string | null } {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      tenantId?: string
      orgId?: string | null
    }
  } catch {
    return {}
  }
}

test.describe('TC-INT-008: Customer signals and playbooks (CRM)', () => {
  test('ingest signal and list by customer; playbook match by tag', async ({ request }) => {
    test.slow()
    const token = await getAuthToken(request, 'admin')
    const claims = decodeJwtPayload(token)
    const tenantId = claims.tenantId
    const organizationId = claims.orgId
    expect(tenantId, 'JWT should include tenantId for admin').toBeTruthy()
    expect(organizationId, 'JWT should include orgId for admin').toBeTruthy()

    const listCo = await apiRequest(request, 'GET', '/api/customers/companies?page=1&pageSize=1', { token })
    expect(listCo.ok(), 'List companies should succeed').toBeTruthy()
    const listCoBody = (await listCo.json()) as { items?: Array<{ id: string }> }
    const companyEntityId = listCoBody.items?.[0]?.id
    expect(companyEntityId, 'At least one company should exist in seed data.').toBeTruthy()

    const sigRes = await apiRequest(request, 'POST', '/api/customer_signals/signals', {
      token,
      data: {
        tenantId,
        organizationId,
        customerEntityId: companyEntityId,
        signalType: 'qa.catalog.view',
        source: 'integration',
        payload: { test: true },
      },
    })
    expect(sigRes.status(), 'Signal ingest should return 201').toBe(201)
    const sigBody = (await sigRes.json()) as { id?: string }
    expect(typeof sigBody.id, 'Signal id should be returned').toBe('string')

    const listSig = await apiRequest(
      request,
      'GET',
      `/api/customer_signals/signals?customerEntityId=${encodeURIComponent(companyEntityId!)}&page=1&pageSize=20`,
      { token },
    )
    expect(listSig.ok(), 'Signal list should succeed').toBeTruthy()
    const listSigBody = (await listSig.json()) as { items?: Array<{ signalType?: string }> }
    const types = (listSigBody.items ?? []).map((i) => i.signalType)
    expect(types).toContain('qa.catalog.view')

    const stamp = Date.now()
    const slug = `qa-collision-${stamp}`
    const pbCreate = await apiRequest(request, 'POST', '/api/playbooks', {
      token,
      data: {
        tenantId,
        organizationId,
        slug,
        title: `QA Playbook ${stamp}`,
        body: '## Steps\n1. Check',
        contextTags: ['collision'],
        audience: 'internal',
        isActive: true,
      },
    })
    expect(pbCreate.ok(), 'Playbook create should succeed').toBeTruthy()

    const match = await request.get(`${BASE_URL}/api/playbooks/match?tags=collision`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(match.ok(), 'Playbook match should succeed').toBeTruthy()
    const matchBody = (await match.json()) as { items?: Array<{ slug?: string }> }
    const slugs = (matchBody.items ?? []).map((i) => i.slug)
    expect(slugs).toContain(slug)
  })
})
