import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'mail_delivery',
  title: 'Mail delivery',
  version: '0.1.0',
  description: 'Custom notification delivery strategies (SMTP via Nodemailer).',
  author: 'Open Mercato',
  license: 'MIT',
  requires: ['notifications'],
}
