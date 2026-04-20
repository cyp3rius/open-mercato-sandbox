import type { EntityManager } from '@mikro-orm/postgresql'
import { Dictionary, DictionaryEntry, type DictionaryManagerVisibility } from '@open-mercato/core/modules/dictionaries/data/entities'
import { normalizeDictionaryValue, sanitizeDictionaryColor, sanitizeDictionaryIcon } from '@open-mercato/core/modules/dictionaries/lib/utils'
import { ProcurementProcessStatusTransition } from '../data/entities'
import {
  PROCUREMENT_PROCESS_ACTION_DEFAULT_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
} from './dictionaryKeys'

export type ProcurementSeedScope = { tenantId: string; organizationId: string }

type SeedEntry = {
  value: string
  label?: string
  color?: string | null
  icon?: string | null
  isDefault?: boolean
}

const STATUS_DEFAULTS: SeedEntry[] = [
  { value: 'draft', label: 'Draft', icon: 'lucide:file-edit', color: '#64748b', isDefault: true },
  { value: 'active', label: 'Active', icon: 'lucide:play-circle', color: '#2563eb' },
  { value: 'quoting', label: 'Collecting offers', icon: 'lucide:messages-square', color: '#ca8a04' },
  { value: 'awarded', label: 'Offer selected', icon: 'lucide:badge-check', color: '#16a34a' },
  { value: 'ordering', label: 'Ordering', icon: 'lucide:shopping-cart', color: '#0ea5e9' },
  { value: 'receiving', label: 'Receiving / rollout', icon: 'lucide:package', color: '#6366f1' },
  { value: 'closed', label: 'Closed', icon: 'lucide:circle-check', color: '#22c55e' },
]

const TYPE_DEFAULTS: SeedEntry[] = [
  { value: 'asset', label: 'Capital asset', icon: 'lucide:box', color: '#2563eb', isDefault: true },
  { value: 'service', label: 'Service', icon: 'lucide:briefcase', color: '#7c3aed' },
  { value: 'consumable', label: 'Consumables', icon: 'lucide:layers', color: '#ea580c' },
]

/** Default linear lifecycle when transition rules are seeded (normalized values). */
const STATUS_TRANSITION_CHAIN: { from: string; to: string; sortOrder: number }[] = [
  { from: 'draft', to: 'active', sortOrder: 0 },
  { from: 'active', to: 'quoting', sortOrder: 10 },
  { from: 'quoting', to: 'awarded', sortOrder: 20 },
  { from: 'awarded', to: 'ordering', sortOrder: 30 },
  { from: 'ordering', to: 'receiving', sortOrder: 40 },
  { from: 'receiving', to: 'closed', sortOrder: 50 },
]

const ACTION_DEFAULTS: SeedEntry[] = [
  { value: 'process_started', label: 'Process started', icon: 'lucide:flag', color: '#2563eb' },
  { value: 'specification_updated', label: 'Specification updated', icon: 'lucide:file-text', color: '#64748b' },
  { value: 'rfq_sent', label: 'RFQ sent to suppliers', icon: 'lucide:send', color: '#0ea5e9' },
  { value: 'offer_received', label: 'Offer received', icon: 'lucide:inbox', color: '#ca8a04' },
  { value: 'offer_selected', label: 'Offer selected', icon: 'lucide:check-circle', color: '#16a34a' },
  { value: 'order_placed', label: 'Purchase order placed', icon: 'lucide:shopping-bag', color: '#7c3aed' },
  { value: 'invoice_recorded', label: 'Invoice recorded', icon: 'lucide:receipt', color: '#db2777' },
  { value: 'resource_created', label: 'Resource created', icon: 'lucide:warehouse', color: '#059669' },
]

