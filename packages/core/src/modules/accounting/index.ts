import type { ModuleInfo } from '@open-mercato/shared/modules/registry'
import './commands'

export const metadata: ModuleInfo = {
  name: 'accounting',
  title: 'Accounting',
  version: '0.1.0',
  description: 'Accounting invoice registry for issued and imported invoices.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['attachments', 'currencies'],
  ejectable: true,
}

export { features } from './acl'
