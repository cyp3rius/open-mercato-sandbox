"use client"

import * as React from 'react'
import * as LucideIcons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { DynamicIcon, iconNames } from 'lucide-react/dynamic'
import { cn } from '@open-mercato/shared/lib/utils'

export type DictionaryDisplayEntry = {
  value: string
  label: string
  color?: string | null
  icon?: string | null
}

export type DictionaryMap = Record<string, DictionaryDisplayEntry>

export type IconOption = {
  value: string
  label: string
  keywords?: string[]
}

function formatLucideIconLabel(slug: string): string {
  return slug
    .split('-')
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(' ')
}

const LUCIDE_ICON_LIBRARY_FROM_PACKAGE: IconOption[] = [...iconNames]
  .sort((a, b) => a.localeCompare(b))
  .map((slug) => ({
    value: `lucide:${slug}`,
    label: formatLucideIconLabel(slug),
    keywords: [slug, slug.replace(/-/g, ' ')],
  }))

export const ICON_SUGGESTIONS: IconOption[] = [
  { value: 'lucide:star', label: 'Star', keywords: ['favorite', 'rating'] },
  { value: 'lucide:flag', label: 'Flag', keywords: ['marker', 'priority'] },
  { value: 'lucide:circle', label: 'Circle', keywords: ['shape'] },
  { value: 'lucide:sparkles', label: 'Sparkles', keywords: ['new', 'shine'] },
  { value: 'lucide:zap', label: 'Lightning', keywords: ['zap', 'bolt'] },
  { value: 'lucide:flame', label: 'Flame', keywords: ['hot'] },
  { value: 'lucide:heart', label: 'Heart', keywords: ['love', 'favorite'] },
  { value: 'lucide:target', label: 'Target', keywords: ['bullseye', 'aim'] },
  { value: 'lucide:award', label: 'Award', keywords: ['badge', 'recognition'] },
  { value: 'lucide:trophy', label: 'Trophy', keywords: ['winner'] },
  { value: 'lucide:briefcase', label: 'Briefcase', keywords: ['business'] },
  { value: 'lucide:rocket', label: 'Rocket', keywords: ['launch', 'growth'] },
  { value: 'lucide:shopping-bag', label: 'Shopping bag', keywords: ['retail', 'store'] },
  { value: 'lucide:thumbs-up', label: 'Thumbs up', keywords: ['approve', 'like'] },
  { value: 'lucide:users', label: 'Users', keywords: ['people', 'team'] },
  { value: 'lucide:lightbulb', label: 'Lightbulb', keywords: ['idea', 'insight'] },
  { value: 'lucide:handshake', label: 'Handshake', keywords: ['agreement', 'deal'] },
  { value: 'lucide:compass', label: 'Compass', keywords: ['direction', 'navigation'] },
  { value: 'lucide:check-circle', label: 'Check circle', keywords: ['confirmed'] },
  { value: 'lucide:shield', label: 'Shield', keywords: ['security', 'protect'] },
  { value: 'lucide:globe', label: 'Globe', keywords: ['world', 'global'] },
  { value: 'lucide:calendar', label: 'Calendar', keywords: ['date', 'schedule'] },
  { value: 'lucide:calendar-check', label: 'Calendar check', keywords: ['confirmed', 'schedule'] },
  { value: 'lucide:calendar-clock', label: 'Calendar clock', keywords: ['time'] },
  { value: 'lucide:calendar-days', label: 'Calendar days', keywords: ['monthly'] },
  { value: 'lucide:clock', label: 'Clock', keywords: ['time', 'deadline'] },
  { value: 'lucide:alarm-clock', label: 'Alarm clock', keywords: ['reminder'] },
  { value: 'lucide:bell', label: 'Bell', keywords: ['notification'] },
  { value: 'lucide:message-square', label: 'Message', keywords: ['chat'] },
  { value: 'lucide:clipboard-list', label: 'Checklist', keywords: ['tasks'] },
  { value: 'lucide:phone', label: 'Phone', keywords: ['call'] },
  { value: 'lucide:phone-call', label: 'Phone call', keywords: ['outreach'] },
  { value: 'lucide:send', label: 'Send', keywords: ['message'] },
  { value: 'lucide:mail', label: 'Mail', keywords: ['email'] },
  { value: '⭐️', label: 'Star emoji', keywords: ['favorite', 'rating'] },
  { value: '🔥', label: 'Fire emoji', keywords: ['hot'] },
  { value: '🚀', label: 'Rocket emoji', keywords: ['launch'] },
  { value: '🎯', label: 'Bullseye emoji', keywords: ['target'] },
  { value: '💼', label: 'Briefcase emoji', keywords: ['business'] },
  { value: '✅', label: 'Check emoji', keywords: ['ok'] },
  { value: '💡', label: 'Idea emoji', keywords: ['lightbulb'] },
  { value: '🤝', label: 'Handshake emoji', keywords: ['deal'] },
  { value: '🌍', label: 'Globe emoji', keywords: ['world'] },
  { value: '🗓️', label: 'Calendar emoji', keywords: ['schedule'] },
  { value: '☎️', label: 'Telephone emoji', keywords: ['call'] },
  { value: '💬', label: 'Speech bubble emoji', keywords: ['chat'] },
  { value: '🔔', label: 'Bell emoji', keywords: ['notification'] },
  { value: '⏰', label: 'Alarm clock emoji', keywords: ['reminder'] },
]

