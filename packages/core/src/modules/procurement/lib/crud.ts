import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import type {
  OperationsTask,
  ProcurementProcess,
  ProcurementProcessLineItem,
  ProcurementProcessSupplier,
} from '../data/entities'
import {
  PROCUREMENT_LINE_ITEM_ENTITY_TYPE,
  PROCUREMENT_PROCESS_ENTITY_TYPE,
  PROCUREMENT_SUPPLIER_ENTITY_TYPE,
  PROCUREMENT_TASK_ENTITY_TYPE,
} from './entityTypes'

export const procurementProcessCrudEvents: CrudEventsConfig<ProcurementProcess> = {
  module: 'procurement',
  entity: 'process',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

export const procurementProcessCrudIndexer: CrudIndexerConfig<ProcurementProcess> = {
  entityType: PROCUREMENT_PROCESS_ENTITY_TYPE,
}

export const procurementSupplierCrudEvents: CrudEventsConfig<ProcurementProcessSupplier> = {
  module: 'procurement',
  entity: 'process_supplier',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

export const procurementSupplierCrudIndexer: CrudIndexerConfig<ProcurementProcessSupplier> = {
  entityType: PROCUREMENT_SUPPLIER_ENTITY_TYPE,
}

export const procurementLineItemCrudEvents: CrudEventsConfig<ProcurementProcessLineItem> = {
  module: 'procurement',
  entity: 'process_line_item',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

export const procurementLineItemCrudIndexer: CrudIndexerConfig<ProcurementProcessLineItem> = {
  entityType: PROCUREMENT_LINE_ITEM_ENTITY_TYPE,
}

export const procurementTaskCrudEvents: CrudEventsConfig<OperationsTask> = {
  module: 'procurement',
  entity: 'process_task',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    organizationId: ctx.identifiers.organizationId,
    tenantId: ctx.identifiers.tenantId,
  }),
}

export const procurementTaskCrudIndexer: CrudIndexerConfig<OperationsTask> = {
  entityType: PROCUREMENT_TASK_ENTITY_TYPE,
}
