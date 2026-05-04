import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'cases',
  title: 'Cases',
  version: '0.1.0',
  description: 'Omnichannel service cases with timeline and message linkage.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['customers', 'messages'],
}

export { features } from './acl'
export { eventsConfig } from './events'
export { notificationTypes } from './notifications'
