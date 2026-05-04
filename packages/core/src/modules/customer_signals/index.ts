import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'customer_signals',
  title: 'Customer signals',
  version: '0.1.0',
  description: 'Append-only behavioral signals for CRM entities.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['customers'],
}

export { features } from './acl'
