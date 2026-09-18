import { registerCommand, type CommandHandler } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { requireId } from '@open-mercato/shared/lib/commands/helpers'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDiscountCode } from '../data/entities'
import {
  discountCodeCreateSchema,
  discountCodeDeleteSchema,
  discountCodeUpdateSchema,
  type DiscountCodeCreateInput,
  type DiscountCodeUpdateInput,
} from '../data/validators'
import { ensureOrganizationScope, ensureTenantScope, numericToString } from './shared'

async function assertUniqueCode(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  code: string,
  excludeId?: string,
): Promise<void> {
  const { translate } = await resolveTranslations()
  const existing = await findOneWithDecryption(
    em,
    TaxiFleetDiscountCode,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      code,
      deletedAt: null,
      ...(excludeId ? { id: { $ne: excludeId } } : {}),
    },
    undefined,
    scope,
  )
  if (existing) {
    throw new CrudHttpError(409, {
      error: translate('taxi_fleet.discount_codes.errors.codeExists', 'This discount code already exists.'),
    })
  }
}

const createCommand: CommandHandler<DiscountCodeCreateInput, { discountCodeId: string }> = {
  id: 'taxi_fleet.discount_codes.create',
  async execute(input, ctx) {
    const parsed = discountCodeCreateSchema.parse(input)
    ensureTenantScope(ctx, parsed.tenantId)
    ensureOrganizationScope(ctx, parsed.organizationId)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    await assertUniqueCode(em, { tenantId: parsed.tenantId, organizationId: parsed.organizationId }, parsed.code)

    const now = new Date()
    const record = em.create(TaxiFleetDiscountCode, {
      tenantId: parsed.tenantId,
      organizationId: parsed.organizationId,
      code: parsed.code,
      label: parsed.label ?? null,
      discountType: parsed.discountType,
      value: numericToString(parsed.value),
      usageLimit:
        parsed.discountType === 'amount' && parsed.usageLimit != null
          ? numericToString(parsed.usageLimit)
          : null,
      usedAmount: '0',
      active: parsed.active ?? true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    await em.persistAndFlush(record)
    return { discountCodeId: record.id }
  },
}

const updateCommand: CommandHandler<DiscountCodeUpdateInput, { discountCodeId: string }> = {
  id: 'taxi_fleet.discount_codes.update',
  async execute(input, ctx) {
    const parsed = discountCodeUpdateSchema.parse(input)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDiscountCode, { id: parsed.id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)

    const scope = { tenantId: row.tenantId, organizationId: row.organizationId }
    if (parsed.code !== undefined) {
      await assertUniqueCode(em, scope, parsed.code, row.id)
      row.code = parsed.code
    }
    if (parsed.label !== undefined) row.label = parsed.label
    if (parsed.discountType !== undefined) row.discountType = parsed.discountType
    if (parsed.value !== undefined) row.value = numericToString(parsed.value)
    if (parsed.usageLimit !== undefined) {
      row.usageLimit = parsed.usageLimit == null ? null : numericToString(parsed.usageLimit)
    }
    if (parsed.usedAmount !== undefined) row.usedAmount = numericToString(parsed.usedAmount)
    if (parsed.active !== undefined) row.active = parsed.active

    const effectiveType = parsed.discountType ?? row.discountType
    if (effectiveType === 'percent') {
      row.usageLimit = null
    }

    row.updatedAt = new Date()
    await em.flush()
    return { discountCodeId: row.id }
  },
}

const deleteCommand: CommandHandler<{ id: string }, { ok: true }> = {
  id: 'taxi_fleet.discount_codes.delete',
  async execute(input, ctx) {
    const parsed = discountCodeDeleteSchema.parse(input)
    const id = requireId(parsed.id)
    const em = (ctx.container.resolve('em') as EntityManager).fork()
    const row = await findOneWithDecryption(em, TaxiFleetDiscountCode, { id, deletedAt: null })
    if (!row) throw new CrudHttpError(404, { error: 'Not found' })
    ensureTenantScope(ctx, row.tenantId)
    ensureOrganizationScope(ctx, row.organizationId)
    row.deletedAt = new Date()
    row.updatedAt = new Date()
    await em.flush()
    return { ok: true }
  },
}

registerCommand(createCommand)
registerCommand(updateCommand)
registerCommand(deleteCommand)
