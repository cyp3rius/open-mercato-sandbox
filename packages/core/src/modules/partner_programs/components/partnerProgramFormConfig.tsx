'use client'

import { z } from 'zod'
import type { CrudField, CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { PartnerIncentiveCombinedField } from './PartnerIncentiveCombinedField'
import type { PartnerIncentiveBase } from './PartnerIncentiveBaseRadioGroup'

export type PartnerProgramCreateFormValues = {
  name: string
  description: string
  validFrom: string
  validTo: string
  isActive: boolean
  incentivePercent: string
  incentiveBase: PartnerIncentiveBase
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
    incentivePercent: z
      .string()
      .refine((s) => {
        const n = Number(s)
        return Number.isFinite(n) && n >= 0 && n <= 100
      }, {
        message: t(
          'partner_programs.form.errors.incentivePercentInvalid',
          'Incentive percent must be between 0 and 100.',
        ),
      }),
    incentiveBase: z.enum(['net', 'gross']),
  })
}

export function defaultPartnerProgramCreateValues(): PartnerProgramCreateFormValues {
  return {
    name: '',
    description: '',
    validFrom: '',
    validTo: '',
    isActive: true,
    incentivePercent: '0',
    incentiveBase: 'net',
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
      id: 'incentivePercent',
      type: 'custom',
      label: t('partner_programs.form.incentivePercent', 'Incentive %'),
      required: true,
      layout: 'third',
      description: t(
        'partner_programs.form.incentivePercentHint',
        'Percent of referring order grand total credited to the partner.',
      ),
      component: ({ value, setValue, setFormValue, disabled, values }) => {
        const percent = typeof value === 'string' ? value : String(value ?? '0')
        const baseRaw = values?.incentiveBase
        const base: PartnerIncentiveBase = baseRaw === 'gross' ? 'gross' : 'net'
        return (
          <PartnerIncentiveCombinedField
            percent={percent}
            onPercentChange={(next) => setValue(next)}
            base={base}
            onBaseChange={(next) => setFormValue?.('incentiveBase', next)}
            disabled={disabled}
            showLabels={false}
            percentLabel={t('partner_programs.form.incentivePercent', 'Incentive %')}
            baseLabel={t('partner_programs.form.incentiveBase', 'Calculate from')}
            netLabel={t('partner_programs.form.incentiveBaseNet', 'Net')}
            grossLabel={t('partner_programs.form.incentiveBaseGross', 'Gross')}
          />
        )
      },
    },
    {
      id: 'validFrom',
      type: 'datetime-local',
      label: t('partner_programs.form.validFrom', 'Valid from'),
      layout: 'third',
    },
    {
      id: 'validTo',
      type: 'datetime-local',
      label: t('partner_programs.form.validTo', 'Valid to'),
      layout: 'third',
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
      fields: ['name', 'description', 'incentivePercent', 'validFrom', 'validTo', 'isActive'],
    },
  ]
}
