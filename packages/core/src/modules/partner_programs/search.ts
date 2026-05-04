import type { SearchModuleConfig } from '@open-mercato/shared/modules/search'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { E } from '#generated/entities.ids.generated'

export const searchConfig: SearchModuleConfig = {
  entities: [
    {
      entityId: E.partner_programs.partner_program,
      enabled: true,
      priority: 25,
      buildSource: async (ctx) => {
        const { t } = await resolveTranslations()
        const name = String(ctx.record.name ?? '').trim()
        const description = String(ctx.record.description ?? '').trim()
        const lines = [name, description].filter(Boolean)
        if (!lines.length) return null
        return {
          text: lines,
          presenter: {
            title: name || (ctx.record.id as string),
            subtitle: description || undefined,
            icon: 'handshake',
            badge: t('partner_programs.search.badge', 'Partner program'),
          },
          checksumSource: { record: ctx.record, customFields: ctx.customFields },
        }
      },
      formatResult: async (ctx) => {
        const { t } = await resolveTranslations()
        const name = String(ctx.record.name ?? '').trim()
        const description = String(ctx.record.description ?? '').trim()
        return {
          title: name || (ctx.record.id as string),
          subtitle: description || undefined,
          icon: 'handshake',
          badge: t('partner_programs.search.badge', 'Partner program'),
        }
      },
      resolveUrl: async (ctx) =>
        `/backend/partner_programs/programs/${encodeURIComponent(String(ctx.record.id))}`,
      fieldPolicy: {
        searchable: ['name', 'description'],
      },
    },
  ],
}

export default searchConfig
export const config = searchConfig
