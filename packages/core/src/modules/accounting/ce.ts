import type { CustomEntitySpec } from '@open-mercato/shared/modules/entities'
import { ACCOUNTING_INVOICE_ENTITY_ID } from './lib/constants'

const systemEntities: CustomEntitySpec[] = [
  {
    id: ACCOUNTING_INVOICE_ENTITY_ID,
    label: 'Accounting invoice',
    description: 'Issued and imported accounting invoice registry.',
    labelField: 'documentNumber',
    showInSidebar: false,
    fields: [],
  },
]

export const entities = systemEntities
export default systemEntities
