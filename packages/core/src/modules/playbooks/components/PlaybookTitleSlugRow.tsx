'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS, type CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { resolveUniquePlaybookSlug } from '../lib/resolveUniquePlaybookSlug'
import { usePlaybookFormTabOptional } from './PlaybookFormTabContext'
import type { PlaybookFormTranslator } from './playbookFormConfig'

export function buildPlaybookTitleSlugRow(
  t: PlaybookFormTranslator,
): (props: CrudCustomFieldRenderProps) => React.ReactNode {
  return function PlaybookTitleSlugRow(props: CrudCustomFieldRenderProps) {
    const { values, setFormValue, disabled, autoFocus, recordId } = props
    const title = typeof values?.title === 'string' ? values.title : ''
    const slug = typeof values?.slug === 'string' ? values.slug : ''
    const [slugBusy, setSlugBusy] = React.useState(false)
    const tabCtx = usePlaybookFormTabOptional()
    const hideDetails = tabCtx != null && tabCtx.activeTab === 'steps'

    const applySlugFromTitle = React.useCallback(async () => {
      if (typeof setFormValue !== 'function' || slugBusy) return
      setSlugBusy(true)
      try {
        const next = await resolveUniquePlaybookSlug(title, {
          currentRecordId: typeof recordId === 'string' ? recordId : undefined,
        })
        setFormValue('slug', next)
      } finally {
        setSlugBusy(false)
      }
    }, [setFormValue, slugBusy, title, recordId])

    return (
      <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end md:gap-5', hideDetails && 'hidden')}>
        <div className="md:col-span-2 space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="playbook-form-title">
            {t('playbooks.form.title', 'Title')}
            <span className="text-red-600"> *</span>
          </label>
          <input
            id="playbook-form-title"
            className={CRUD_FORM_TEXT_INPUT_CLASS}
            value={title}
            onChange={(e) => {
              if (typeof setFormValue === 'function') {
                setFormValue('title', e.target.value)
              }
            }}
            disabled={disabled}
            autoFocus={autoFocus}
            data-crud-focus-target=""
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" htmlFor="playbook-form-slug">
            {t('playbooks.form.slug', 'Slug')}
            <span className="text-red-600"> *</span>
          </label>
          <div
            className={cn(
              'flex h-9 w-full min-w-0 overflow-hidden rounded-md border border-input bg-background',
              'focus-within:ring-2 focus-within:ring-ring/40',
            )}
          >
            <input
              id="playbook-form-slug"
              className="h-9 min-w-0 flex-1 border-0 bg-transparent px-2 text-sm shadow-none outline-none focus-visible:ring-0"
              value={slug}
              onChange={(e) => {
                if (typeof setFormValue === 'function') {
                  setFormValue('slug', e.target.value)
                }
              }}
              disabled={disabled}
              autoComplete="off"
              data-crud-focus-target=""
            />
            <IconButton
              type="button"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-none border-0 border-l border-input text-muted-foreground shadow-none hover:bg-muted/60"
              disabled={disabled || slugBusy}
              title={t('playbooks.form.slugRegenerate', 'Generate slug from title')}
              aria-label={t('playbooks.form.slugRegenerate', 'Generate slug from title')}
              onClick={() => void applySlugFromTitle()}
            >
              <RefreshCw className={cn('size-4', slugBusy && 'animate-spin')} />
            </IconButton>
          </div>
        </div>
      </div>
    )
  }
}
