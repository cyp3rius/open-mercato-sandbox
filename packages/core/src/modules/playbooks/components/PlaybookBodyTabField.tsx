'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { PlaybookMarkdownEditor } from './PlaybookMarkdownEditor'
import { usePlaybookFormTabOptional } from './PlaybookFormTabContext'
import type { PlaybookFormTranslator } from './playbookFormConfig'

export function buildPlaybookBodyTabField(t: PlaybookFormTranslator): (props: CrudCustomFieldRenderProps) => React.ReactNode {
  return function PlaybookBodyTabField(props: CrudCustomFieldRenderProps) {
    const { value, setValue, disabled, error } = props
    const tabCtx = usePlaybookFormTabOptional()
    const hideDetails = tabCtx != null && tabCtx.activeTab === 'steps'
    return (
      <div className={cn('space-y-1.5', hideDetails && 'hidden')}>
        <label className="block text-sm font-medium">
          {t('playbooks.form.body', 'Body')}
          <span className="text-red-600"> *</span>
        </label>
        <PlaybookMarkdownEditor
          value={typeof value === 'string' ? value : ''}
          onChange={(md) => setValue(md)}
          disabled={disabled}
          height={220}
        />
        {error ? <div className="text-xs text-red-600">{error}</div> : null}
      </div>
    )
  }
}
