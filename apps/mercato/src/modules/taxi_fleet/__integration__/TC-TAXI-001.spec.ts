import { test, expect } from '@playwright/test'
import { apiRequest, getAuthToken } from '@open-mercato/core/modules/core/__integration__/helpers/api'
import { readJsonSafe } from '@open-mercato/core/modules/core/__integration__/helpers/crmFixtures'

type JsonRecord = Record<string, unknown>

async function createAssignment(
  request: Parameters<typeof apiRequest>[0],
  token: string,
  payload: JsonRecord,
): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const res = await apiRequest(request, 'POST', '/api/taxi_fleet/assignments', { token, data: payload })
  const body = (await readJsonSafe<JsonRecord>(res)) ?? {}
  return { ok: res.ok(), status: res.status(), body }
}

test.describe('TC-TAXI-001: Assignment conflict', () => {
  test('rejects duplicate assignment on same date', async ({ request }) => {
    const token = await getAuthToken(request)
    const date = new Date().toISOString().slice(0, 10)
    const teamMemberId = '00000000-0000-4000-8000-000000000001'
    const resourceA = '00000000-0000-4000-8000-000000000002'
    const resourceB = '00000000-0000-4000-8000-000000000003'

    const first = await createAssignment(request, token, {
      teamMemberId,
      resourceId: resourceA,
      assignmentDate: date,
    })
    if (!first.ok && first.status === 404) {
      test.skip(true, 'Fixture IDs not seeded — run with staff/resources fixtures')
      return
    }

    const second = await createAssignment(request, token, {
      teamMemberId,
      resourceId: resourceB,
      assignmentDate: date,
    })
    expect(second.ok).toBe(false)
    expect(second.status).toBe(409)
  })
})
