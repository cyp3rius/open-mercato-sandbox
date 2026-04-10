import { z } from 'zod'

export const POLICY_LIST_COLOR_RULE_FIELDS = [
  'policyNumber',
  'status',
  'validFrom',
  'validTo',
  'createdAt',
  'updatedAt',
  'insurerId',
  'referringPartnerEntityId',
  'catalogProductId',
  'resourceId',
] as const

export type PolicyListColorRuleField = (typeof POLICY_LIST_COLOR_RULE_FIELDS)[number]

export type PolicyListColorFieldKind = 'datetime' | 'text' | 'uuid'

export const POLICY_LIST_COLOR_FIELD_META: Record<PolicyListColorRuleField, { kind: PolicyListColorFieldKind }> = {
  policyNumber: { kind: 'text' },
  status: { kind: 'text' },
  validFrom: { kind: 'datetime' },
  validTo: { kind: 'datetime' },
  createdAt: { kind: 'datetime' },
  updatedAt: { kind: 'datetime' },
  insurerId: { kind: 'uuid' },
  referringPartnerEntityId: { kind: 'uuid' },
  catalogProductId: { kind: 'uuid' },
  resourceId: { kind: 'uuid' },
}

export const POLICY_LIST_COLOR_OPERATORS = ['eq', 'lt', 'gt', 'lte', 'gte'] as const
export type PolicyListColorOperator = (typeof POLICY_LIST_COLOR_OPERATORS)[number]

export const POLICY_LIST_COLOR_OPERATOR_SYMBOL: Record<PolicyListColorOperator, string> = {
  eq: '=',
  lt: '<',
  gt: '>',
  lte: '≤',
  gte: '≥',
}

export const policyListColorRuleSchema = z.object({
  id: z.string().uuid(),
  field: z.enum(POLICY_LIST_COLOR_RULE_FIELDS),
  operator: z.enum(POLICY_LIST_COLOR_OPERATORS),
  value: z.string(),
  color: z.string().min(1),
})

export const policyListColorRulesSchema = z.object({
  rules: z.array(policyListColorRuleSchema),
})

export type PolicyListColorRule = z.infer<typeof policyListColorRuleSchema>
export type PolicyListColorRulesPayload = z.infer<typeof policyListColorRulesSchema>

export const POLICY_LIST_COLOR_RULES_CONFIG_MODULE = 'insurance' as const
export const POLICY_LIST_COLOR_RULES_CONFIG_NAME = 'policy_list_color_rules' as const

export const DEFAULT_POLICY_LIST_COLOR_RULES: PolicyListColorRulesPayload = {
  rules: [],
}

export function parsePolicyListColorRules(raw: unknown): PolicyListColorRulesPayload {
  const parsed = policyListColorRulesSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_POLICY_LIST_COLOR_RULES
}

export type PolicyListColorEvaluationRow = {
  policyNumber: string
  status: string | null
  validFrom: string | null
  validTo: string | null
  createdAt: string | null
  updatedAt: string | null
  insurerId: string
  referringPartnerEntityId: string | null
  catalogProductId: string | null
  resourceId: string | null
}

/** List color / highlight rules apply only when policy `status` equals this value (trimmed). */
export const POLICY_LIST_COLOR_RULES_ELIGIBLE_STATUS = 'active' as const

export function policyRowEligibleForListColorRules(row: PolicyListColorEvaluationRow): boolean {
  return row.status?.trim() === POLICY_LIST_COLOR_RULES_ELIGIBLE_STATUS
}

function parseIsoMs(raw: unknown): number | null {
  if (raw == null) return null
  if (raw instanceof Date) {
    const t = raw.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof raw === 'string' && raw.trim().length) {
    const t = Date.parse(raw)
    return Number.isFinite(t) ? t : null
  }
  return null
}

function utcMidnightMsFromMs(ms: number): number {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function todayUtcMidnightMs(): number {
  const n = new Date()
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())
}

function normUuid(s: string): string {
  return s.trim().toLowerCase()
}

