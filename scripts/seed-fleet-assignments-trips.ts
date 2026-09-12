/**
 * Seed daily assignments covering platform-trip days + future shifts,
 * and a batch of client trips (past with receipt docs + future).
 *
 * Usage:
 *   yarn tsx scripts/seed-fleet-assignments-trips.ts
 */
import { randomUUID } from 'node:crypto'
import { Client } from 'pg'

const TENANT = '76fcb140-7026-487c-98aa-de90539f795c'
const ORG = 'ad539bfb-1847-4801-8937-c42ec76fa94d'
const NOTES = 'Seed: fleet schedule + sample client trips'

type Driver = {
  teamMemberId: string
  name: string
  defaultResourceId: string | null
}

type Car = { id: string; plate: string }

function dateOnlyWarsaw(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function warsawDayStartUtc(dateStr: string, hour = 6, minute = 0): Date {
  // Treat dateStr as Warsaw calendar day; build ISO with +02:00 offset (Aug/Sep 2026 is CEST)
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

async function main(): Promise<void> {
  const c = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/open_mercato' })
  await c.connect()

  const driversRes = await c.query<{
    team_member_id: string
    display_name: string
    default_resource_id: string | null
  }>(`
    SELECT p.team_member_id, m.display_name, p.default_resource_id
    FROM taxi_fleet_driver_profiles p
    JOIN staff_team_members m ON m.id = p.team_member_id
    WHERE p.deleted_at IS NULL
      AND m.deleted_at IS NULL
      AND p.organization_id = $1
      AND m.display_name <> 'Taksówkarz testowy'
    ORDER BY m.display_name
  `, [ORG])

  const drivers: Driver[] = driversRes.rows.map((r) => ({
    teamMemberId: r.team_member_id,
    name: r.display_name,
    defaultResourceId: r.default_resource_id,
  }))

  const carsRes = await c.query<{ id: string; plate: string | null }>(`
    SELECT r.id,
      COALESCE(
        (SELECT v.value_text FROM custom_field_values v
         WHERE v.record_id::text = r.id::text AND v.field_key = 'vehicle_plate' AND v.deleted_at IS NULL
         LIMIT 1),
        r.name
      ) AS plate
    FROM resources_resources r
    WHERE r.deleted_at IS NULL
      AND r.organization_id = $1
      AND r.resource_type_id = 'fea8349b-40c4-49f3-b624-039ed11e8df7'
      AND r.is_active = true
    ORDER BY r.name
  `, [ORG])

  // Include Audi even if type differs
  const audi = await c.query<{ id: string; name: string }>(`
    SELECT id, name FROM resources_resources
    WHERE id = 'a325f3ce-0e94-4d74-8de2-43eda48a9c8a' AND deleted_at IS NULL
  `)
  const cars: Car[] = [
    ...carsRes.rows.map((r) => ({ id: r.id, plate: r.plate || r.id.slice(0, 8) })),
    ...audi.rows.map((r) => ({ id: r.id, plate: 'KWI50898' })),
  ]
  const carIds = [...new Set(cars.map((x) => x.id))]
  const carPool = carIds

  const people = await c.query<{ id: string }>(`
    SELECT id FROM customer_people WHERE organization_id = $1 LIMIT 20
  `, [ORG])
  if (!people.rows.length) throw new Error('No customer people found for org')

  const platformDays = await c.query<{
    team_member_id: string
    day: string
    resource_id: string | null
  }>(`
    SELECT DISTINCT ON (team_member_id, day)
           team_member_id,
           to_char((started_at AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS day,
           resource_id
    FROM taxi_fleet_trips
    WHERE deleted_at IS NULL
      AND platform IS NOT NULL
      AND team_member_id IS NOT NULL
      AND organization_id = $1
    ORDER BY team_member_id, day, resource_id NULLS LAST
  `, [ORG])

  const today = dateOnlyWarsaw(new Date())
  const futureFrom = today
  const futureTo = addDays(today, 10)
  const futureDays = eachDayInclusive(futureFrom, futureTo)

  // resource/day occupancy for uniqueness
  const occupiedResourceDay = new Set<string>()
  const occupiedMemberDay = new Set<string>()

  const existingAsg = await c.query<{
    team_member_id: string
    resource_id: string
    assignment_date: string
  }>(`
    SELECT team_member_id, resource_id, to_char(assignment_date, 'YYYY-MM-DD') AS assignment_date
    FROM taxi_fleet_daily_assignments
    WHERE deleted_at IS NULL AND organization_id = $1
  `, [ORG])
  for (const row of existingAsg.rows) {
    occupiedMemberDay.add(`${row.team_member_id}|${row.assignment_date}`)
    occupiedResourceDay.add(`${row.resource_id}|${row.assignment_date}`)
  }

  function pickResource(preferred: string | null, day: string, driverIndex: number): string | null {
    const candidates = [
      ...(preferred ? [preferred] : []),
      ...carPool.filter((id) => id !== preferred),
    ]
    // rotate by driver index for fairness
    const rotated = [
      ...candidates.slice(driverIndex % candidates.length),
      ...candidates.slice(0, driverIndex % candidates.length),
    ]
    for (const id of rotated) {
      if (!occupiedResourceDay.has(`${id}|${day}`)) return id
    }
    return null
  }

  await c.query('BEGIN')
  try {
    const createdAssignments: Array<{
      id: string
      teamMemberId: string
      resourceId: string
      day: string
      status: string
    }> = []

    // 1) Assignments for platform trip days
    let di = 0
    for (const driver of drivers) {
      const days = platformDays.rows
        .filter((r) => r.team_member_id === driver.teamMemberId)
        .map((r) => ({ day: r.day, resourceId: r.resource_id }))
      for (const { day, resourceId } of days) {
        if (occupiedMemberDay.has(`${driver.teamMemberId}|${day}`)) continue
        const resource = pickResource(resourceId || driver.defaultResourceId, day, di)
        if (!resource) continue
        const id = randomUUID()
        const past = day < today
        const status = past ? 'completed' : 'confirmed'
        const shiftStart = warsawDayStartUtc(day, 6, 0)
        const shiftEnd = warsawDayStartUtc(day, 22, 0)
        await c.query(
          `INSERT INTO taxi_fleet_daily_assignments
            (id, tenant_id, organization_id, team_member_id, resource_id, assignment_date,
             shift_start, shift_end, status, notes, created_at, updated_at, deleted_at)
           VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,NOW(),NOW(),NULL)`,
          [id, TENANT, ORG, driver.teamMemberId, resource, day, shiftStart, shiftEnd, status, NOTES],
        )
        occupiedMemberDay.add(`${driver.teamMemberId}|${day}`)
        occupiedResourceDay.add(`${resource}|${day}`)
        createdAssignments.push({ id, teamMemberId: driver.teamMemberId, resourceId: resource, day, status })
      }
      di++
    }

    // 2) Future assignments for all drivers (every other day staggered)
    di = 0
    for (const driver of drivers) {
      for (let i = 0; i < futureDays.length; i++) {
        // stagger: driver takes ~half of future days
        if ((i + di) % 2 === 1) continue
        const day = futureDays[i]!
        if (occupiedMemberDay.has(`${driver.teamMemberId}|${day}`)) continue
        const resource = pickResource(driver.defaultResourceId, day, di)
        if (!resource) continue
        const id = randomUUID()
        const status = day === today ? 'confirmed' : 'planned'
        const shiftStart = warsawDayStartUtc(day, 7, 0)
        const shiftEnd = warsawDayStartUtc(day, 19, 0)
        await c.query(
          `INSERT INTO taxi_fleet_daily_assignments
            (id, tenant_id, organization_id, team_member_id, resource_id, assignment_date,
             shift_start, shift_end, status, notes, created_at, updated_at, deleted_at)
           VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,NOW(),NOW(),NULL)`,
          [id, TENANT, ORG, driver.teamMemberId, resource, day, shiftStart, shiftEnd, status, NOTES],
        )
        occupiedMemberDay.add(`${driver.teamMemberId}|${day}`)
        occupiedResourceDay.add(`${resource}|${day}`)
        createdAssignments.push({ id, teamMemberId: driver.teamMemberId, resourceId: resource, day, status })
      }
      di++
    }

    // 3) Link platform trips to matching assignments
    const link = await c.query(`
      UPDATE taxi_fleet_trips t
      SET assignment_id = a.id,
          resource_id = COALESCE(t.resource_id, a.resource_id),
          updated_at = NOW()
      FROM taxi_fleet_daily_assignments a
      WHERE t.deleted_at IS NULL
        AND a.deleted_at IS NULL
        AND t.organization_id = $1
        AND a.organization_id = $1
        AND t.team_member_id = a.team_member_id
        AND t.platform IS NOT NULL
        AND t.assignment_id IS NULL
        AND to_char((t.started_at AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD')
            = to_char(a.assignment_date, 'YYYY-MM-DD')
      RETURNING t.id
    `, [ORG])

    // Build lookup assignment by member+day for client trips
    const asgByKey = new Map<string, { id: string; resourceId: string }>()
    const allAsg = await c.query<{
      id: string
      team_member_id: string
      resource_id: string
      day: string
    }>(`
      SELECT id, team_member_id, resource_id, to_char(assignment_date, 'YYYY-MM-DD') AS day
      FROM taxi_fleet_daily_assignments
      WHERE deleted_at IS NULL AND organization_id = $1
    `, [ORG])
    for (const row of allAsg.rows) {
      asgByKey.set(`${row.team_member_id}|${row.day}`, { id: row.id, resourceId: row.resource_id })
    }

    // 4) Client trips — past with docs + future
    const routes = [
      { from: 'Kraków Główny', to: 'Lotnisko Kraków-Balice' },
      { from: 'Rynek Główny, Kraków', to: 'Kazimierz, Kraków' },
      { from: 'Bonarka City Center', to: 'Zakopane' },
      { from: 'Nowa Huta', to: 'Stare Miasto, Kraków' },
      { from: 'Wieliczka', to: 'Kraków Arena' },
      { from: 'Bronowice', to: 'Podgórze' },
    ]

    const pastTripDays = eachDayInclusive(addDays(today, -12), addDays(today, -1))
    const createdTrips: Array<{ id: string; when: string; status: string; doc?: string }> = []
    let tripCounter = 0

    // ~3 past trips per driver with documents (completed)
    for (const driver of drivers) {
      for (let n = 0; n < 3; n++) {
        const day = pastTripDays[(di + n * 3 + tripCounter) % pastTripDays.length]!
        const asg = asgByKey.get(`${driver.teamMemberId}|${day}`)
        // create assignment on the fly if missing for past trip day
        let assignmentId = asg?.id ?? null
        let resourceId = asg?.resourceId ?? driver.defaultResourceId
        if (!assignmentId) {
          resourceId = pickResource(driver.defaultResourceId, day, tripCounter)
          if (!resourceId) continue
          assignmentId = randomUUID()
          await c.query(
            `INSERT INTO taxi_fleet_daily_assignments
              (id, tenant_id, organization_id, team_member_id, resource_id, assignment_date,
               shift_start, shift_end, status, notes, created_at, updated_at, deleted_at)
             VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,'completed',$9,NOW(),NOW(),NULL)
             ON CONFLICT DO NOTHING`,
            [
              assignmentId,
              TENANT,
              ORG,
              driver.teamMemberId,
              resourceId,
              day,
              warsawDayStartUtc(day, 6, 0),
              warsawDayStartUtc(day, 22, 0),
              NOTES,
            ],
          )
          occupiedMemberDay.add(`${driver.teamMemberId}|${day}`)
          occupiedResourceDay.add(`${resourceId}|${day}`)
          asgByKey.set(`${driver.teamMemberId}|${day}`, { id: assignmentId, resourceId })
        }
        if (!resourceId) continue

        const hour = 9 + n * 3
        const startedAt = warsawDayStartUtc(day, hour, 15)
        const endedAt = warsawDayStartUtc(day, hour + 1, 5)
        const route = routes[tripCounter % routes.length]!
        const revenue = (45 + (tripCounter % 20) * 7.5).toFixed(2)
        const distance = (8 + (tripCounter % 15) * 1.4).toFixed(2)
        const docNumber = `FV/${day.replace(/-/g, '')}/${1000 + tripCounter}`
        const customerPersonId = people.rows[tripCounter % people.rows.length]!.id
        const tripId = randomUUID()
        const metadata = {
          serviceType: 'local',
          receiptDocumentNumber: docNumber,
          tripRequest: {
            fromAddress: route.from,
            toAddress: route.to,
            paymentType: tripCounter % 2 === 0 ? 'cash' : 'transfer',
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
            driver.teamMemberId,
            resourceId,
            assignmentId,
            startedAt,
            endedAt,
            distance,
            revenue,
            customerPersonId,
            `Seed past trip with receipt ${docNumber}`,
            JSON.stringify(metadata),
          ],
        )
        // income financial entry with document number
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
            driver.teamMemberId,
            tripId,
            customerPersonId,
            revenue,
            docNumber,
            startedAt,
            'Seed income from past client trip',
          ],
        )
        createdTrips.push({ id: tripId, when: 'past', status: 'completed', doc: docNumber })
        tripCounter++
      }
    }

    // ~2 future trips per driver
    const futureStatuses = ['scheduled', 'approved', 'new', 'paid'] as const
    for (const driver of drivers) {
      for (let n = 0; n < 2; n++) {
        const day = futureDays[(di + n * 2 + tripCounter) % futureDays.length]!
        const asg = asgByKey.get(`${driver.teamMemberId}|${day}`)
        let assignmentId = asg?.id ?? null
        let resourceId = asg?.resourceId ?? driver.defaultResourceId
        if (!assignmentId) {
          resourceId = pickResource(driver.defaultResourceId, day, tripCounter)
          if (!resourceId) continue
          assignmentId = randomUUID()
          await c.query(
            `INSERT INTO taxi_fleet_daily_assignments
              (id, tenant_id, organization_id, team_member_id, resource_id, assignment_date,
               shift_start, shift_end, status, notes, created_at, updated_at, deleted_at)
             VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,'planned',$9,NOW(),NOW(),NULL)
             ON CONFLICT DO NOTHING`,
            [
              assignmentId,
              TENANT,
              ORG,
              driver.teamMemberId,
              resourceId,
              day,
              warsawDayStartUtc(day, 7, 0),
              warsawDayStartUtc(day, 19, 0),
              NOTES,
            ],
          )
          occupiedMemberDay.add(`${driver.teamMemberId}|${day}`)
          occupiedResourceDay.add(`${resourceId}|${day}`)
          asgByKey.set(`${driver.teamMemberId}|${day}`, { id: assignmentId, resourceId })
        }
        if (!resourceId) continue

        const hour = 10 + n * 4
        const startedAt = warsawDayStartUtc(day, hour, 0)
        const endedAt = warsawDayStartUtc(day, hour + 1, 20)
        const route = routes[tripCounter % routes.length]!
        const revenue = (60 + (tripCounter % 12) * 10).toFixed(2)
        const distance = (12 + (tripCounter % 10) * 2.2).toFixed(2)
        const customerPersonId = people.rows[tripCounter % people.rows.length]!.id
        const status = futureStatuses[tripCounter % futureStatuses.length]!
        const tripId = randomUUID()
        const metadata = {
          serviceType: route.to.includes('Balice') || route.to.includes('Zakopane') ? 'airport' : 'local',
          tripRequest: {
            fromAddress: route.from,
            toAddress: route.to,
            paymentType: 'transfer',
            passengers: 2,
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
                   $12,$13,$14::jsonb,NOW(),NOW(),NULL)`,
          [
            tripId,
            TENANT,
            ORG,
            driver.teamMemberId,
            resourceId,
            assignmentId,
            startedAt,
            endedAt,
            distance,
            revenue,
            customerPersonId,
            status,
            `Seed future trip (${status})`,
            JSON.stringify(metadata),
          ],
        )
        createdTrips.push({ id: tripId, when: 'future', status })
        tripCounter++
      }
    }

    await c.query('COMMIT')

    const asgCount = await c.query(
      `SELECT COUNT(*)::int AS n FROM taxi_fleet_daily_assignments WHERE deleted_at IS NULL AND notes = $1`,
      [NOTES],
    )
    const tripCount = await c.query(
      `SELECT COUNT(*)::int AS n FROM taxi_fleet_trips WHERE deleted_at IS NULL AND notes LIKE 'Seed %'`,
    )
    const linkedPlatform = await c.query(`
      SELECT COUNT(*)::int AS n FROM taxi_fleet_trips
      WHERE deleted_at IS NULL AND platform IS NOT NULL AND assignment_id IS NOT NULL
    `)

    console.log(
      JSON.stringify(
        {
          drivers: drivers.length,
          createdAssignments: createdAssignments.length,
          seedAssignmentsInDb: asgCount.rows[0]?.n,
          createdClientTrips: createdTrips.length,
          pastWithDocs: createdTrips.filter((t) => t.when === 'past').length,
          future: createdTrips.filter((t) => t.when === 'future').length,
          platformTripsLinkedToAssignments: linkedPlatform.rows[0]?.n,
          seedTripsInDb: tripCount.rows[0]?.n,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    await c.query('ROLLBACK')
    throw error
  } finally {
    await c.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
