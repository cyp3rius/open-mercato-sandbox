'use client'

import * as React from 'react'
import { z } from 'zod'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import {
  remoteSearchPlaybooksForCase,
  resolvePlaybookTitleVersion,
} from '@open-mercato/core/modules/cases/lib/caseRelationsSearch'
import { formatProcedurePlaybookLabel } from '@open-mercato/core/modules/cases/lib/formatProcedurePlaybookLabel'

export type PlaybookSearchFieldProps = {
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
  placeholder?: string
  createInNewTabAriaLabel?: string
  className?: string
}

export function PlaybookSearchField({
  value,
  onChange,
  disabled,
  placeholder,
  createInNewTabAriaLabel,
  className,
}: PlaybookSearchFieldProps) {
  const t = useT()
  const playbookId = typeof value === 'string' ? value : ''
  const [playbookLabel, setPlaybookLabel] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    if (
      !playbookId.trim().length ||
      !z.string().uuid().safeParse(playbookId.trim()).success
    ) {
      setPlaybookLabel('')
      return
    }
    void resolvePlaybookTitleVersion(playbookId.trim()).then((row) => {
      if (!cancelled) {
        setPlaybookLabel(
          row ? formatProcedurePlaybookLabel(row.title, row.version, t) : '',
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [playbookId, t])

  const resolvedMergeLabel = playbookLabel.trim().length
    ? playbookLabel
    : playbookId

  return (
    <EntitySearchCombobox
      value={playbookId}
      onChange={(next) => onChange(next.trim().length ? next.trim() : null)}
      options={mergeEntitySearchOption([], playbookId, resolvedMergeLabel)}
      onRemoteSearch={async (query) => {
        const rows = await remoteSearchPlaybooksForCase(query, (title, version) =>
          formatProcedurePlaybookLabel(title, version ?? null, t),
        )
        return mergeEntitySearchOption(rows, playbookId, resolvedMergeLabel)
      }}
      placeholder={
        placeholder ??
        t('cases.form.procedure.playbookSearch', 'Search procedures…')
      }
      disabled={disabled}
      createInNewTabHref="/backend/playbooks/create"
      createInNewTabAriaLabel={
        createInNewTabAriaLabel ??
        t(
          'cases.form.procedure.openNewPlaybookTab',
          'Open new procedure in a new tab',
        )
      }
      className={className}
    />
  )
}
