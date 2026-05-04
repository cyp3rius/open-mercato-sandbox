import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'partner_programs',
  title: 'Partner programs',
  version: '0.1.0',
  description:
    'Partner loyalty and B2B agreement programs linked to CRM partner entities (distinct from procurement suppliers).',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['customers'],
}

export { features } from './acl'
export { eventsConfig } from './events'
export { notificationTypes } from './notifications'
