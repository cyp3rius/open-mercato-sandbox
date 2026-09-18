import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDiscountCode } from '../data/entities'

export type DiscountCodeValidationResult = {
  id: string
  code: string
  discountType: 'percent' | 'amount'
  value: number
  discountAmount: number
  totalBefore: number
  totalAfter: number
  remainingAmount?: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeDiscountCodeInput(code: string): string {
  return code.trim().toUpperCase()
}

async function loadActiveDiscountCode(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  code: string,
): Promise<TaxiFleetDiscountCode | null> {
  const normalized = normalizeDiscountCodeInput(code)
  const row = await findOneWithDecryption(
    em,
    TaxiFleetDiscountCode,
    {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      code: normalized,
      deletedAt: null,
      active: true,
    },
    undefined,
    scope,
  )
  return row
}

function computeDiscountAmount(
  row: TaxiFleetDiscountCode,
  totalBefore: number,
): { discountAmount: number; remainingAmount?: number } {
  const value = parseNumericValue(row.value) ?? 0
  if (totalBefore <= 0 || value <= 0) {
    return { discountAmount: 0, remainingAmount: undefined }
  }

  if (row.discountType === 'percent') {
    const discountAmount = roundMoney(Math.min(totalBefore, (totalBefore * value) / 100))
    return { discountAmount }
  }

  const usedAmount = parseNumericValue(row.usedAmount) ?? 0
  const usageLimit = parseNumericValue(row.usageLimit)
  let remainingAmount: number | undefined
  if (usageLimit != null) {
    remainingAmount = roundMoney(Math.max(0, usageLimit - usedAmount))
    if (remainingAmount <= 0) {
      return { discountAmount: 0, remainingAmount: 0 }
    }
  }

  const capByPool = remainingAmount != null ? remainingAmount : value
  const discountAmount = roundMoney(Math.min(totalBefore, value, capByPool))
  return { discountAmount, remainingAmount }
}

export async function validateDiscountCode(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  code: string,
  totalPrice: number,
): Promise<DiscountCodeValidationResult> {
  const { translate } = await resolveTranslations()
  const row = await loadActiveDiscountCode(em, scope, code)
  if (!row) {
    throw new CrudHttpError(404, {
      error: translate('taxi_fleet.discount_codes.errors.notFound', 'Discount code not found or inactive.'),
    })
  }

  const totalBefore = roundMoney(Math.max(0, totalPrice))
  const value = parseNumericValue(row.value) ?? 0
  const { discountAmount, remainingAmount } = computeDiscountAmount(row, totalBefore)
  const totalAfter = roundMoney(Math.max(0, totalBefore - discountAmount))

  if (row.discountType === 'amount' && discountAmount <= 0) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.discount_codes.errors.poolExhausted',
        'This discount code has no remaining balance.',
      ),
    })
  }

  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType,
    value,
    discountAmount,
    totalBefore,
    totalAfter,
    ...(remainingAmount != null ? { remainingAmount } : {}),
  }
}

export async function consumeDiscountCodeUsage(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  code: string,
  discountAmount: number,
): Promise<void> {
  const normalized = normalizeDiscountCodeInput(code)
  const row = await loadActiveDiscountCode(em, scope, normalized)
  if (!row || row.discountType !== 'amount') return

  const amount = roundMoney(Math.max(0, discountAmount))
  if (amount <= 0) return

  const used = parseNumericValue(row.usedAmount) ?? 0
  row.usedAmount = String(roundMoney(used + amount))
  row.updatedAt = new Date()
  await em.flush()
}
