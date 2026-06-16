import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'

export const PROTECTION_CATALOG_LUCIDE_IDS = [
  'Shield',
  'Car',
  'Umbrella',
  'FileText',
  'Wrench',
  'Key',
  'Heart',
  'Star',
  'CheckCircle',
  'AlertTriangle',
  'Home',
  'MapPin',
  'Gauge',
  'Truck',
  'Bus',
  'User',
  'Users',
  'Landmark',
  'Sparkles',
  'CircleHelp',
] as const

export type ProtectionCatalogLucideId = (typeof PROTECTION_CATALOG_LUCIDE_IDS)[number]

export function isProtectionCatalogLucideId(s: string): s is ProtectionCatalogLucideId {
  return (PROTECTION_CATALOG_LUCIDE_IDS as readonly string[]).includes(s)
}

const LEGACY_LUCIDE_PASCAL = /^[A-Z][a-zA-Z0-9]*$/

export function ProtectionCatalogLucideIcon({
  name,
  className,
}: {
  name?: string | null
  className?: string
}) {
  const trimmed = name?.trim() ?? ''
  const map = LucideIcons as unknown as Record<string, LucideIcon>
  const Fallback = LucideIcons.Shield
  if (!trimmed) {
    return <Fallback className={className} aria-hidden />
  }
  if (trimmed.startsWith('lucide:')) {
    const rendered = renderDictionaryIcon(trimmed, className)
    if (rendered) {
      return <>{rendered}</>
    }
    return <Fallback className={className} aria-hidden />
  }
  if (LEGACY_LUCIDE_PASCAL.test(trimmed) && map[trimmed]) {
    const Cmp = map[trimmed]!
    return <Cmp className={className} aria-hidden />
  }
  const emojiOrToken = renderDictionaryIcon(trimmed, className)
  if (emojiOrToken) {
    return <>{emojiOrToken}</>
  }
  return <Fallback className={className} aria-hidden />
}
