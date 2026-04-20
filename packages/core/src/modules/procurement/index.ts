import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'procurement',
  title: 'Procurement',
  version: '0.1.0',
  description: 'Internal purchasing processes, supplier comparison, and resource handover.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['customers', 'dictionaries', 'resources', 'attachments', 'notifications', 'workflows'],
}

export { features } from './acl'
export { eventsConfig } from './events'
export { notificationTypes } from './notifications'
