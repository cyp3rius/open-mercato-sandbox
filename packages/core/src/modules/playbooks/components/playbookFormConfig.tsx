'use client'

import { z } from 'zod'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { procedureBlocksArraySchema, parseProcedureBlocksJson, type ProcedureBlock } from '../lib/procedureBlocks'
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
      fields: ['contextTags', 'audience', 'version', 'isActive'],
    },
  ]
}
