import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

const DB_PROBE_TIMEOUT_MS = 12_000

export async function HomeDbStatusSection() {
  const { t } = await resolveTranslations()

  let dbStatus = t('app.page.dbStatus.unknown', 'Unknown')
  let usersCount = 0
  let tenantsCount = 0
  let orgsCount = 0
  let dbProbeTimeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const probeDb = async () => {
      const container = await createRequestContainer()
      const em = container.resolve<EntityManager>('em')
      const [u, te, o] = await Promise.all([
        em.count('User', {}),
        em.count('Tenant', {}),
        em.count('Organization', {}),
      ])
      return { u, te, o }
    }
    const timeout = new Promise<never>((_, reject) => {
      dbProbeTimeoutId = setTimeout(() => {
        reject(
          new Error(
            `Database probe timed out after ${DB_PROBE_TIMEOUT_MS}ms (check PostgreSQL and DATABASE_URL).`,
          ),
        )
      }, DB_PROBE_TIMEOUT_MS)
    })
    const stats = await Promise.race([probeDb(), timeout])
    usersCount = stats.u
    tenantsCount = stats.te
    orgsCount = stats.o
    dbStatus = t('app.page.dbStatus.connected', 'Connected')
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : t('app.page.dbStatus.noConnection', 'no connection')
    dbStatus = t('app.page.dbStatus.error', 'Error: {message}', { message })
  } finally {
    if (dbProbeTimeoutId !== undefined) clearTimeout(dbProbeTimeoutId)
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm font-medium mb-2">{t('app.page.dbStatus.title', 'Database Status')}</div>
      <div className="text-sm text-muted-foreground">
        {t('app.page.dbStatus.label', 'Status:')} <span className="font-medium text-foreground">{dbStatus}</span>
      </div>
      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('app.page.dbStatus.users', 'Users:')}</span>
          <span className="font-mono font-medium">{usersCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('app.page.dbStatus.tenants', 'Tenants:')}</span>
          <span className="font-mono font-medium">{tenantsCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">{t('app.page.dbStatus.organizations', 'Organizations:')}</span>
          <span className="font-mono font-medium">{orgsCount}</span>
        </div>
      </div>
    </div>
  )
}
