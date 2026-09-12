import { z } from 'zod'

export const DEFAULT_TRIP_STATUS_CODES = [
  'new',
  'approved',
  'paid',
  'scheduled',
  'completed',
  'cancelled',
] as const

/** @deprecated Use organization trip status dictionary codes instead. */
export const TAXI_FLEET_TRIP_STATUS_CODES = DEFAULT_TRIP_STATUS_CODES

export type TaxiFleetTripStatusCode = string

export const TAXI_FLEET_STATUS_ENTER_ACTIONS = [
  'notify_order_created',
  'notify_assigned',
  'notify_paid',
  'notify_confirmed',
  'notify_cancelled',
  'customer_email_created',
  'customer_email_approved',
  'customer_email_paid',
  'customer_email_cancelled',
] as const

export type TaxiFleetStatusEnterAction = (typeof TAXI_FLEET_STATUS_ENTER_ACTIONS)[number]

const LEGACY_COLOR_TOKENS: Record<string, string> = {
  slate: '#64748b',
  blue: '#3b82f6',
  emerald: '#10b981',
  amber: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
}

export const tripStatusCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'Invalid status code')

export const tripStatusDefinitionSchema = z.object({
  code: tripStatusCodeSchema,
  label: z.string().max(120),
  icon: z.string().max(64).optional().default(''),
  color: z.string().max(40).optional().default(''),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
  isTerminal: z.boolean().default(false),
  onEnterActions: z.array(z.enum(TAXI_FLEET_STATUS_ENTER_ACTIONS)).default([]),
})

export type TaxiFleetTripStatusDefinition = z.infer<typeof tripStatusDefinitionSchema>

export const tripStatusDictionarySchema = z
  .array(tripStatusDefinitionSchema)
  .min(1)
  .superRefine((entries, ctx) => {
    const seen = new Set<string>()
    for (let index = 0; index < entries.length; index += 1) {
      const code = entries[index]?.code
      if (!code) continue
      if (seen.has(code)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duplicate status code',
          path: [index, 'code'],
        })
      }
      seen.add(code)
    }
  })

const LEGACY_STATUS_MAP: Record<string, string> = {
  draft: 'new',
  submitted: 'new',
  approved: 'approved',
  rejected: 'cancelled',
  cancelled: 'cancelled',
  paid: 'paid',
  new: 'new',
  scheduled: 'scheduled',
  completed: 'completed',
}

function normalizeColorValue(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw.length) return ''
  if (raw.startsWith('#')) return raw
  return LEGACY_COLOR_TOKENS[raw] ?? raw
}

function migrateTripStatusEntry(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const record = raw as Record<string, unknown>
  const label =
    typeof record.label === 'string' && record.label.trim().length
      ? record.label
      : typeof record.labelPl === 'string' && record.labelPl.trim().length
        ? record.labelPl
        : typeof record.labelEn === 'string'
          ? record.labelEn
          : ''
  return {
    ...record,
    label,
    icon: typeof record.icon === 'string' ? record.icon : '',
    color: normalizeColorValue(record.color),
  }
}

export function defaultTripStatusDictionary(): TaxiFleetTripStatusDefinition[] {
  return tripStatusDictionarySchema.parse([
    {
      code: 'new',
      label: 'Nowy',
      icon: 'lucide:sparkles',
      color: '#64748b',
      sortOrder: 10,
      isTerminal: false,
      onEnterActions: ['notify_order_created', 'customer_email_created'],
    },
    {
      code: 'approved',
      label: 'Zatwierdzony',
      icon: 'lucide:check-circle',
      color: '#3b82f6',
      sortOrder: 20,
      isTerminal: false,
      onEnterActions: ['notify_confirmed', 'customer_email_approved'],
    },
    {
      code: 'paid',
      label: 'Opłacony',
      icon: 'lucide:credit-card',
      color: '#10b981',
      sortOrder: 30,
      isTerminal: false,
      onEnterActions: ['notify_paid', 'customer_email_paid'],
    },
    {
      code: 'scheduled',
      label: 'Do realizacji',
      icon: 'lucide:calendar-clock',
      color: '#f59e0b',
      sortOrder: 40,
      isTerminal: false,
      onEnterActions: ['notify_assigned'],
    },
    {
      code: 'completed',
      label: 'Zrealizowany',
      icon: 'lucide:badge-check',
      color: '#22c55e',
      sortOrder: 50,
      isTerminal: true,
      onEnterActions: [],
    },
    {
      code: 'cancelled',
      label: 'Anulowany',
      icon: 'lucide:circle-x',
      color: '#ef4444',
      sortOrder: 60,
      isTerminal: true,
      onEnterActions: ['notify_cancelled', 'customer_email_cancelled'],
    },
  ])
}

export function normalizeTripStatusCodeInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64)
}

export function normalizeTripStatusDefinition(
  entry: TaxiFleetTripStatusDefinition,
): TaxiFleetTripStatusDefinition {
  return {
    ...entry,
    code: normalizeTripStatusCodeInput(entry.code),
    label: entry.label.trim(),
    icon: entry.icon?.trim() ?? '',
    color: entry.color?.trim() ?? '',
  }
}

export function createEmptyTripStatusDefinition(sortOrder: number): TaxiFleetTripStatusDefinition {
  return {
    code: '',
    label: '',
    icon: '',
    color: '#64748b',
    sortOrder,
    isTerminal: false,
    onEnterActions: [],
  }
}

export function defaultTripStatusCode(dictionary: TaxiFleetTripStatusDefinition[]): string {
  const preferred = dictionary.find((entry) => entry.code === 'scheduled')
  if (preferred) return preferred.code
  const legacyNew = dictionary.find((entry) => entry.code === 'new')
  if (legacyNew) return legacyNew.code
  const first = listSelectableTripStatuses(dictionary)[0]
  return first?.code ?? 'scheduled'
}

export function normalizeTripStatus(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim()
  if (!normalized.length) return 'new'
  return LEGACY_STATUS_MAP[normalized] ?? normalized
}

export function mergeTripStatusDictionary(raw: unknown): TaxiFleetTripStatusDefinition[] {
  const defaults = defaultTripStatusDictionary()
  if (!Array.isArray(raw) || raw.length === 0) return defaults
  const migrated = raw.map(migrateTripStatusEntry)
  const parsed = tripStatusDictionarySchema.safeParse(migrated)
  if (!parsed.success) return defaults

  const byCode = new Map<string, TaxiFleetTripStatusDefinition>()
  for (const entry of parsed.data) {
    const normalized = normalizeTripStatusDefinition(entry)
    if (!normalized.code.length) continue
    byCode.set(normalized.code, normalized)
  }
  const merged = [...byCode.values()].sort((left, right) => left.sortOrder - right.sortOrder)
  return merged.length ? merged : defaults
}

export function findTripStatusDefinition(
  dictionary: TaxiFleetTripStatusDefinition[],
  code: string,
): TaxiFleetTripStatusDefinition | undefined {
  const normalized = normalizeTripStatus(code)
  return dictionary.find((entry) => entry.code === normalized || entry.code === code)
}

export function listSelectableTripStatuses(dictionary: TaxiFleetTripStatusDefinition[]): TaxiFleetTripStatusDefinition[] {
  return [...dictionary].sort((left, right) => left.sortOrder - right.sortOrder)
}

export function resolveTripStatusLabelFromDictionary(
  dictionary: TaxiFleetTripStatusDefinition[],
  code: string,
  fallback?: string,
): string {
  const definition = findTripStatusDefinition(dictionary, code)
  if (definition?.label?.trim().length) return definition.label.trim()
  return fallback ?? code
}

export function buildTripStatusSelectOptions(
  dictionary: TaxiFleetTripStatusDefinition[],
): Array<{ value: string; label: string }> {
  return listSelectableTripStatuses(dictionary).map((entry) => ({
    value: entry.code,
    label: entry.label.trim() || entry.code,
  }))
}
