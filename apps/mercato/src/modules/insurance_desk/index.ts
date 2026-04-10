import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'insurance_desk',
  title: 'Insurance desk',
  version: '0.1.0',
  description: 'Admin UI hub for insurance (insurers, policies, workflows, catalog and resources links).',
  author: 'Open Mercato',
  license: 'MIT',
  requires: ['insurance', 'workflows', 'catalog', 'resources'],
}

export { features } from './acl'
