import { defineLink } from '@open-mercato/shared/modules/dsl'
import type { EntityExtension } from '@open-mercato/shared/modules/entities'
import { E } from '#generated/entities.ids.generated'

export const extensions: EntityExtension[] = [
  defineLink(E.catalog.catalog_product, E.catalog.catalog_product_service_line_extension, {
    join: { baseKey: 'id', extensionKey: 'product_id' },
    cardinality: 'one-to-one',
    required: false,
    description:
      'Optional business classification: links a catalog product to a tenant-defined service line.',
  }),
]

export default extensions
