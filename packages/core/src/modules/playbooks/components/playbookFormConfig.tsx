'use client'

import * as React from 'react'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudField,
  type CrudFormGroup,
} from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  resolveUserDisplayLabel,
} from '../../procurement/lib/procurementEntitySearch'
import { procedureBlocksArraySchema, parseProcedureBlocksJson, type ProcedureBlock } from '../lib/procedureBlocks'
import { procedureDurationSchema, type ProcedureDuration } from '../lib/duration'
import { buildPlaybookTitleSlugRow } from './PlaybookTitleSlugRow'
import { buildPlaybookProcedureStatusField } from './PlaybookProcedureStatusField'
import { buildPlaybookBodyTabField } from './PlaybookBodyTabField'
import { buildPlaybookProcedureDefinitionField } from './PlaybookProcedureStepsEditor'
import { buildPlaybookFormTabList } from './PlaybookFormTabList'
import { parsePlaybookBooleanField } from '../lib/playbookFields'

export type PlaybookFormTranslator = (key: string, fallback?: string) => string

export { parsePlaybookBooleanField }

export type PlaybookFormValues = {
  id?: string
  title: string
  slug: string
  body: string
  procedureDefinition: ProcedureBlock[]
  contextTags: string[]
  audience: 'internal' | 'customer_facing' | 'both'
  version: number
  isActive: boolean
  recommendedOwnerUserIds: string[]
  defaultSlaDuration: ProcedureDuration | null
}

export function playbookFormSchema() {
  return z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1).max(500),
    slug: z.string().min(1).max(160),
    body: z.string().max(100000),
    procedureDefinition: procedureBlocksArraySchema.default([]),
    contextTags: z.array(z.string()).default([]),
    audience: z.enum(['internal', 'customer_facing', 'both']),
    version: z.coerce.number().int().min(0),
    isActive: z.boolean(),
    recommendedOwnerUserIds: z.array(z.string().uuid()),
    defaultSlaDuration: procedureDurationSchema.nullable(),
  })
}

export function defaultPlaybookFormValues(): PlaybookFormValues {
  return {
    slug: '',
    title: '',
    body: '',
    procedureDefinition: [],
    contextTags: [],
    audience: 'internal',
    version: 0,
    isActive: true,
    recommendedOwnerUserIds: [],
    defaultSlaDuration: null,
  }
}

function pickContextTags(row: { contextTags?: unknown; context_tags?: unknown }): string[] {
  const raw = row.contextTags ?? row.context_tags
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x)).filter(Boolean)
}

export function rowToPlaybookFormValues(row: {
  id?: string | null
  slug: string
  title: string
  body?: string | null
  procedureDefinition?: unknown
  procedure_definition?: unknown
  contextTags?: string[] | null
  context_tags?: string[] | null
  audience?: string | null
  version?: number | null
  isActive?: boolean | null
  is_active?: boolean | null
  recommendedOwnerUserIds?: string[] | null
  recommended_owner_user_ids?: string[] | null
  defaultSlaDuration?: ProcedureDuration | null
  default_sla_duration?: ProcedureDuration | null
}): PlaybookFormValues {
  const aud = row.audience === 'customer_facing' || row.audience === 'both' ? row.audience : 'internal'
  const procRaw = row.procedureDefinition ?? row.procedure_definition
  const resolvedActive = parsePlaybookBooleanField(row.isActive, row.is_active)
  const out: PlaybookFormValues = {
    slug: row.slug,
    title: row.title,
    body: row.body ?? '',
    procedureDefinition: parseProcedureBlocksJson(procRaw),
    contextTags: pickContextTags(row),
    audience: aud,
    version: typeof row.version === 'number' ? row.version : 0,
    isActive: resolvedActive === undefined ? true : resolvedActive,
    recommendedOwnerUserIds: Array.isArray(
      row.recommendedOwnerUserIds ?? row.recommended_owner_user_ids,
    )
      ? [...(row.recommendedOwnerUserIds ?? row.recommended_owner_user_ids ?? [])]
      : [],
    defaultSlaDuration: row.defaultSlaDuration ?? row.default_sla_duration ?? null,
  }
  if (typeof row.id === 'string' && row.id.length) out.id = row.id
  return out
}

