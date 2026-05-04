import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { E } from '#generated/entities.ids.generated'

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: E.cases.service_case,
      enabled: true,
      priority: 30,
      buildSource: async (ctx) => {
        const { t } = await resolveTranslations()
        const title = String(ctx.record.title ?? '').trim()
        const status = String(ctx.record.status_value ?? ctx.record.statusValue ?? '').trim()
        const lines = [title, status].filter(Boolean)
        if (!lines.length) return null
        return {
          text: lines,
          presenter: {
            title: title || String(ctx.record.id),
            subtitle: status || undefined,
            icon: 'briefcase',
            badge: t('cases.search.badge', 'Case'),
          },
          checksumSource: { record: ctx.record, customFields: ctx.customFields },
        }
      },
      formatResult: async (ctx) => {
        const { t } = await resolveTranslations()
        const title = String(ctx.record.title ?? '').trim()
        const status = String(ctx.record.status_value ?? ctx.record.statusValue ?? '').trim()
        return {
          title: title || String(ctx.record.id),
          subtitle: status || undefined,
          icon: 'briefcase',
          badge: t('cases.search.badge', 'Case'),
        }
      },
      resolveUrl: async (ctx) => `/backend/cases/${encodeURIComponent(String(ctx.record.id))}`,
      fieldPolicy: {
        searchable: ['title', 'status_value'],
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
