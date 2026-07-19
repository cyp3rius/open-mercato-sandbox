import type { InjectionWidgetModule } from '@open-mercato/shared/modules/widgets/injection'
import CustomerOfferingsWidget from './widget.client'

const widget: InjectionWidgetModule = {
  metadata: {
    id: 'catalog.injection.customer-offerings',
    title: 'Offerings',
    description: 'Customer product offerings activated from sales',
    features: ['catalog.customer_offerings.view'],
    priority: 40,
    enabled: true,
  },
  Widget: CustomerOfferingsWidget,
}

export default widget