const EXTRA_EMOJI_ICON_LIBRARY: IconOption[] = [
  { value: '😀', label: 'Grinning face', keywords: ['smile', 'happy'] },
  { value: '😃', label: 'Smiling face', keywords: ['smile', 'joy'] },
  { value: '😄', label: 'Grinning face with smiling eyes', keywords: ['smile', 'joy'] },
  { value: '😁', label: 'Beaming face', keywords: ['smile', 'excited'] },
  { value: '😆', label: 'Laughing face', keywords: ['laugh', 'haha'] },
  { value: '😎', label: 'Cool face', keywords: ['sunglasses', 'cool'] },
  { value: '🤔', label: 'Thinking face', keywords: ['ponder'] },
  { value: '🤗', label: 'Hugging face', keywords: ['care'] },
  { value: '🤨', label: 'Raised eyebrow', keywords: ['doubt'] },
  { value: '😴', label: 'Sleeping face', keywords: ['rest'] },
  { value: '😇', label: 'Smiling face with halo', keywords: ['angel'] },
  { value: '🙂', label: 'Slight smile', keywords: ['smile'] },
  { value: '🙃', label: 'Upside-down face', keywords: ['silly'] },
  { value: '🤑', label: 'Money-mouth face', keywords: ['profit'] },
  { value: '🤠', label: 'Cowboy face', keywords: ['fun'] },
  { value: '🥳', label: 'Party face', keywords: ['celebration'] },
  { value: '🤯', label: 'Mind blown', keywords: ['surprised'] },
  { value: '😤', label: 'Triumphant face', keywords: ['determined'] },
  { value: '😭', label: 'Crying face', keywords: ['sad'] },
  { value: '🙌', label: 'Raising hands', keywords: ['celebrate'] },
  { value: '👏', label: 'Clapping hands', keywords: ['applause'] },
  { value: '🙏', label: 'Folded hands', keywords: ['please', 'thanks'] },
  { value: '👍', label: 'Thumbs up', keywords: ['approve'] },
  { value: '👎', label: 'Thumbs down', keywords: ['disapprove'] },
  { value: '✌️', label: 'Victory hand', keywords: ['peace'] },
  { value: '🤝', label: 'Handshake emoji', keywords: ['deal'] },
  { value: '💪', label: 'Flexed biceps', keywords: ['strength'] },
  { value: '💼', label: 'Briefcase emoji', keywords: ['business'] },
  { value: '💰', label: 'Money bag', keywords: ['finance'] },
  { value: '💳', label: 'Credit card', keywords: ['payment'] },
  { value: '📈', label: 'Chart increasing', keywords: ['growth'] },
  { value: '📉', label: 'Chart decreasing', keywords: ['decline'] },
  { value: '📊', label: 'Bar chart', keywords: ['analytics'] },
  { value: '📋', label: 'Clipboard emoji', keywords: ['tasks'] },
  { value: '📌', label: 'Pushpin', keywords: ['pin'] },
  { value: '📍', label: 'Round pushpin', keywords: ['location'] },
  { value: '📎', label: 'Paperclip', keywords: ['attach'] },
  { value: '📁', label: 'File folder', keywords: ['files'] },
  { value: '📂', label: 'Open folder', keywords: ['files'] },
  { value: '🗂️', label: 'Card index dividers', keywords: ['organize'] },
  { value: '📝', label: 'Memo', keywords: ['note'] },
  { value: '📅', label: 'Calendar emoji', keywords: ['schedule'] },
  { value: '📆', label: 'Tear-off calendar', keywords: ['schedule'] },
  { value: '📞', label: 'Telephone receiver', keywords: ['phone'] },
  { value: '📠', label: 'Fax machine', keywords: ['fax'] },
  { value: '📧', label: 'Email emoji', keywords: ['mail'] },
  { value: '📨', label: 'Incoming envelope', keywords: ['mail'] },
  { value: '📮', label: 'Postbox', keywords: ['mail'] },
  { value: '💬', label: 'Speech bubble emoji', keywords: ['chat'] },
  { value: '🗨️', label: 'Left speech bubble', keywords: ['chat'] },
  { value: '💭', label: 'Thought balloon', keywords: ['thought'] },
  { value: '🕑', label: 'Clock face', keywords: ['time'] },
  { value: '🕒', label: 'Clock face three', keywords: ['time'] },
  { value: '🕓', label: 'Clock face four', keywords: ['time'] },
  { value: '🛎️', label: 'Service bell', keywords: ['notification'] },
  { value: '📣', label: 'Megaphone emoji', keywords: ['announcement'] },
  { value: '📢', label: 'Loudspeaker', keywords: ['announcement'] },
  { value: '🎁', label: 'Gift', keywords: ['reward'] },
  { value: '🎉', label: 'Party popper', keywords: ['celebration'] },
  { value: '🏆', label: 'Trophy emoji', keywords: ['winner'] },
  { value: '⚙️', label: 'Gear', keywords: ['settings'] },
  { value: '🔒', label: 'Lock emoji', keywords: ['secure'] },
  { value: '🔑', label: 'Key', keywords: ['access'] },
  { value: '📡', label: 'Satellite antenna', keywords: ['signal'] },
  { value: '📶', label: 'Signal strength', keywords: ['signal'] },
  { value: '🧭', label: 'Compass emoji', keywords: ['direction'] },
  { value: '🧠', label: 'Brain emoji', keywords: ['intelligence'] },
  { value: '🛠️', label: 'Hammer and wrench', keywords: ['tools'] },
  { value: '🧰', label: 'Toolbox', keywords: ['tools'] },
  { value: '💎', label: 'Gem stone', keywords: ['premium'] },
  { value: '🪙', label: 'Coin', keywords: ['money'] },
  { value: '🧾', label: 'Receipt', keywords: ['invoice'] },
  { value: '🛰️', label: 'Satellite', keywords: ['tech'] },
]