async function ensureDictionary(
  em: EntityManager,
  scope: ProcurementSeedScope,
  definition: { key: string; name: string; description: string },
): Promise<Dictionary> {
  let dictionary = await em.findOne(Dictionary, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
    key: definition.key,
    deletedAt: null,
  })
  if (!dictionary) {
    dictionary = em.create(Dictionary, {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      isSystem: true,
      isActive: true,
      managerVisibility: 'default' satisfies DictionaryManagerVisibility,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(dictionary)
    await em.flush()
  }
  return dictionary
}

async function seedDictionaryEntries(
  em: EntityManager,
  scope: ProcurementSeedScope,
  dictionary: Dictionary,
  seeds: SeedEntry[],
) {
  const existingEntries = await em.find(DictionaryEntry, {
    dictionary,
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const existingByValue = new Map(existingEntries.map((entry) => [entry.normalizedValue, entry]))
  for (const seed of seeds) {
    const value = seed.value.trim()
    if (!value) continue
    const normalizedValue = normalizeDictionaryValue(value)
    if (!normalizedValue) continue
    const color = sanitizeDictionaryColor(seed.color)
    const icon = sanitizeDictionaryIcon(seed.icon)
    const existing = existingByValue.get(normalizedValue)
    if (existing) {
      let updated = false
      if (!existing.label?.trim() && (seed.label ?? '').trim()) {
        existing.label = (seed.label ?? value).trim()
        updated = true
      }
      if (color !== undefined && existing.color !== color) {
        existing.color = color
        updated = true
      }
      if (icon !== undefined && existing.icon !== icon) {
        existing.icon = icon
        updated = true
      }
      if (updated) {
        existing.updatedAt = new Date()
        em.persist(existing)
      }
      continue
    }
    const entry = em.create(DictionaryEntry, {
      dictionary,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      value,
      normalizedValue,
      label: (seed.label ?? value).trim(),
      color: color ?? null,
      icon: icon ?? null,
      isDefault: seed.isDefault === true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    em.persist(entry)
  }
  await em.flush()
}

export async function seedProcurementDictionaries(em: EntityManager, scope: ProcurementSeedScope) {
  const statusDict = await ensureDictionary(em, scope, {
    key: PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
    name: 'Procurement process status',
    description: 'Lifecycle status for internal procurement processes.',
  })
  await seedDictionaryEntries(em, scope, statusDict, STATUS_DEFAULTS)

  const typeDict = await ensureDictionary(em, scope, {
    key: PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
    name: 'Procurement process type',
    description: 'What kind of purchase is being run.',
  })
  await seedDictionaryEntries(em, scope, typeDict, TYPE_DEFAULTS)

  const actionDict = await ensureDictionary(em, scope, {
    key: PROCUREMENT_PROCESS_ACTION_DEFAULT_DICTIONARY_KEY,
    name: 'Procurement actions (default)',
    description: 'Standard actions logged on procurement processes. Add per-type dictionaries using procurement.process.action.<type> for specialized steps.',
  })
  await seedDictionaryEntries(em, scope, actionDict, ACTION_DEFAULTS)

  await seedProcurementStatusTransitions(em, scope)
}

async function seedProcurementStatusTransitions(em: EntityManager, scope: ProcurementSeedScope) {
  const now = new Date()
  for (const edge of STATUS_TRANSITION_CHAIN) {
    const fromNorm = normalizeDictionaryValue(edge.from)
    const toNorm = normalizeDictionaryValue(edge.to)
    if (!fromNorm || !toNorm) continue
    const existing = await em.findOne(ProcurementProcessStatusTransition, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      fromStatusValue: fromNorm,
      toStatusValue: toNorm,
    })
    if (existing) {
      if (existing.sortOrder !== edge.sortOrder) {
        existing.sortOrder = edge.sortOrder
        existing.updatedAt = now
        em.persist(existing)
      }
      continue
    }
    const tr = em.create(ProcurementProcessStatusTransition, {
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
      fromStatusValue: fromNorm,
      toStatusValue: toNorm,
      automationWorkflowId: null,
      sortOrder: edge.sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    em.persist(tr)
  }
  await em.flush()
}
