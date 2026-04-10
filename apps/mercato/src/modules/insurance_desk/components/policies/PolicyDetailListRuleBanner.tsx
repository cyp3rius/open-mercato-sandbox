"use client"

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@open-mercato/ui/primitives/alert'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import {
  POLICY_LIST_COLOR_FIELD_META,
  POLICY_LIST_COLOR_OPERATOR_SYMBOL,
  ruleHexToStrongForeground,
  type PolicyListColorEvaluationRow,
  type PolicyListColorRule,
  type PolicyListColorRuleField,
} from '@open-mercato/core/modules/insurance/lib/policyListColorRules'

const LIST_RULE_FIELD_LABEL_KEY: Record<PolicyListColorRuleField, string> = {
  policyNumber: 'insurance_desk.policies.col.number',
  status: 'insurance_desk.policies.col.status',
  validFrom: 'insurance_desk.policies.col.validFrom',
  validTo: 'insurance_desk.policies.col.validTo',
  createdAt: 'insurance_desk.policies.col.createdAt',
  updatedAt: 'insurance_desk.policies.col.updatedAt',
  insurerId: 'insurance_desk.policies.col.insurer',
  referringPartnerEntityId: 'insurance_desk.policies.col.partner',
  catalogProductId: 'insurance_desk.policies.col.product',
  resourceId: 'insurance_desk.policies.col.insuranceSubject',
}

function hexToRgba(hex: string, alpha: number): string | undefined {
  const t = hex.trim()
  const m = /^#?([0-9a-fA-F]{6})$/.exec(t)
  if (!m?.[1]) return undefined
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function formatIsoDate(iso: string | null): string {
  if (!iso?.length) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function formatRuleExpectedValue(rule: PolicyListColorRule, t: TranslateFn): string {
  const meta = POLICY_LIST_COLOR_FIELD_META[rule.field]
  const raw = rule.value.trim()
  if (!raw.length) return '—'
  if (meta.kind === 'datetime' && rule.operator !== 'eq') {
    return `${raw} ${t('insurance_desk.config.policyColors.daysUnit', 'days')}`
  }
  if (meta.kind === 'datetime' && rule.operator === 'eq') {
    const d = Date.parse(raw)
    if (Number.isFinite(d)) return new Date(d).toLocaleDateString()
    const d2 = Date.parse(`${raw}T00:00:00.000Z`)
    return Number.isFinite(d2) ? new Date(d2).toLocaleDateString() : raw
  }
  return raw
}

function formatEvalActualValue(
  field: PolicyListColorRuleField,
  evalRow: PolicyListColorEvaluationRow,
  t: TranslateFn,
  getters: {
    getStatusLabel: (value: string) => string
    getInsurerLabel: (id: string) => string
    getPartnerLabel: (id: string) => string
    getProductLabel: (id: string | null) => string
    getResourceLabel: (id: string | null) => string
  },
): string {
  switch (field) {
    case 'policyNumber':
      return evalRow.policyNumber.trim().length ? evalRow.policyNumber : '—'
    case 'status': {
      const s = evalRow.status?.trim() ?? ''
      return s.length ? getters.getStatusLabel(s) : '—'
    }
    case 'validFrom':
      return formatIsoDate(evalRow.validFrom)
    case 'validTo':
      return formatIsoDate(evalRow.validTo)
    case 'createdAt':
      return formatIsoDate(evalRow.createdAt)
    case 'updatedAt':
      return formatIsoDate(evalRow.updatedAt)
    case 'insurerId':
      return getters.getInsurerLabel(evalRow.insurerId)
    case 'referringPartnerEntityId':
      return getters.getPartnerLabel(evalRow.referringPartnerEntityId)
    case 'catalogProductId':
      return getters.getProductLabel(evalRow.catalogProductId)
    case 'resourceId':
      return getters.getResourceLabel(evalRow.resourceId)
    default:
      return '—'
  }
}

export type PolicyDetailListRuleBannerProps = {
  rule: PolicyListColorRule
  evalRow: PolicyListColorEvaluationRow
  t: TranslateFn
  getStatusLabel: (value: string) => string
  getInsurerLabel: (id: string) => string
  getPartnerLabel: (id: string) => string
  getProductLabel: (id: string | null) => string
  getResourceLabel: (id: string | null) => string
}

export function PolicyDetailListRuleBanner({
  rule,
  evalRow,
  t,
  getStatusLabel,
  getInsurerLabel,
  getPartnerLabel,
  getProductLabel,
  getResourceLabel,
}: PolicyDetailListRuleBannerProps) {
  const getters = React.useMemo(
    () => ({
      getStatusLabel,
      getInsurerLabel,
      getPartnerLabel,
      getProductLabel,
      getResourceLabel,
    }),
    [getStatusLabel, getInsurerLabel, getPartnerLabel, getProductLabel, getResourceLabel],
  )

  const fieldName = t(LIST_RULE_FIELD_LABEL_KEY[rule.field], rule.field)
  const operatorSymbol = POLICY_LIST_COLOR_OPERATOR_SYMBOL[rule.operator]
  const expected = formatRuleExpectedValue(rule, t)
  const actual = formatEvalActualValue(rule.field, evalRow, t, getters)
  const genericBody = t('insurance_desk.policies.detail.listRuleAlert.body', {
    field: fieldName,
    operator: operatorSymbol,
    expected,
    actual,
  })

  const isValidToDaysRule = rule.field === 'validTo' && rule.operator !== 'eq'
  const alertTitle = isValidToDaysRule
    ? t('insurance_desk.policies.detail.listRuleAlert.validToDaysTitle', 'Wymagane działanie')
    : t('insurance_desk.policies.detail.listRuleAlert.title', 'Matches policy list highlight rule')
  const alertBody = isValidToDaysRule
    ? t(
        'insurance_desk.policies.detail.listRuleAlert.validToDaysBody',
        'Ważność polisy kończy się w okresie krótszym niż {value} dni. Podejmij stosowne działania.',
        { value: rule.value.trim() },
      )
    : genericBody

  const accent = ruleHexToStrongForeground(rule.color)
  const border = hexToRgba(rule.color, 0.38) ?? accent
  const bg = hexToRgba(rule.color, 0.12) ?? `${rule.color}22`

  return (
    <Alert
      variant="warning"
      className="border-2 [&>svg]:text-current"
      style={{
        borderColor: border,
        backgroundColor: bg,
        color: accent,
      }}
    >
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <AlertTitle>{alertTitle}</AlertTitle>
      <AlertDescription className="text-current/95">{alertBody}</AlertDescription>
    </Alert>
  )
}
