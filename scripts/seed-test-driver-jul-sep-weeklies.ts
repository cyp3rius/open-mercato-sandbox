/**
 * Seed Jul–Sep 2026 trips/expenses for "Taksówkarz testowy" and generate weekly settlements
 * for all Mondays in July + August and the first Monday of September.
 *
 * Usage (from repo root):
 *   yarn tsx scripts/seed-test-driver-jul-sep-weeklies.ts
 */
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const TENANT = '76fcb140-7026-487c-98aa-de90539f795c'
const ORG = 'ad539bfb-1847-4801-8937-c42ec76fa94d'
const DRIVER_NAME = 'Taksówkarz testowy'
const NOTES = 'Seed: test driver Jul–Sep 2026'

function dateOnlyWarsaw(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function warsawDayStartUtc(dateStr: string, hour = 10, minute = 0): Date {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return new Date(`${dateStr}T${hh}:${mm}:00+02:00`)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00+02:00`)
  d.setUTCDate(d.getUTCDate() + days)
  return dateOnlyWarsaw(d)
}

function eachDayInclusive(from: string, to: string): string[] {
  const out: string[] = []
  let cur = from
  while (cur <= to) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

function getIsoWeekStart(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  return monday.toISOString().slice(0, 10)
}

/** Mondays covering July + August 2026 days, plus first Monday of September. */
function targetWeekStarts(): string[] {
  const mondays: string[] = []
  // Week covering Jul 1–5 (Mon Jun 29)
  let cursor = '2026-06-29'
  while (cursor <= '2026-08-31') {
    mondays.push(cursor)
    cursor = addDays(cursor, 7)
  }
  // First Monday in September 2026 (Sep 7–13)
  mondays.push('2026-09-07')
  return mondays
}

async function main(): Promise<void> {
  const c = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/open_mercato' })
  await c.connect()

  const driverRes = await c.query<{
    team_member_id: string
    default_resource_id: string | null
  }>(
    `
    SELECT p.team_member_id, p.default_resource_id
    FROM taxi_fleet_driver_profiles p
    JOIN staff_team_members m ON m.id = p.team_member_id
    WHERE p.deleted_at IS NULL
      AND m.deleted_at IS NULL
      AND p.organization_id = $1
      AND m.display_name = $2
    LIMIT 1
  `,
    [ORG, DRIVER_NAME],
  )
  if (!driverRes.rows[0]) {
    throw new Error(`Driver "${DRIVER_NAME}" not found`)
  }
  const teamMemberId = driverRes.rows[0].team_member_id
  let resourceId = driverRes.rows[0].default_resource_id

  if (!resourceId) {
    const car = await c.query<{ id: string }>(
      `
      SELECT r.id FROM resources_resources r
      WHERE r.deleted_at IS NULL AND r.organization_id = $1 AND r.is_active = true
      LIMIT 1
    `,
      [ORG],
    )
    resourceId = car.rows[0]?.id ?? null
  }
  if (!resourceId) throw new Error('No resource/vehicle available for assignments')

  const people = await c.query<{ id: string }>(
    `SELECT id FROM customer_people WHERE organization_id = $1 LIMIT 20`,
    [ORG],
  )
  if (!people.rows.length) throw new Error('No customer people found')

  // Soft-delete prior seed rows for this driver in the window (idempotent re-run)
  await c.query(
    `
    UPDATE taxi_fleet_trips
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE organization_id = $1
      AND team_member_id = $2
      AND deleted_at IS NULL
      AND notes LIKE $3
      AND started_at >= $4
      AND started_at < $5
  `,
    [ORG, teamMemberId, `${NOTES}%`, warsawDayStartUtc('2026-07-01', 0), warsawDayStartUtc('2026-10-01', 0)],
  )
  await c.query(
    `
    UPDATE taxi_fleet_financial_entries
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE organization_id = $1
      AND team_member_id = $2
      AND deleted_at IS NULL
      AND notes LIKE $3
      AND occurred_at >= $4
      AND occurred_at < $5
  `,
    [ORG, teamMemberId, `${NOTES}%`, warsawDayStartUtc('2026-07-01', 0), warsawDayStartUtc('2026-10-01', 0)],
  )

  const days = eachDayInclusive('2026-07-01', '2026-09-30')
  const routes = [
    { from: 'Kraków Główny', to: 'Lotnisko Kraków-Balice' },
    { from: 'Rynek Główny', to: 'Kazimierz' },
    { from: 'Bonarka', to: 'Nowa Huta' },
    { from: 'Bronowice', to: 'Podgórze' },
  ]
  const platforms = ['uber', 'bolt', 'free'] as const

  let tripCounter = 0
  let createdClient = 0
  let createdPlatform = 0
  let createdExpenses = 0

  for (const day of days) {
    // Assignment: unique is (tenant, org, resource, date) — reuse if present for this driver or free resource day
    const existingAsg = await c.query<{ id: string; resource_id: string }>(
      `
      SELECT id, resource_id FROM taxi_fleet_daily_assignments
      WHERE deleted_at IS NULL
        AND organization_id = $1
        AND team_member_id = $2
        AND assignment_date = $3::date
      LIMIT 1
    `,
      [ORG, teamMemberId, day],
    )
    let assignmentId = existingAsg.rows[0]?.id ?? null
    let dayResourceId = existingAsg.rows[0]?.resource_id ?? resourceId
    if (!assignmentId) {
      // Prefer default resource if free that day; otherwise any free car
      const busy = await c.query<{ resource_id: string }>(
        `
        SELECT resource_id FROM taxi_fleet_daily_assignments
        WHERE deleted_at IS NULL AND organization_id = $1 AND assignment_date = $2::date
      `,
        [ORG, day],
      )
      const busyIds = new Set(busy.rows.map((r) => r.resource_id))
      if (busyIds.has(dayResourceId)) {
        const freeCar = await c.query<{ id: string }>(
          `
          SELECT r.id FROM resources_resources r
          WHERE r.deleted_at IS NULL AND r.organization_id = $1 AND r.is_active = true
            AND r.id <> ALL($2::uuid[])
          LIMIT 1
        `,
          [ORG, [...busyIds]],
        )
        dayResourceId = freeCar.rows[0]?.id ?? dayResourceId
      }
      if (!busyIds.has(dayResourceId)) {
        assignmentId = randomUUID()
        await c.query(
          `INSERT INTO taxi_fleet_daily_assignments
            (id, tenant_id, organization_id, team_member_id, resource_id, assignment_date,
             shift_start, shift_end, status, notes, created_at, updated_at, deleted_at)
           VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,'completed',$9,NOW(),NOW(),NULL)`,
          [
            assignmentId,
            TENANT,
            ORG,
            teamMemberId,
            dayResourceId,
            day,
            warsawDayStartUtc(day, 6, 0),
            warsawDayStartUtc(day, 22, 0),
            NOTES,
          ],
        )
      } else {
        // No free car — trips without assignment link
        assignmentId = null
      }
    }

    // ~2 client (cash/card) trips every weekday-ish day (skip some Sundays lightly)
    const dayOfWeek = new Date(`${day}T12:00:00`).getDay()
    const clientTripsToday = dayOfWeek === 0 ? 1 : 2
    for (let n = 0; n < clientTripsToday; n++) {
      const hour = 9 + n * 4
      const startedAt = warsawDayStartUtc(day, hour, 10)
      const endedAt = warsawDayStartUtc(day, hour + 1, 0)
      const route = routes[tripCounter % routes.length]!
      const revenue = (55 + (tripCounter % 12) * 8.5).toFixed(2)
      const distance = (6 + (tripCounter % 10) * 1.3).toFixed(2)
      const docNumber = `SEED/${day.replace(/-/g, '')}/${1000 + tripCounter}`
      const customerPersonId = people.rows[tripCounter % people.rows.length]!.id
      const tripId = randomUUID()
      const paymentType = tripCounter % 3 === 0 ? 'card' : 'cash'
      const metadata = {
        serviceType: 'local',
        receiptDocumentNumber: docNumber,
        tripRequest: {
          fromAddress: route.from,
          toAddress: route.to,
          paymentType,
          passengers: 1 + (tripCounter % 3),
          distanceKm: distance,
        },
      }
      await c.query(
        `INSERT INTO taxi_fleet_trips
          (id, tenant_id, organization_id, team_member_id, resource_id, assignment_id,
           trip_type, platform, external_trip_id, started_at, ended_at, distance_km,
           revenue_amount, currency_code, customer_person_id, customer_company_id,
           status, notes, metadata, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,'client',NULL,NULL,$7,$8,$9,$10,'PLN',$11,NULL,
                 'completed',$12,$13::jsonb,NOW(),NOW(),NULL)`,
        [
          tripId,
          TENANT,
          ORG,
          teamMemberId,
          dayResourceId,
          assignmentId,
          startedAt,
          endedAt,
          distance,
          revenue,
          customerPersonId,
          `${NOTES} client`,
          JSON.stringify(metadata),
        ],
      )
      await c.query(
        `INSERT INTO taxi_fleet_financial_entries
          (id, tenant_id, organization_id, team_member_id, kind, income_document_type, cost_type,
           trip_id, customer_person_id, customer_company_id, amount, vat_rate_percent, currency_code,
           document_number, occurred_at, receipt_attachment_id, notes, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,'income','receipt',NULL,$5,$6,NULL,$7,'23','PLN',$8,$9,NULL,$10,NOW(),NOW(),NULL)`,
        [
          randomUUID(),
          TENANT,
          ORG,
          teamMemberId,
          tripId,
          customerPersonId,
          revenue,
          docNumber,
          startedAt,
          `${NOTES} income`,
        ],
      )
      createdClient++
      tripCounter++
    }

    // 1 platform trip most days (for weekly platform revenue)
    if (dayOfWeek !== 0 || tripCounter % 2 === 0) {
      const platform = platforms[tripCounter % platforms.length]!
      const hour = 14
      const startedAt = warsawDayStartUtc(day, hour, 30)
      const endedAt = warsawDayStartUtc(day, hour + 1, 15)
      const revenue = (70 + (tripCounter % 15) * 6).toFixed(2)
      const distance = (9 + (tripCounter % 8) * 1.1).toFixed(2)
      const tripId = randomUUID()
      const paymentType = platform === 'uber' && tripCounter % 5 === 0 ? 'cash' : 'electronic'
      const metadata = {
        tripRequest: { paymentType },
        platformImport: true,
      }
      await c.query(
        `INSERT INTO taxi_fleet_trips
          (id, tenant_id, organization_id, team_member_id, resource_id, assignment_id,
           trip_type, platform, external_trip_id, started_at, ended_at, distance_km,
           revenue_amount, currency_code, customer_person_id, customer_company_id,
           status, notes, metadata, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,$5,$6,'platform',$7,$8,$9,$10,$11,$12,'PLN',NULL,NULL,
                 'completed',$13,$14::jsonb,NOW(),NOW(),NULL)`,
        [
          tripId,
          TENANT,
          ORG,
          teamMemberId,
          dayResourceId,
          assignmentId,
          platform,
          `seed-${platform}-${day}-${tripCounter}`,
          startedAt,
          endedAt,
          distance,
          revenue,
          `${NOTES} platform ${platform}`,
          JSON.stringify(metadata),
        ],
      )
      createdPlatform++
      tripCounter++
    }

    // Expense every 2–3 days
    if (tripCounter % 3 === 0) {
      const costTypes = ['fuel', 'toll', 'parking', 'other'] as const
      const costType = costTypes[tripCounter % costTypes.length]!
      const amount = (35 + (tripCounter % 7) * 12).toFixed(2)
      await c.query(
        `INSERT INTO taxi_fleet_financial_entries
          (id, tenant_id, organization_id, team_member_id, kind, income_document_type, cost_type,
           trip_id, customer_person_id, customer_company_id, amount, vat_rate_percent, currency_code,
           document_number, occurred_at, receipt_attachment_id, notes, created_at, updated_at, deleted_at)
         VALUES ($1,$2,$3,$4,'expense',NULL,$5,NULL,NULL,NULL,$6,'23','PLN',$7,$8,NULL,$9,NOW(),NOW(),NULL)`,
        [
          randomUUID(),
          TENANT,
          ORG,
          teamMemberId,
          costType,
          amount,
          `KOSZT/${day.replace(/-/g, '')}/${tripCounter}`,
          warsawDayStartUtc(day, 18, 0),
          `${NOTES} expense ${costType}`,
        ],
      )
      createdExpenses++
    }
  }

  // Soft-delete existing weeklies for these weeks before generating
  const weekStarts = targetWeekStarts()
  await c.query(
    `
    UPDATE taxi_fleet_weekly_settlements
    SET deleted_at = NOW(), updated_at = NOW()
    WHERE organization_id = $1
      AND team_member_id = $2
      AND week_start = ANY($3::date[])
      AND deleted_at IS NULL
  `,
    [ORG, teamMemberId, weekStarts],
  )

  console.log(
    JSON.stringify(
      {
        driver: DRIVER_NAME,
        teamMemberId,
        createdClient,
        createdPlatform,
        createdExpenses,
        dayRange: '2026-07-01 … 2026-09-30',
        weekStarts,
      },
      null,
      2,
    ),
  )

  await c.end()

  // Generate weekly settlements via MikroORM + recalculation (no full Next.js bootstrap)
  console.log('Generating weeklies for', weekStarts)

  const { MikroORM, PostgreSqlDriver } = await import('@mikro-orm/postgresql')
  const TaxiFleetEntities = await import('../apps/mercato/src/modules/taxi_fleet/data/entities')
  const { registerOrmEntities } = await import('@open-mercato/shared/lib/db/mikro')
  const { registerEntityIds } = await import('@open-mercato/shared/lib/encryption/entityIds')
  const { E } = await import('../apps/mercato/.mercato/generated/entities.ids.generated')
  const { applyWeeklySettlementRecalculation, recomputeSettlementTransfer } = await import(
    '../apps/mercato/src/modules/taxi_fleet/lib/settlementRecalculation'
  )
  const { formatDistanceKm } = await import('../apps/mercato/src/modules/taxi_fleet/lib/settlementTripDistance')

  registerEntityIds(E as never)
  const entityList = [
    TaxiFleetEntities.TaxiFleetOrganizationSettings,
    TaxiFleetEntities.TaxiFleetDriverProfile,
    TaxiFleetEntities.TaxiFleetDailyAssignment,
    TaxiFleetEntities.TaxiFleetTrip,
    TaxiFleetEntities.TaxiFleetTripCostLine,
    TaxiFleetEntities.TaxiFleetFinancialEntry,
    TaxiFleetEntities.TaxiFleetWeeklySettlement,
    TaxiFleetEntities.TaxiFleetMonthlySettlement,
    TaxiFleetEntities.TaxiFleetMonthlySettlementDocument,
    TaxiFleetEntities.TaxiFleetLocationPing,
    TaxiFleetEntities.TaxiFleetReceiptExtraction,
    TaxiFleetEntities.TaxiFleetPlatformSyncRun,
  ].filter(Boolean)
  registerOrmEntities(entityList as never)

  const orm = await MikroORM.init({
    driver: PostgreSqlDriver,
    clientUrl: 'postgres://postgres:postgres@localhost:5432/open_mercato',
    entities: entityList as never[],
    allowGlobalContext: true,
  })
  const em = orm.em.fork()

  const { TaxiFleetWeeklySettlement } = TaxiFleetEntities
  const results: Array<{ weekStart: string; id?: string; error?: string }> = []

  for (const weekStart of weekStarts) {
    try {
      const now = new Date()
      const existing = await em.findOne(TaxiFleetWeeklySettlement, {
        tenantId: TENANT,
        organizationId: ORG,
        teamMemberId,
        weekStart,
      } as never)
      let record = existing
      if (record) {
        record.deletedAt = null
        record.status = 'draft'
        record.updatedAt = now
        record.cashCollected = '0'
        record.bonusAmount = '0'
        record.compensationAmount = '0'
        record.airportA4Amount = '0'
      } else {
        record = em.create(TaxiFleetWeeklySettlement, {
          tenantId: TENANT,
          organizationId: ORG,
          teamMemberId,
          weekStart,
          payoutPercent: '0',
          cashCollected: '0',
          bonusAmount: '0',
          compensationAmount: '0',
          airportA4Amount: '0',
          status: 'draft',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        } as never)
        em.persist(record)
      }
      await applyWeeklySettlementRecalculation(em, record, { syncTotalDistance: true })
      record.cashCollected = record.cashExpected
      recomputeSettlementTransfer(record)
      if (!record.computedDistanceKm) record.computedDistanceKm = formatDistanceKm(0)
      await em.flush()
      results.push({ weekStart, id: record.id })
      console.log(
        `OK ${weekStart} → ${record.id} (revNet=${record.revenueNet}, costsNet=${record.costsNet}, payout=${record.payoutAmount})`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      results.push({ weekStart, error: message })
      console.error(`FAIL ${weekStart}:`, message)
      em.clear()
    }
  }

  await orm.close(true)
  console.log(JSON.stringify({ weeklies: results }, null, 2))
  process.exit(results.some((r) => r.error) ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
