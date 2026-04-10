import type { Dispatch, SetStateAction } from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'

export function makePolicyDetailFieldProps(
  form: Record<string, unknown>,
  setForm: Dispatch<SetStateAction<Record<string, unknown>>>,
  fieldId: string,
): CrudCustomFieldRenderProps {
  return {
    id: fieldId,
    value: form[fieldId],
    setValue: (v) => setForm((f) => ({ ...f, [fieldId]: v })),
    setFormValue: (id, v) => setForm((f) => ({ ...f, [id]: v })),
    values: form,
    entityId: 'insurance_desk:policy-detail',
  }
}
