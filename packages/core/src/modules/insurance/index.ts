import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'insurance',
  title: 'Insurance',
  version: '0.1.0',
  description: 'Insurers, insurer contacts, and policies (linked to CRM entities as referring partners).',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['customers', 'attachments'],
}

export { features } from './acl'
export { eventsConfig } from './events'
export { INSURANCE_LEAD_ATTACHMENT_ENTITY_ID } from './lib/leadAttachmentConstants'
