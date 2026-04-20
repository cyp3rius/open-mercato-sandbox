import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'catalog' && def.entityType === 'product') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const previews = await import('./lib/messageObjectPreviews')
        const productLoader = (
          previews as typeof previews & {
            loadCatalogProductPreview?: (id: string, previewCtx: typeof ctx) => Promise<{ title: string; subtitle?: string }>
          }
        ).loadCatalogProductPreview
        if (productLoader) return productLoader(entityId, ctx)
        return previews.loadCatalogCategoryPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'catalog' && def.entityType === 'variant') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const previews = await import('./lib/messageObjectPreviews')
        const variantLoader = (
          previews as typeof previews & {
            loadCatalogVariantPreview?: (id: string, previewCtx: typeof ctx) => Promise<{ title: string; subtitle?: string }>
          }
        ).loadCatalogVariantPreview
        if (variantLoader) return variantLoader(entityId, ctx)
        return previews.loadCatalogProductPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'catalog' && def.entityType === 'category') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadCatalogCategoryPreview } = await import('./lib/messageObjectPreviews')
        return loadCatalogCategoryPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