function compareNums(left: number, right: number, op: PolicyListColorOperator): boolean {
  switch (op) {
    case 'eq':
      return left === right
    case 'lt':
      return left < right
    case 'gt':
      return left > right
    case 'lte':
      return left <= right
    case 'gte':
      return left >= right
    default:
      return false
  }
}

function ruleMatchesRow(row: PolicyListColorEvaluationRow, rule: PolicyListColorRule): boolean {
  const meta = POLICY_LIST_COLOR_FIELD_META[rule.field]
  const leftRaw = row[rule.field]
  const rv = rule.value.trim()
  if (!rv.length) return false

  if (meta.kind === 'uuid' || meta.kind === 'text') {
    if (rule.operator !== 'eq') return false
    const left =
      leftRaw == null
        ? ''
        : meta.kind === 'uuid'
          ? normUuid(String(leftRaw))
          : String(leftRaw).trim()
    return left === (meta.kind === 'uuid' ? normUuid(rv) : rv)
  }

  const leftMs = parseIsoMs(leftRaw as string | Date | null)
  if (leftMs == null) return false

  if (rule.operator === 'eq') {
    const rightMs = parseIsoMs(rv) ?? parseIsoMs(`${rv}T00:00:00.000Z`)
    if (rightMs == null) return false
    const leftDay = utcMidnightMsFromMs(leftMs)
    const rightDay = utcMidnightMsFromMs(rightMs)
    return leftDay === rightDay
  }

  const n = Number.parseInt(rv.trim(), 10)
  if (!Number.isFinite(n)) return false
  const fieldDay = utcMidnightMsFromMs(leftMs)
  const todayDay = todayUtcMidnightMs()
  const deltaDays = Math.round((fieldDay - todayDay) / 86400000)
  return compareNums(deltaDays, n, rule.operator)
}

export function resolvePolicyListRowColor(
  row: PolicyListColorEvaluationRow,
  rules: PolicyListColorRule[],
): string | null {
  const hit = resolvePolicyListRowMatchingRule(row, rules)
  return hit?.color ?? null
}

/**
 * First matching color rule for the row (same order as row background evaluation).
 * Rules run only when `row.status` is {@link POLICY_LIST_COLOR_RULES_ELIGIBLE_STATUS}.
 */
export function resolvePolicyListRowMatchingRule(
  row: PolicyListColorEvaluationRow,
  rules: PolicyListColorRule[],
): PolicyListColorRule | null {
  if (!policyRowEligibleForListColorRules(row)) return null
  for (const rule of rules) {
    if (ruleMatchesRow(row, rule)) {
      return rule
    }
  }
  return null
}

function clamp255(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function parseHexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m?.[1]) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
        break
      case gn:
        h = ((bn - rn) / d + 2) / 6
        break
      default:
        h = ((rn - gn) / d + 4) / 6
        break
    }
  }
  return { h, s, l }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = clamp255(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    clamp255(hue2rgb(p, q, h + 1 / 3) * 255),
    clamp255(hue2rgb(p, q, h) * 255),
    clamp255(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Stronger text color for highlighted table cells: boosts HSL saturation by `factor` (clamped).
 * Falls back to the input hex if parsing fails.
 */
export function boostHexSaturation(hex: string, factor: number = 3): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return hex.trim()
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const nextS = Math.min(1, s * factor)
  const [r, g, b] = hslToRgb(h, nextS, l)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Dark, readable foreground in the same hue family as the rule color (for text on tinted row / alert).
 * Falls back to the input hex if parsing fails.
 */
export function ruleHexToStrongForeground(hex: string): string {
  const rgb = parseHexRgb(hex)
  if (!rgb) return hex.trim()
  const { h, s, l } = rgbToHsl(rgb[0], rgb[1], rgb[2])
  const nextS = Math.min(0.92, Math.max(0.38, s * 1.08 + (s < 0.12 ? 0.22 : 0.06)))
  const nextL = Math.min(0.28, Math.max(0.12, l * 0.32))
  const [r, g, b] = hslToRgb(h, nextS, nextL)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}
