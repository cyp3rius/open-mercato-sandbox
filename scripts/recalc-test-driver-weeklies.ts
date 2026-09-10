/**
 * Recalculate all weekly settlements for "Taksówkarz testowy".
 *
 * Usage:
 *   yarn tsx --tsconfig apps/mercato/tsconfig.json scripts/recalc-test-driver-weeklies.ts
 */
const TENANT = '76fcb140-7026-487c-98aa-de90539f795c'
const ORG = 'ad539bfb-1847-4801-8937-c42ec76fa94d'
const DRIVER_NAME = 'Taksówkarz testowy'

async function main(): Promise<void> {
  const { Client } = await import('pg')
  const c = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/open_mercato' })
  await c.connect()
  const driverRes = await c.query<{ team_member_id: string }>(
    `
    SELECT p.team_member_id
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
  await c.end()
  if (!driverRes.rows[0]) throw new Error(`Driver "${DRIVER_NAME}" not found`)
  const teamMemberId = driverRes.rows[0].team_member_id

  const { MikroORM, PostgreSqlDriver } = await import('@mikro-orm/postgresql')
  const TaxiFleetEntities = await import('../apps/mercato/src/modules/taxi_fleet/data/entities')
  const { registerOrmEntities } = await import('@open-mercato/shared/lib/db/mikro')
  const { registerEntityIds } = await import('@open-mercato/shared/lib/encryption/entityIds')
  const { E } = await import('../apps/mercato/.mercato/generated/entities.ids.generated')
  const { applyWeeklySettlementRecalculation } = await import(
    '../apps/mercato/src/modules/taxi_fleet/lib/settlementRecalculation'
  )

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
  const rows = await em.find(
    TaxiFleetWeeklySettlement,
    {
      tenantId: TENANT,
      organizationId: ORG,
      teamMemberId,
      deletedAt: null,
    } as never,
    { orderBy: { weekStart: 'asc' } },
  )

  console.log(`Recalculating ${rows.length} weeklies for ${DRIVER_NAME} (${teamMemberId})`)
  const results: Array<{
    weekStart: string
    id: string
    ok: boolean
    revenueNet?: string
    costsNet?: string
    payout?: string
    error?: string
  }> = []

  for (const row of rows) {
    const weekEm = orm.em.fork()
    try {
      const fresh = await weekEm.findOne(TaxiFleetWeeklySettlement, { id: row.id } as never)
      if (!fresh) throw new Error('row missing after fork')
      await applyWeeklySettlementRecalculation(weekEm, fresh, { syncTotalDistance: true })
      await weekEm.flush()
      results.push({
        weekStart: fresh.weekStart,
        id: fresh.id,
        ok: true,
        revenueNet: fresh.revenueNet,
        costsNet: fresh.costsNet,
        payout: fresh.payoutAmount,
      })
      console.log(
        `OK ${fresh.weekStart} revNet=${fresh.revenueNet} costsNet=${fresh.costsNet} payout=${fresh.payoutAmount} cash=${fresh.cashCollected}/${fresh.cashExpected}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : undefined
      results.push({ weekStart: row.weekStart, id: row.id, ok: false, error: message })
      console.error(`FAIL ${row.weekStart}:`, message)
      if (stack) console.error(stack)
    }
  }

  await orm.close(true)
  const failed = results.filter((r) => !r.ok).length
  console.log(JSON.stringify({ recalculated: results.length, failed }, null, 2))
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
