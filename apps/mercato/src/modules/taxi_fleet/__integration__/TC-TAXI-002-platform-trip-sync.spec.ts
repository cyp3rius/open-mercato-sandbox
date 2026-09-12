import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAuthToken } from '@open-mercato/core/modules/core/__integration__/helpers/api'
import { readJsonSafe } from '@open-mercato/core/modules/core/__integration__/helpers/crmFixtures'

type JsonRecord = Record<string, unknown>

const BASE_URL = process.env.BASE_URL?.trim() || ''
const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../lib/platformSync/fixtures/sample-platform-trips.csv',
)

function resolveUrl(path: string): string {
  return BASE_URL ? `${BASE_URL}${path}` : path
}

async function importPlatformCsv(
  request: Parameters<typeof getAuthToken>[0],
  token: string,
  platform: string,
): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const csv = readFileSync(fixturePath, 'utf8')
  const res = await request.post(resolveUrl('/api/taxi_fleet/platform-sync/import-csv'), {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      platform,
      file: {
        name: 'sample-platform-trips.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csv, 'utf8'),
      },
    },
  })
  const body = (await readJsonSafe<JsonRecord>(res)) ?? {}
  return { ok: res.ok(), status: res.status(), body }
}

test.describe('TC-TAXI-002: Platform trip CSV import', () => {
  test('imports CSV and is idempotent on second import', async ({ request }) => {
    const token = await getAuthToken(request)
    const first = await importPlatformCsv(request, token, 'bolt')
    if (!first.ok && first.status === 404) {
      test.skip(true, 'Platform sync API not available in this environment')
      return
    }
    expect(first.ok).toBe(true)
    expect(typeof first.body.runId).toBe('string')

    const tripsRes = await request.get(resolveUrl('/api/taxi_fleet/trips?page=1&pageSize=100'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const tripsBody = (await readJsonSafe<JsonRecord>(tripsRes)) ?? {}
    const items = Array.isArray(tripsBody.items) ? tripsBody.items : []
    const platformTrips = items.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as JsonRecord).externalTripId === 'bolt-trip-001',
    )
    expect(platformTrips.length).toBeGreaterThanOrEqual(1)

    const second = await importPlatformCsv(request, token, 'bolt')
    expect(second.ok).toBe(true)

    const tripsAfter = await request.get(resolveUrl('/api/taxi_fleet/trips?page=1&pageSize=200'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const afterBody = (await readJsonSafe<JsonRecord>(tripsAfter)) ?? {}
    const afterItems = Array.isArray(afterBody.items) ? afterBody.items : []
    const matching = afterItems.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as JsonRecord).externalTripId === 'bolt-trip-001',
    )
    expect(matching.length).toBe(1)
  })

  test('driver PUT on platform trip returns 403', async ({ request }) => {
    const token = await getAuthToken(request)
    const tripsRes = await request.get(resolveUrl('/api/taxi_fleet/trips?page=1&pageSize=100'), {
      headers: { Authorization: `Bearer ${token}` },
    })
    const tripsBody = (await readJsonSafe<JsonRecord>(tripsRes)) ?? {}
    const items = Array.isArray(tripsBody.items) ? tripsBody.items : []
    const platformTrip = items.find(
      (item) =>
        item &&
        typeof item === 'object' &&
        (item as JsonRecord).metadata &&
        typeof (item as JsonRecord).metadata === 'object' &&
        ((item as JsonRecord).metadata as JsonRecord).ingestSource,
    ) as JsonRecord | undefined
    if (!platformTrip || typeof platformTrip.id !== 'string') {
      test.skip(true, 'No platform-ingested trip in dataset')
      return
    }

    const res = await request.put(resolveUrl('/api/taxi_fleet/driver/trips'), {
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      data: { id: platformTrip.id, status: 'completed' },
    })
    expect([403, 401]).toContain(res.status())
  })
})
