import { E } from '#generated/entities.ids.generated'
import * as F from '#generated/entities/dictionary_entry'
import { makeStatusDictionaryRoute } from '../../lib/makeStatusDictionaryRoute'

const route = makeStatusDictionaryRoute({
  kind: 'quote-status',
  entityId: E.dictionaries.dictionary_entry,
  fieldConstants: F,
  openApi: {
    resourceName: 'Quote status',
    pluralName: 'Quote statuses',
    description: 'Manage the lifecycle states available for sales quotes.',
  },
})

export const metadata = route.metadata
export const openApi = route.openApi
export const GET = route.GET
export const POST = route.POST
export const PUT = route.PUT
export const DELETE = route.DELETE
