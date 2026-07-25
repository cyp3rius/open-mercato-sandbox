import { expect, test } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/modules/core/__integration__/helpers/api'
import {
  createOrderLineFixture,
  createSalesOrderFixture,
  deleteSalesEntityIfExists,
} from '@open-mercato/core/modules/core/__integration__/helpers/salesFixtures'
import {
  deleteEntityIfExists,
  readJsonSafe,
} from '@open-mercato/core/modules/core/__integration__/helpers/crmFixtures'

type JsonRecord = Record<string, unknown>

async function createPartnerCompany(
  request: Parameters<typeof apiRequest>[0],
  token: string,
  name: string,
): Promise<string> {
  const res = await apiRequest(request, 'POST', '/api/customers/companies', {
    token,
    data: { displayName: name, crmRecordType: 'partner' },
  })
  expect(res.ok(), `create partner failed: ${res.status()}`).toBeTruthy()
  const body = await readJsonSafe<JsonRecord>(res)
  const id =
    typeof body?.id === 'string'
      ? body.id
      : typeof body?.entityId === 'string'
        ? body.entityId
        : null
  expect(id).toBeTruthy()
  return id as string
}

/**
 * TC-CRM-029: Partner incentive accrual, balance, payout, and idempotency
 * Source: .ai/specs/2026-05-02-crm-partner-program-module.md
 */
