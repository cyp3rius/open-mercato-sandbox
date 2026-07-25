import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import PartnerIncentivesWidget from './widget.client'

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'partner_programs.injection.partner-incentives',
    title: 'Partner incentives',
    description: 'Partner program memberships, incentive ledger, and payouts',
    features: ['partner_programs.view'],
    priority: 45,
    enabled: true,
  },
  Widget: PartnerIncentivesWidget,
}

export default widget
