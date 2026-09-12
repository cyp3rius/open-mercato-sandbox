import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'taxi_fleet',
  title: 'Taxi fleet',
  version: '0.1.0',
  description: 'Daily fleet assignments, trips, costs, and weekly driver settlements.',
  author: 'RS Moto',
  license: 'MIT',
  requires: ['staff', 'resources', 'planner', 'customers'],
}

export { features } from './acl'
export { setup } from './setup'
export { eventsConfig } from './events'
export { notificationTypes } from './notifications'
