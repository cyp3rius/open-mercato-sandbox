'use client'

import * as React from 'react'
import type { CrudCustomFieldRenderProps, CrudField } from '../CrudForm'

/**
 * Invisible CrudForm field that exposes `setFormValue` to a ref so parent toolbars
 * (e.g. “sync from registry”) can patch many fields at once.
 */
export function createCrudFormApplyPatchBridgeField(
  applyRef: React.MutableRefObject<((patch: Record<string, unknown>) => void) | null>,
  options?: { fieldId?: string },
): CrudField {
  const fieldId = options?.fieldId ?? '__crudFormApplyPatch'
  return {
    id: fieldId,
    label: '',
    type: 'custom',
    layout: 'full',
    component: ({ setFormValue }: CrudCustomFieldRenderProps) => {
      React.useEffect(() => {
        applyRef.current = (patch) => {
          for (const [key, value] of Object.entries(patch)) {
            setFormValue?.(key, value)
          }
        }
        return () => {
          applyRef.current = null
        }
      }, [setFormValue])
      return null
    },
  }
}
