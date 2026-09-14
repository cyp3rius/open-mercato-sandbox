import type { CustomEntitySpec } from '@open-mercato/shared/modules/entities'
import { E } from '#generated/entities.ids.generated'
import {
  RESOURCES_RESOURCE_ACTIVITY_CUSTOM_FIELDS,
  RESOURCES_RESOURCE_CUSTOM_FIELDS,
} from './lib/resourceCustomFields'

const systemEntities: CustomEntitySpec[] = [
  {
    id: E.resources.resources_resource,
    label: 'Resource',
    description: 'Typed asset with capacity, scheduling, and optional vehicle/fleet fields.',
    labelField: 'name',
    showInSidebar: false,
    fields: RESOURCES_RESOURCE_CUSTOM_FIELDS,
  },
  {
    id: E.resources.resources_resource_activity,
    label: 'Resource Activity',
    description: 'Timeline events logged against a resource.',
    labelField: 'subject',
    showInSidebar: false,
    defaultEditor: false,
    fields: RESOURCES_RESOURCE_ACTIVITY_CUSTOM_FIELDS,
  },
]

export const entities = systemEntities
export default systemEntities
