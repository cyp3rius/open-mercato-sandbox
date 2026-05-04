import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/modules/core/__integration__/helpers/api'
import {
  createCompanyFixture,
  deleteEntityIfExists,
  readJsonSafe,
} from '@open-mercato/core/modules/core/__integration__/helpers/crmFixtures'

type JsonRecord = Record<string, unknown>

async function createPartnerProgram(request: Parameters<typeof apiRequest>[0], token: string, name: string): Promise<string> {
  const res = await apiRequest(request, 'POST', '/api/partner_programs/programs', {
    token,
    data: { name },
  })
  expect(res.ok(), `create program failed: ${res.status()}`).toBeTruthy()
  const body = await readJsonSafe<JsonRecord>(res)
  const id = typeof body?.id === 'string' ? body.id : null
  expect(id).toBeTruthy()
  return id as string
}

async function postMembership(
  request: Parameters<typeof apiRequest>[0],
  token: string,
  programId: string,
  customerEntityId: string,
): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const res = await apiRequest(request, 'POST', `/api/partner_programs/programs/${programId}/memberships`, {
    token,
    data: { customerEntityId },
  })
  const body = await readJsonSafe<JsonRecord>(res)
  return { ok: res.ok(), status: res.status(), body }
}

/**
 * TC-CRM-028: Partner programs API — membership validation and uniqueness
 * Source: .ai/specs/2026-05-02-crm-partner-program-module.md (Integration tests)
 */
test.describe('TC-CRM-028: Partner programs memberships API', () => {
  test('rejects membership for a non-partner company with PARTNER_PROGRAM_MEMBERSHIP_INVALID_CUSTOMER_TYPE', async ({
    request,
  }) => {
    let token: string | null = null
    let programId: string | null = null
    let companyId: string | null = null

    try {
      token = await getAuthToken(request)
      programId = await createPartnerProgram(request, token, `QA PP invalid type ${Date.now()}`)
      companyId = await createCompanyFixture(request, token, `QA PP non-partner ${Date.now()}`)

      const { ok, status, body } = await postMembership(request, token, programId, companyId)
      expect(ok).toBe(false)
      expect(status).toBe(400)
      expect(body?.code).toBe('PARTNER_PROGRAM_MEMBERSHIP_INVALID_CUSTOMER_TYPE')
    } finally {
      if (token && programId) {
        await apiRequest(request, 'DELETE', '/api/partner_programs/programs', { token, data: { id: programId } })
      }
      await deleteEntityIfExists(request, token, '/api/customers/companies', companyId)
    }
  })

  test('allows membership for a company with crmRecordType partner', async ({ request }) => {
    let token: string | null = null
    let programId: string | null = null
    let partnerCompanyId: string | null = null
    let membershipId: string | null = null

    try {
      token = await getAuthToken(request)
      programId = await createPartnerProgram(request, token, `QA PP partner ok ${Date.now()}`)

      const createCo = await apiRequest(request, 'POST', '/api/customers/companies', {
        token,
        data: { displayName: `QA PP partner co ${Date.now()}`, crmRecordType: 'partner' },
      })
      expect(createCo.ok()).toBeTruthy()
      const coBody = await readJsonSafe<JsonRecord>(createCo)
      partnerCompanyId =
        typeof coBody?.id === 'string'
          ? coBody.id
          : typeof coBody?.entityId === 'string'
            ? (coBody.entityId as string)
            : null
      expect(partnerCompanyId).toBeTruthy()

      const add = await postMembership(request, token, programId!, partnerCompanyId!)
      expect(add.ok, JSON.stringify(add.body)).toBe(true)
      expect(add.status).toBe(201)
      membershipId = typeof add.body?.id === 'string' ? add.body.id : null
      expect(membershipId).toBeTruthy()

      const list = await apiRequest(request, 'GET', `/api/partner_programs/programs/${programId}/memberships`, {
        token,
      })
      expect(list.ok()).toBeTruthy()
      const listBody = await readJsonSafe<JsonRecord>(list)
      const items = Array.isArray(listBody?.items) ? (listBody.items as JsonRecord[]) : []
      expect(items.some((row) => row?.customerEntityId === partnerCompanyId)).toBe(true)
    } finally {
      if (token && membershipId && programId) {
        await apiRequest(
          request,
          'DELETE',
          `/api/partner_programs/programs/${programId}/memberships?id=${encodeURIComponent(membershipId)}`,
          { token },
        )
      }
      if (token && programId) {
        await apiRequest(request, 'DELETE', '/api/partner_programs/programs', { token, data: { id: programId } })
      }
      await deleteEntityIfExists(request, token, '/api/customers/companies', partnerCompanyId)
    }
  })

  test('returns 409 when adding the same partner twice to the same program', async ({ request }) => {
    let token: string | null = null
    let programId: string | null = null
    let partnerCompanyId: string | null = null
    let membershipId: string | null = null

    try {
      token = await getAuthToken(request)
      programId = await createPartnerProgram(request, token, `QA PP dup ${Date.now()}`)

      const createCo = await apiRequest(request, 'POST', '/api/customers/companies', {
        token,
        data: { displayName: `QA PP dup co ${Date.now()}`, crmRecordType: 'partner' },
      })
      expect(createCo.ok()).toBeTruthy()
      const coBody = await readJsonSafe<JsonRecord>(createCo)
      partnerCompanyId = typeof coBody?.id === 'string' ? coBody.id : null
      expect(partnerCompanyId).toBeTruthy()

      const first = await postMembership(request, token, programId!, partnerCompanyId!)
      expect(first.ok).toBe(true)
      membershipId = typeof first.body?.id === 'string' ? first.body.id : null

      const second = await postMembership(request, token, programId!, partnerCompanyId!)
      expect(second.ok).toBe(false)
      expect(second.status).toBe(409)
    } finally {
      if (token && membershipId && programId) {
        await apiRequest(
          request,
          'DELETE',
          `/api/partner_programs/programs/${programId}/memberships?id=${encodeURIComponent(membershipId)}`,
          { token },
        )
      }
      if (token && programId) {
        await apiRequest(request, 'DELETE', '/api/partner_programs/programs', { token, data: { id: programId } })
      }
      await deleteEntityIfExists(request, token, '/api/customers/companies', partnerCompanyId)
    }
  })
})
