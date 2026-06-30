import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { InsurancePolicy } from '../../data/entities'
import { insurancePolicyCreateSchema, insurancePolicyUpdateSchema } from '../../data/validators'
import {
  buildInsuranceCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeInsuranceCommandScope } from '../mergeScope'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'
import {
  mapCustomerEntityToReferringPartner,
  type ReferringPartnerAssociation,
} from '@open-mercato/core/modules/customers/lib/referringPartnerAssociation'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['insurance.policies.view'] },
  POST: { requireAuth: true, requireFeatures: ['insurance.policies.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['insurance.policies.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['insurance.policies.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: InsurancePolicy,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'insurance',
    entity: 'policy',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'insurance.policies.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String(result.policyId) }),
      status: 201,
    },
    update: {
      commandId: 'insurance.policies.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'insurance.policies.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as
          | string
          | undefined,
      }),
      response: () => ({ ok: true }),
    },
  },
})

const listQuerySchema = z
  .object({
    id: z.uuid().optional(),
    insurerId: z.uuid().optional(),
    referringPartnerEntityId: z.uuid().optional(),
    /** Match policies linked to this CRM entity as referring partner or insured person/company. */
    customerEntityId: z.uuid().optional(),
    resourceId: z.uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['policyNumber', 'validFrom', 'validTo', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type PolicyRow = {
  id: string
  policyNumber: string
  insurerId: string
  insurerContactId: string | null
  caretakerUserId: string | null
  referringPartnerEntityId: string | null
  referringPartner: ReferringPartnerAssociation | null
  catalogProductId: string | null
  resourceId: string | null
  insuredPersonEntityId: string | null
  insuredCompanyEntityId: string | null
  validFrom: string | null
  validTo: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: InsurancePolicy): PolicyRow => {
  const ins = row.insurer
  const insurerId = typeof ins === 'string' ? ins : ins.id
  const ic = row.insurerContact
  const insurerContactId =
    ic === null || ic === undefined ? null : typeof ic === 'string' ? ic : ic.id
  return {
    id: String(row.id),
    policyNumber: row.policyNumber,
    insurerId,
    insurerContactId,
    caretakerUserId: row.caretakerUserId ?? null,
    referringPartnerEntityId: row.referringPartnerEntityId ?? null,
    referringPartner: null,
    catalogProductId: row.catalogProductId ?? null,
    resourceId: row.resourceId ?? null,
    insuredPersonEntityId: row.insuredPersonEntityId ?? null,
    insuredCompanyEntityId: row.insuredCompanyEntityId ?? null,
    validFrom: row.validFrom ? row.validFrom.toISOString() : null,
    validTo: row.validTo ? row.validTo.toISOString() : null,
    status: row.status ?? null,
    metadata: row.metadata ? { ...row.metadata } : null,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    organizationId: String(row.organizationId),
    tenantId: String(row.tenantId),
  }
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const {
    id,
    insurerId,
    referringPartnerEntityId,
    customerEntityId,
    resourceId,
    page,
    pageSize,
    search,
    sortField,
    sortDir,
  } = parsed.data
  const filter: FilterQuery<InsurancePolicy> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (insurerId) filter.insurer = insurerId
  if (referringPartnerEntityId) filter.referringPartnerEntityId = referringPartnerEntityId
  if (customerEntityId) {
    filter.$or = [
      { referringPartnerEntityId: customerEntityId },
      { insuredPersonEntityId: customerEntityId },
      { insuredCompanyEntityId: customerEntityId },
    ]
  }
  if (resourceId) filter.resourceId = resourceId
  if (search) {
    filter.policyNumber = { $ilike: `%${search}%` }
  }

  const fieldMap: Record<string, string> = {
    policyNumber: 'policyNumber',
    validFrom: 'validFrom',
    validTo: 'validTo',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'validFrom'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.validFrom = 'DESC'
  }

  const [all, total] = await em.findAndCount(InsurancePolicy, filter, {
    orderBy,
    populate: ['insurer', 'insurerContact'],
  })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const items = paged.map(toRow)

  const partnerIds = [
    ...new Set(
      items
        .map((item) => item.referringPartnerEntityId?.trim() ?? '')
        .filter((value) => value.length > 0),
    ),
  ]
  if (partnerIds.length > 0 && auth.tenantId) {
    const partnerRows = await findWithDecryption(
      em,
      CustomerEntity,
      {
        id: { $in: partnerIds },
        tenantId: auth.tenantId,
        deletedAt: null,
        ...(auth.orgId ? { organizationId: auth.orgId } : {}),
      },
      { populate: ['personProfile', 'companyProfile'] },
      { tenantId: auth.tenantId, organizationId: auth.orgId ?? null },
    )
    const partnerById = new Map(
      partnerRows.map((entity) => [entity.id, mapCustomerEntityToReferringPartner(entity)]),
    )
    for (const item of items) {
      const partnerId = item.referringPartnerEntityId?.trim() ?? ''
      if (!partnerId.length) continue
      const partner = partnerById.get(partnerId)
      if (partner && partner.id === partnerId) {
        item.referringPartner = partner
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const policyListItemSchema = z.object({
  id: z.uuid(),
  policyNumber: z.string(),
  insurerId: z.uuid(),
  insurerContactId: z.uuid().nullable(),
  caretakerUserId: z.uuid().nullable(),
  referringPartnerEntityId: z.uuid().nullable(),
  referringPartner: z
    .object({
      id: z.uuid(),
      label: z.string(),
      subtitle: z.string().nullable().optional(),
      kind: z.enum(['person', 'company']),
      referralCode: z.string().nullable().optional(),
      crmRecordType: z.string().nullable().optional(),
    })
    .nullable(),
  catalogProductId: z.uuid().nullable(),
  resourceId: z.uuid().nullable(),
  insuredPersonEntityId: z.uuid().nullable(),
  insuredCompanyEntityId: z.uuid().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  status: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildInsuranceCrudOpenApi({
  resourceName: 'Policy',
  pluralName: 'Policies',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(policyListItemSchema),
  create: {
    schema: insurancePolicyCreateSchema,
    description: 'Creates an insurance policy record.',
  },
  update: {
    schema: insurancePolicyUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a policy.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a policy.',
  },
})