test.describe('TC-CRM-029: Partner program incentives', () => {
  test('accrues incentive for referring partner order and payout clears payable', async ({ request }) => {
    let token: string | null = null
    let programId: string | null = null
    let partnerCompanyId: string | null = null
    let membershipId: string | null = null
    let orderId: string | null = null
    let orderLineId: string | null = null

    try {
      token = await getAuthToken(request)
      const stamp = Date.now()

      const createProgram = await apiRequest(request, 'POST', '/api/partner_programs/programs', {
        token,
        data: { name: `QA PP incentive ${stamp}`, incentivePercent: 10 },
      })
      expect(createProgram.ok(), `create program: ${createProgram.status()}`).toBeTruthy()
      const programBody = await readJsonSafe<JsonRecord>(createProgram)
      programId = typeof programBody?.id === 'string' ? programBody.id : null
      expect(programId).toBeTruthy()

      partnerCompanyId = await createPartnerCompany(request, token, `QA PP incentive co ${stamp}`)

      const addMem = await apiRequest(
        request,
        'POST',
        `/api/partner_programs/programs/${programId}/memberships`,
        { token, data: { customerEntityId: partnerCompanyId } },
      )
      expect(addMem.ok(), JSON.stringify(await readJsonSafe(addMem))).toBeTruthy()
      const memBody = await readJsonSafe<JsonRecord>(addMem)
      membershipId = typeof memBody?.id === 'string' ? memBody.id : null

      orderId = await createSalesOrderFixture(request, token, 'USD')
      const setPartner = await apiRequest(request, 'PUT', '/api/sales/orders', {
        token,
        data: {
          id: orderId,
          referringPartnerEntityId: partnerCompanyId,
          referringPartnerProgramId: programId,
        },
      })
      expect(setPartner.ok(), `set referring partner: ${setPartner.status()}`).toBeTruthy()

      orderLineId = await createOrderLineFixture(request, token, orderId, {
        name: `QA PP incentive line ${stamp}`,
        quantity: 1,
        unitPriceNet: 100,
        unitPriceGross: 100,
        currencyCode: 'USD',
      })

      const accrue = await apiRequest(request, 'POST', '/api/partner_programs/incentives/accrue', {
        token,
        data: { orderId },
      })
      expect(accrue.ok(), `accrue: ${accrue.status()} ${JSON.stringify(await readJsonSafe(accrue))}`).toBeTruthy()
      const accrueBody = await readJsonSafe<JsonRecord>(accrue)
      expect(accrueBody?.skipped).toBe(false)
      expect(Number(accrueBody?.amount)).toBeCloseTo(10, 4)

      const accrueAgain = await apiRequest(request, 'POST', '/api/partner_programs/incentives/accrue', {
        token,
        data: { orderId },
      })
      expect(accrueAgain.ok()).toBeTruthy()
      const againBody = await readJsonSafe<JsonRecord>(accrueAgain)
      expect(againBody?.skipped).toBe(true)
      expect(againBody?.reason).toBe('already_accrued')

      const ledger = await apiRequest(
        request,
        'GET',
        `/api/partner_programs/incentives?customerEntityId=${encodeURIComponent(partnerCompanyId!)}`,
        { token },
      )
      expect(ledger.ok()).toBeTruthy()
      const ledgerBody = await readJsonSafe<JsonRecord>(ledger)
      const items = Array.isArray(ledgerBody?.items) ? (ledgerBody.items as JsonRecord[]) : []
      expect(items.some((row) => row.kind === 'accrual' && row.salesOrderId === orderId)).toBe(true)

      const balance = await apiRequest(
        request,
        'GET',
        `/api/partner_programs/incentives/balance?customerEntityId=${encodeURIComponent(partnerCompanyId!)}`,
        { token },
      )
      expect(balance.ok()).toBeTruthy()
      const balanceBody = await readJsonSafe<JsonRecord>(balance)
      const currencies = Array.isArray(balanceBody?.currencies)
        ? (balanceBody.currencies as JsonRecord[])
        : []
      const usd = currencies.find((row) => row.currencyCode === 'USD')
      expect(usd).toBeTruthy()
      expect(Number(usd?.payable)).toBeCloseTo(10, 4)
      expect(Number(usd?.totalEarned)).toBeCloseTo(10, 4)

      const payout = await apiRequest(request, 'POST', '/api/partner_programs/incentives/payout', {
        token,
        data: { customerEntityId: partnerCompanyId, currencyCode: 'USD' },
      })
      expect(payout.ok(), `payout: ${payout.status()} ${JSON.stringify(await readJsonSafe(payout))}`).toBeTruthy()

      const balanceAfter = await apiRequest(
        request,
        'GET',
        `/api/partner_programs/incentives/balance?customerEntityId=${encodeURIComponent(partnerCompanyId!)}`,
        { token },
      )
      expect(balanceAfter.ok()).toBeTruthy()
      const afterBody = await readJsonSafe<JsonRecord>(balanceAfter)
      const afterCurrencies = Array.isArray(afterBody?.currencies)
        ? (afterBody.currencies as JsonRecord[])
        : []
      const usdAfter = afterCurrencies.find((row) => row.currencyCode === 'USD')
      expect(Number(usdAfter?.payable ?? 0)).toBeCloseTo(0, 4)
      expect(Number(usdAfter?.totalEarned ?? 0)).toBeCloseTo(10, 4)

      const payoutEmpty = await apiRequest(request, 'POST', '/api/partner_programs/incentives/payout', {
        token,
        data: { customerEntityId: partnerCompanyId, currencyCode: 'USD' },
      })
      expect(payoutEmpty.ok()).toBeFalsy()
      expect(payoutEmpty.status()).toBeGreaterThanOrEqual(400)
    } finally {
      if (token && orderLineId) {
        await deleteSalesEntityIfExists(request, token, '/api/sales/order-lines', orderLineId)
      }
      if (token && orderId) {
        await deleteSalesEntityIfExists(request, token, '/api/sales/orders', orderId)
      }
      if (token && membershipId && programId) {
        await apiRequest(
          request,
          'DELETE',
          `/api/partner_programs/programs/${programId}/memberships?id=${encodeURIComponent(membershipId)}`,
          { token },
        )
      }
      if (token && programId) {
        await apiRequest(request, 'DELETE', '/api/partner_programs/programs', {
          token,
          data: { id: programId },
        })
      }
      await deleteEntityIfExists(request, token, '/api/customers/companies', partnerCompanyId)
    }
  })

  test('lists memberships by customerEntityId', async ({ request }) => {
    let token: string | null = null
    let programId: string | null = null
    let partnerCompanyId: string | null = null
    let membershipId: string | null = null

    try {
      token = await getAuthToken(request)
      const stamp = Date.now()
      const createProgram = await apiRequest(request, 'POST', '/api/partner_programs/programs', {
        token,
        data: { name: `QA PP mem-by-cust ${stamp}`, incentivePercent: 4 },
      })
      expect(createProgram.ok()).toBeTruthy()
      const programBody = await readJsonSafe<JsonRecord>(createProgram)
      programId = typeof programBody?.id === 'string' ? programBody.id : null
      partnerCompanyId = await createPartnerCompany(request, token!, `QA PP mem-by-cust co ${stamp}`)

      const addMem = await apiRequest(
        request,
        'POST',
        `/api/partner_programs/programs/${programId}/memberships`,
        { token, data: { customerEntityId: partnerCompanyId } },
      )
      expect(addMem.ok()).toBeTruthy()
      const memBody = await readJsonSafe<JsonRecord>(addMem)
      membershipId = typeof memBody?.id === 'string' ? memBody.id : null

      const list = await apiRequest(
        request,
        'GET',
        `/api/partner_programs/memberships?customerEntityId=${encodeURIComponent(partnerCompanyId!)}`,
        { token },
      )
      expect(list.ok()).toBeTruthy()
      const listBody = await readJsonSafe<JsonRecord>(list)
      const items = Array.isArray(listBody?.items) ? (listBody.items as JsonRecord[]) : []
      expect(items.some((row) => row.programId === programId)).toBe(true)
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
        await apiRequest(request, 'DELETE', '/api/partner_programs/programs', {
          token,
          data: { id: programId },
        })
      }
      await deleteEntityIfExists(request, token, '/api/customers/companies', partnerCompanyId)
    }
  })
})
