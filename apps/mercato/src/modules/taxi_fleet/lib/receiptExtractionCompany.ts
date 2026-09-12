import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import {
  CustomerCompanyProfile,
  CustomerEntity,
} from '@open-mercato/core/modules/customers/data/entities'
import {
  fetchCompanyFromMfVatRegistry,
  type MfRegistryCompanyData,
} from '@open-mercato/core/modules/customers/lib/mfVatRegistry'
import { isValidNip, normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import type { TaxiFleetReceiptExtraction } from '../data/entities'
import type { ReceiptOcrWarning } from './receiptExtractionRules'

export type EnsureCompanyResult = {
  companyEntityId: string | null
  reusedExisting: boolean
  warningCode?: 'nip_invalid' | 'nip_not_found' | 'nip_lookup_failed'
  mf?: MfRegistryCompanyData | null
}

/** Finds an existing CRM company by NIP (digit-normalized; skips create). */
export async function findCompanyEntityIdByNip(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; nip: string },
): Promise<string | null> {
  const normalizedNip = normalizeNipDigits(params.nip)
  if (!normalizedNip || !isValidNip(normalizedNip)) return null

  const rows = await em.getConnection().execute<{ entity_id: string }[]>(
    `
      select cc.entity_id
      from customer_companies cc
      inner join customer_entities ce on ce.id = cc.entity_id
      where cc.tenant_id = ?
        and cc.organization_id = ?
        and ce.deleted_at is null
        and ce.kind = 'company'
        and cc.nip is not null
        and regexp_replace(cc.nip, '\\D', '', 'g') = ?
      limit 1
    `,
    [params.tenantId, params.organizationId, normalizedNip],
  )

  const entityId = rows[0]?.entity_id
  return typeof entityId === 'string' && entityId.length > 0 ? entityId : null
}

/** Creates CRM company from MF data using EM only (safe for OCR background worker). */
export async function createCompanyFromMfRegistry(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    nip: string
    mf: MfRegistryCompanyData
  },
): Promise<string> {
  const displayName = params.mf.displayName || params.mf.legalName || params.nip
  const entity = em.create(CustomerEntity, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    kind: 'company',
    crmRecordType: 'customer',
    displayName,
    description: null,
    ownerUserId: null,
    primaryEmail: null,
    primaryPhone: null,
    status: 'active',
    lifecycleStage: 'customer',
    source: 'taxi_fleet.receipt_ocr',
    isActive: true,
  })
  const profile = em.create(CustomerCompanyProfile, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    entity,
    legalName: params.mf.legalName || params.mf.displayName || null,
    brandName: null,
    domain: null,
    websiteUrl: null,
    industry: null,
    sizeBucket: null,
    annualRevenue: null,
    nip: params.nip,
    regon: params.mf.regon ?? null,
  })
  em.persist(entity)
  em.persist(profile)
  await em.flush()
  return entity.id
}

export async function ensureCrmCompanyFromBuyerNipEm(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    buyerNip: string
  },
): Promise<EnsureCompanyResult> {
  const normalizedNip = normalizeNipDigits(params.buyerNip)
  if (!normalizedNip || !isValidNip(normalizedNip)) {
    return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_invalid' }
  }

  const existingId = await findCompanyEntityIdByNip(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
  })
  if (existingId) return { companyEntityId: existingId, reusedExisting: true }

  let mf: MfRegistryCompanyData | null
  try {
    mf = await fetchCompanyFromMfVatRegistry({ nip: normalizedNip })
  } catch {
    return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_lookup_failed' }
  }
  if (!mf) return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_not_found' }

  const racedId = await findCompanyEntityIdByNip(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
  })
  if (racedId) return { companyEntityId: racedId, reusedExisting: true }

  const companyEntityId = await createCompanyFromMfRegistry(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
    mf,
  })
  return { companyEntityId, reusedExisting: false, mf }
}

