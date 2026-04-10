"use client"

import * as React from 'react'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { InsurerContactSelectField } from './InsurerContactSelectField'

/**
 * Wraps the contact select with a key derived from the selected insurer so the field
 * remounts when the insurer changes and contact options reload reliably (CrudForm FieldControl memo).
 */
export function PolicyInsurerContactField(props: CrudCustomFieldRenderProps) {
  const raw = props.values?.insurerId
  const insurerKey = typeof raw === 'string' ? raw.trim() : ''
  return <InsurerContactSelectField key={insurerKey.length ? insurerKey : 'none'} {...props} />
}
