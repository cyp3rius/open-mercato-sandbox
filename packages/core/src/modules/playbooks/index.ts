import './commands'
import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'playbooks',
  title: 'Playbooks',
  version: '0.1.0',
  description: 'Versioned procedural playbooks for CRM and cases.',
  author: 'Open Mercato Team',
  license: 'Proprietary',
  requires: ['cases'],
}

export { features } from './acl'