export async function ensureCrmCompanyFromBuyerNip(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  buyerNip: string
}): Promise<EnsureCompanyResult> {
  const normalizedNip = normalizeNipDigits(params.buyerNip)
  if (!normalizedNip || !isValidNip(normalizedNip)) {
    return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_invalid' }
  }

  const existingId = await findCompanyEntityIdByNip(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
  })
  if (existingId) return { companyEntityId: existingId, reusedExisting: true }

  let mf: MfRegistryCompanyData | null
  try {
    mf = await fetchCompanyFromMfVatRegistry({ nip: normalizedNip })
  } catch {
    return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_lookup_failed' }
  }
  if (!mf) return { companyEntityId: null, reusedExisting: false, warningCode: 'nip_not_found' }

  const racedId = await findCompanyEntityIdByNip(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
  })
  if (racedId) return { companyEntityId: racedId, reusedExisting: true }

  try {
    const { result } = await params.commandBus.execute('customers.companies.create', {
      input: {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        displayName: mf.displayName || mf.legalName || normalizedNip,
        legalName: mf.legalName || mf.displayName || null,
        nip: normalizedNip,
        regon: mf.regon ?? null,
        source: 'taxi_fleet.receipt_ocr',
        crmRecordType: 'customer',
        status: 'active',
        lifecycleStage: 'customer',
        isActive: true,
      },
      ctx: params.ctx,
    })
    const entityId =
      result && typeof result === 'object' && 'entityId' in result
        ? String((result as { entityId: string }).entityId)
        : null
    if (entityId) return { companyEntityId: entityId, reusedExisting: false, mf }
  } catch {
    // Fall back to EM create if command path fails (e.g. feature ACL in worker-less context)
  }

  const afterCommandId = await findCompanyEntityIdByNip(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
  })
  if (afterCommandId) return { companyEntityId: afterCommandId, reusedExisting: true }

  const companyEntityId = await createCompanyFromMfRegistry(params.em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    nip: normalizedNip,
    mf,
  })
  return { companyEntityId, reusedExisting: false, mf }
}

export async function maybeEnsureCompanyForExtraction(params: {
  em: EntityManager
  commandBus?: CommandBus
  ctx?: CommandRuntimeContext
  extraction: TaxiFleetReceiptExtraction
}): Promise<void> {
  if (!params.extraction.ocrBuyerNip) return
  if (params.extraction.resolvedCompanyId) return

  const ensured =
    params.commandBus && params.ctx
      ? await ensureCrmCompanyFromBuyerNip({
          em: params.em,
          commandBus: params.commandBus,
          ctx: params.ctx,
          tenantId: params.extraction.tenantId,
          organizationId: params.extraction.organizationId,
          buyerNip: params.extraction.ocrBuyerNip,
        })
      : await ensureCrmCompanyFromBuyerNipEm(params.em, {
          tenantId: params.extraction.tenantId,
          organizationId: params.extraction.organizationId,
          buyerNip: params.extraction.ocrBuyerNip,
        })

  if (ensured.companyEntityId) {
    params.extraction.resolvedCompanyId = ensured.companyEntityId
    params.extraction.updatedAt = new Date()
    await params.em.flush()
    return
  }

  if (!ensured.warningCode) return
  const warnings: ReceiptOcrWarning[] = Array.isArray(params.extraction.warningsJson)
    ? (params.extraction.warningsJson as ReceiptOcrWarning[])
    : []
  if (!warnings.some((w) => w?.code === ensured.warningCode)) {
    warnings.push({
      code: ensured.warningCode,
      field: 'buyerNip',
      ocrValue: params.extraction.ocrBuyerNip,
    })
    params.extraction.warningsJson = warnings as unknown as Record<string, unknown>[]
    params.extraction.status = 'needs_review'
    params.extraction.updatedAt = new Date()
    await params.em.flush()
  }
}

export function extractionHasReviewWarnings(
  warnings: Array<Record<string, unknown>> | ReceiptOcrWarning[] | null | undefined,
): boolean {
  if (!Array.isArray(warnings)) return false
  return warnings.some((warning) => {
    const code = warning && typeof warning === 'object' ? String((warning as { code?: string }).code ?? '') : ''
    return (
      code === 'field_conflict' ||
      code === 'nip_invalid' ||
      code === 'nip_not_found' ||
      code === 'nip_lookup_failed' ||
      code === 'customer_nip_conflict' ||
      code === 'document_duplicate' ||
      code === 'low_confidence'
    )
  })
}