export function buildPlaybookFormFields(t: PlaybookFormTranslator): CrudField[] {
  return [
    {
      id: 'titleSlugRow',
      type: 'custom',
      label: '',
      layout: 'full',
      component: buildPlaybookTitleSlugRow(t),
    },
    {
      id: 'body',
      type: 'custom',
      label: '',
      required: true,
      layout: 'full',
      component: buildPlaybookBodyTabField(t),
    },
    {
      id: 'procedureDefinition',
      type: 'custom',
      label: '',
      layout: 'full',
      component: buildPlaybookProcedureDefinitionField(t),
    },
    {
      id: 'contextTags',
      type: 'custom',
      label: t('playbooks.form.contextTags', 'Context tags'),
      layout: 'full',
      component: buildPlaybookProcedureStatusField(t),
    },
    {
      id: 'recommendedOwnerUserIds',
      type: 'custom',
      label: t('playbooks.form.recommendedOwners', 'Recommended owners'),
      layout: 'full',
      component: ({ value, setValue, disabled, error }) => {
        const selected = Array.isArray(value)
          ? value.filter((entry): entry is string => typeof entry === 'string')
          : []
        const [labels, setLabels] = React.useState<Record<string, string>>({})

        React.useEffect(() => {
          let cancelled = false
          void Promise.all(
            selected
              .filter((id) => !labels[id])
              .map(async (id) => [id, (await resolveUserDisplayLabel(id)) ?? id] as const),
          ).then((resolved) => {
            if (!cancelled && resolved.length) {
              setLabels((current) => ({
                ...current,
                ...Object.fromEntries(resolved),
              }))
            }
          })
          return () => {
            cancelled = true
          }
        }, [labels, selected])

        return (
          <div className="space-y-2">
            {selected.length ? (
              <div className="flex flex-wrap gap-2">
                {selected.map((userId, index) => (
                  <span
                    key={userId}
                    className="inline-flex max-w-full items-center gap-1 rounded-md border border-input bg-muted/40 px-2 py-1 text-xs"
                  >
                    <span className="truncate">
                      {index + 1}. {labels[userId] ?? userId}
                    </span>
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="h-auto shrink-0"
                      disabled={disabled}
                      aria-label={t('playbooks.form.recommendedOwnersRemove', 'Remove recommended owner')}
                      onClick={() => setValue(selected.filter((entry) => entry !== userId))}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </span>
                ))}
              </div>
            ) : null}
            <EntitySearchCombobox
              key={`recommended-owner-${selected.length}`}
              value=""
              onChange={(next) => {
                const userId = next.trim()
                if (!userId || selected.includes(userId)) return
                setValue([...selected, userId])
              }}
              options={mergeEntitySearchOption([], '', '')}
              onRemoteSearch={async (query) => {
                const options = (await remoteSearchAuthUsers(query)).filter(
                  (option) => !selected.includes(option.value),
                )
                setLabels((current) => ({
                  ...current,
                  ...Object.fromEntries(options.map((option) => [option.value, option.label])),
                }))
                return options
              }}
              placeholder={t('playbooks.form.recommendedOwnersPlaceholder', 'Add a recommended owner…')}
              searchPlaceholder={t('playbooks.form.recommendedOwnersSearch', 'Search users…')}
              disabled={disabled}
              createInNewTabHref="/backend/users/create"
              createInNewTabAriaLabel={t(
                'playbooks.form.recommendedOwnersAddUser',
                'Create user in a new tab',
              )}
            />
            {error ? <div className="text-xs text-red-600">{error}</div> : null}
          </div>
        )
      },
    },
    {
      id: 'defaultSlaDuration',
      type: 'custom',
      label: t('playbooks.form.defaultSla', 'Default SLA'),
      layout: 'full',
      component: ({ value, setValue, disabled, error }) => {
        const duration =
          value && typeof value === 'object'
            ? (value as Partial<ProcedureDuration>)
            : null
        const amount = typeof duration?.amount === 'number' ? duration.amount : ''
        const unit = duration?.unit ?? 'days'
        return (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('playbooks.form.durationAmount', 'Amount')}</Label>
              <input
                type="number"
                min={1}
                step={1}
                className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'w-full')}
                value={amount}
                onChange={(event) => {
                  const raw = event.target.value
                  setValue(raw ? { amount: Number(raw), unit } : null)
                }}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t('playbooks.form.durationUnit', 'Unit')}</Label>
              <select
                className={cn(CRUD_FORM_SELECT_CLASS, 'w-full')}
                value={unit}
                onChange={(event) => {
                  if (amount === '') return
                  setValue({
                    amount,
                    unit: event.target.value as ProcedureDuration['unit'],
                  })
                }}
                disabled={disabled || amount === ''}
              >
                <option value="hours">{t('playbooks.duration.hours', 'Hours')}</option>
                <option value="days">{t('playbooks.duration.days', 'Days')}</option>
                <option value="weeks">{t('playbooks.duration.weeks', 'Weeks')}</option>
                <option value="months">{t('playbooks.duration.months', 'Months')}</option>
              </select>
            </div>
            {error ? <div className="text-xs text-red-600 sm:col-span-2">{error}</div> : null}
          </div>
        )
      },
    },
    {
      id: 'audience',
      type: 'select',
      label: t('playbooks.form.audience', 'Audience'),
      required: true,
      layout: 'full',
      options: [
        { value: 'internal', label: t('playbooks.form.audienceInternal', 'Internal') },
        { value: 'customer_facing', label: t('playbooks.form.audienceCustomer', 'Customer-facing') },
        { value: 'both', label: t('playbooks.form.audienceBoth', 'Both') },
      ],
    },
    {
      id: 'version',
      type: 'number',
      label: t('playbooks.form.version', 'Version'),
      description: t(
        'playbooks.form.versionHint',
        'Increases automatically when you change procedure content; older versions stay linked to cases that already used them.',
      ),
      required: true,
      disabled: true,
      layout: 'full',
    },
    {
      id: 'isActive',
      type: 'checkbox',
      label: t('playbooks.form.isActive', 'Active'),
      layout: 'full',
    },
  ]
}

export function buildPlaybookFormGroups(t: PlaybookFormTranslator): CrudFormGroup[] {
  return [
    {
      id: 'playbookTabs',
      column: 1,
      bare: true,
      component: buildPlaybookFormTabList(t),
    },
    {
      id: 'playbookMain',
      column: 1,
      fields: ['titleSlugRow', 'body', 'procedureDefinition'],
    },
    {
      id: 'settings',
      title: t('playbooks.form.groups.settings', 'Settings'),
      column: 2,
      fields: [
        'contextTags',
        'recommendedOwnerUserIds',
        'defaultSlaDuration',
        'audience',
        'version',
        'isActive',
      ],
    },
  ]
}
