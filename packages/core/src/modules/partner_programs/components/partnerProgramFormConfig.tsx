'use client'

import { z } from 'zod'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'

export type PartnerProgramCreateFormValues = {
  name: string
  description: string
  validFrom: string
  validTo: string
  isActive: boolean
}

export type PartnerProgramFormTranslator = (key: string, fallback?: string) => string

export function partnerProgramCreateFormSchema(t: PartnerProgramFormTranslator) {
  return z.object({
    name: z.string().refine((s) => s.trim().length > 0, {
      message: t('partner_programs.form.errors.nameRequired', 'Name is required.'),
    }),
    description: z.string(),
    validFrom: z.string(),
    validTo: z.string(),
    isActive: z.boolean(),
  })
}

export function defaultPartnerProgramCreateValues(): PartnerProgramCreateFormValues {
  return {
    name: '',
    description: '',
    validFrom: '',
    validTo: '',
    isActive: true,
  }
}

export function buildPartnerProgramCreateFormFields(t: PartnerProgramFormTranslator): CrudField[] {
  return [
    {
      id: 'name',
      type: 'text',
      label: t('partner_programs.form.name', 'Name'),
      required: true,
      layout: 'full',
    },
    {
      id: 'description',
      type: 'textarea',
      label: t('partner_programs.form.description', 'Description'),
      layout: 'full',
    },
    {
      id: 'validFrom',
      type: 'datetime-local',
      label: t('partner_programs.form.validFrom', 'Valid from'),
      layout: 'half',
    },
    {
      id: 'validTo',
      type: 'datetime-local',
      label: t('partner_programs.form.validTo', 'Valid to'),
      layout: 'half',
    },
    {
      id: 'isActive',
      type: 'checkbox',
      label: t('partner_programs.form.isActive', 'Active'),
      layout: 'full',
    },
  ]
}

export function buildPartnerProgramCreateFormGroups(t: PartnerProgramFormTranslator): CrudFormGroup[] {
  return [
    {
      id: 'basics',
      title: t('partner_programs.form.groups.basics', 'Basics'),
      column: 1,
      fields: ['name', 'description', 'validFrom', 'validTo', 'isActive'],
    },
  ]
}