function mergeIconOptions(base: IconOption[], additions: IconOption[]): IconOption[] {
  const seen = new Set(base.map((option) => option.value))
  const merged = [...base]
  for (const option of additions) {
    if (seen.has(option.value)) continue
    merged.push(option)
    seen.add(option.value)
  }
  return merged
}

export const ICON_LIBRARY: IconOption[] = mergeIconOptions(ICON_SUGGESTIONS, [
  ...LUCIDE_ICON_LIBRARY_FROM_PACKAGE,
  ...EXTRA_EMOJI_ICON_LIBRARY,
])

export function extractLucideSlug(icon: string | null | undefined): string | null {
  if (!icon) return null
  if (!icon.startsWith('lucide:')) return null
  const slug = icon.slice('lucide:'.length)
  return slug.length ? slug : null
}

export function renderDictionaryIcon(icon: string | null | undefined, className = 'h-4 w-4'): React.ReactNode {
  if (!icon) return null
  const slug = extractLucideSlug(icon)
  if (slug) {
    return <DynamicIcon name={slug as (typeof iconNames)[number]} className={className} aria-hidden />
  }
  return <span className="text-base">{icon}</span>
}

export function renderDictionaryColor(color: string | null | undefined, className = 'h-4 w-4 rounded'): React.ReactNode {
  if (!color) return null
  return (
    <span
      className={`inline-flex border border-border ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

const LEGACY_LUCIDE_PASCAL = /^[A-Z][a-zA-Z0-9]*$/

/**
 * Renders a dictionary icon token (lucide:, emoji), including legacy PascalCase lucide exports.
 * Kept for parity with search combobox / migrations that stored old icon names.
 */
export function renderDictionarySourceIcon(icon: string | null | undefined, className: string): React.ReactNode {
  const trimmed = icon?.trim() ?? ''
  if (!trimmed.length) return null
  if (extractLucideSlug(trimmed)) {
    const rendered = renderDictionaryIcon(trimmed, className)
    if (rendered) return rendered
  }
  const map = LucideIcons as unknown as Record<string, LucideIcon>
  if (LEGACY_LUCIDE_PASCAL.test(trimmed) && map[trimmed]) {
    const Cmp = map[trimmed]!
    return <Cmp className={className} aria-hidden />
  }
  return renderDictionaryIcon(trimmed, className)
}

export type DictionaryAppearancePreviewProps = {
  color?: string | null
  icon?: string | null
  label: React.ReactNode
  className?: string
  /** Applied to the color swatch when `color` is set. */
  colorClassName?: string
  iconWrapperClassName?: string
  iconClassName?: string
  labelClassName?: string
}

/**
 * Dictionary / catalog row: **color → icon → label** only for props that are set.
 * Relational options with neither color nor icon render as **label only** (no leading gaps).
 */
export function DictionaryAppearancePreview({
  color,
  icon,
  label,
  className,
  colorClassName,
  iconWrapperClassName = 'inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground',
  iconClassName = 'size-4',
  labelClassName,
}: DictionaryAppearancePreviewProps) {
  const raw = color?.trim()
  const iconRaw = icon?.trim()
  const hasColor = Boolean(raw)
  const hasIcon = Boolean(iconRaw)
  const swatchDims = colorClassName ?? 'h-3 w-3 rounded-sm'
  /** Align with icon slot (typ. h-6) so rows with/without color share the same row height in detail grids. */
  const rowMin = 'inline-flex min-h-6 min-w-0 items-center gap-2'

  if (!hasColor && !hasIcon) {
    return (
      <span className={cn(rowMin, 'flex-1 truncate', labelClassName, className)}>
        {label}
      </span>
    )
  }

  return (
    <span className={cn(rowMin, className)}>
      {hasColor ? (
        <span className="inline-flex h-6 w-4 shrink-0 items-center justify-center">
          {renderDictionaryColor(raw, swatchDims)}
        </span>
      ) : null}
      {hasIcon ? (
        <span className={cn(iconWrapperClassName)}>{renderDictionarySourceIcon(iconRaw, iconClassName)}</span>
      ) : null}
      <span className={cn('min-w-0 flex-1 truncate', labelClassName)}>{label}</span>
    </span>
  )
}

export function normalizeDictionaryEntries(items: unknown): DictionaryDisplayEntry[] {
  if (!Array.isArray(items)) return []
  const entries: DictionaryDisplayEntry[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Record<string, unknown>
    const rawValue = typeof candidate.value === 'string' ? candidate.value.trim() : ''
    if (!rawValue) continue
    const label =
      typeof candidate.label === 'string' && candidate.label.trim().length ? candidate.label.trim() : rawValue
    const color =
      typeof candidate.color === 'string' && /^#([0-9a-fA-F]{6})$/.test(candidate.color)
        ? `#${candidate.color.slice(1).toLowerCase()}`
        : null
    const icon = typeof candidate.icon === 'string' && candidate.icon.trim().length ? candidate.icon.trim() : null
    entries.push({ value: rawValue, label, color, icon })
  }
  return entries.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
}

export function createDictionaryMap(entries: DictionaryDisplayEntry[]): DictionaryMap {
  return entries.reduce<DictionaryMap>((acc, entry) => {
    acc[entry.value] = entry
    return acc
  }, {})
}

type DictionaryValueProps = {
  value: string | null | undefined
  map?: DictionaryMap | null
  fallback?: React.ReactNode
  className?: string
  iconWrapperClassName?: string
  iconClassName?: string
  colorClassName?: string
}

export function DictionaryValue({
  value,
  map,
  fallback = null,
  className,
  iconWrapperClassName,
  iconClassName = 'size-4',
  colorClassName = 'h-3 w-3 rounded-sm',
}: DictionaryValueProps): React.ReactNode {
  if (!value) return fallback ?? null
  const entry = map?.[value]
  if (!entry) {
    return <span className={className}>{value}</span>
  }
  return (
    <DictionaryAppearancePreview
      color={entry.color}
      icon={entry.icon}
      label={entry.label}
      className={className}
      colorClassName={colorClassName}
      iconWrapperClassName={iconWrapperClassName}
      iconClassName={iconClassName}
    />
  )
}
