import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { E } from '#generated/entities.ids.generated'

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: E.playbooks.playbook,
      enabled: true,
      priority: 36,
      buildSource: async (ctx) => {
        const { t } = await resolveTranslations()
        const title = String(ctx.record.title ?? '').trim()
        const slug = String(ctx.record.slug ?? '').trim()
        const lines = [title, slug].filter(Boolean)
        if (!lines.length) return null
        return {
          text: lines,
          presenter: {
            title: title || String(ctx.record.id),
            subtitle: slug || undefined,
            icon: 'book-open',
            badge: t('playbooks.search.badge', 'Playbook'),
          },
          checksumSource: { record: ctx.record, customFields: ctx.customFields },
        }
      },
      formatResult: async (ctx) => {
        const { t } = await resolveTranslations()
        const title = String(ctx.record.title ?? '').trim()
        const slug = String(ctx.record.slug ?? '').trim()
        return {
          title: title || String(ctx.record.id),
          subtitle: slug || undefined,
          icon: 'book-open',
          badge: t('playbooks.search.badge', 'Playbook'),
        }
      },
      resolveUrl: async (ctx) => `/backend/playbooks/${encodeURIComponent(String(ctx.record.id))}`,
      fieldPolicy: {
        searchable: ['title', 'slug'],
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
