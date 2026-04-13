import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'lead_intake',
  title: 'Lead intake',
  version: '0.1.0',
  description: 'API for capturing marketing leads into CRM (person, deal, note).',
  author: 'Open Mercato',
  license: 'MIT',
  requires: ['customers'],
}

export { features } from './acl'
