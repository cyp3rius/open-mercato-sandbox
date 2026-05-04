import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import CustomerSignalsWidget from './widget.client'

const widget: InjectionWidgetModule<Record<string, unknown>, Record<string, unknown>> = {
  metadata: {
    id: 'customer_signals.injection.customer-signals',
    title: 'Customer signals',
    description: 'Recent behavioral signals for this CRM entity.',
    features: ['customer_signals.view'],
    priority: 180,
    enabled: true,
  },
  Widget: CustomerSignalsWidget,
}

export default widget
