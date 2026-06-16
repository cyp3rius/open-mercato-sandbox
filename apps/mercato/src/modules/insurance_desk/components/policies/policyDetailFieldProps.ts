import type { Dispatch, SetStateAction } from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'

export function makePolicyDetailFieldProps(
  form: Record<string, unknown> | null,
  setForm: Dispatch<SetStateAction<Record<string, unknown> | null>>,
  fieldId: string,
): CrudCustomFieldRenderProps {
  const values = form ?? {}
  return {
    id: fieldId,
    value: values[fieldId],
    setValue: (v) => setForm((current) => (current ? { ...current, [fieldId]: v } : current)),
    setFormValue: (id, v) => setForm((current) => (current ? { ...current, [id]: v } : current)),
    values,
    entityId: 'insurance_desk:policy-detail',
  }
}
