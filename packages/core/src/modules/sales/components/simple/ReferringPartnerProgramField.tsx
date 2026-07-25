'use client'

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'

type MembershipOption = {
  programId: string
  programName: string
  incentivePercent: string | number | null
}

type ReferringPartnerProgramFieldProps = {
  value: unknown
  setValue: (next: unknown) => void
  partnerEntityId: string
  disabled?: boolean
  i18nPrefix: string
  t: (key: string, fallback?: string) => string
}

export function ReferringPartnerProgramField({
  value,
  setValue,
  partnerEntityId,
  disabled,
  i18nPrefix,
  t,
}: ReferringPartnerProgramFieldProps) {
  const [options, setOptions] = React.useState<MembershipOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const selected = typeof value === 'string' ? value : ''
  const partnerId = partnerEntityId.trim()

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      if (!partnerId) {
        setOptions([])
        if (selected) setValue('')
        return
      }
      setLoading(true)
      try {
        const call = await apiCall<{
          items?: Array<{
            programId?: string | null
            programName?: string | null
            incentivePercent?: string | number | null
          }>
        }>(
          `/api/partner_programs/memberships?customerEntityId=${encodeURIComponent(partnerId)}`,
        )
        if (cancelled) return
        const items = Array.isArray(call.result?.items) ? call.result.items : []
        const mapped: MembershipOption[] = items
          .filter((row) => typeof row.programId === 'string' && row.programId.trim().length)
          .map((row) => ({
            programId: String(row.programId),
            programName:
              typeof row.programName === 'string' && row.programName.trim().length
                ? row.programName
                : String(row.programId),
            incentivePercent: row.incentivePercent ?? null,
          }))
        setOptions(mapped)
        if (mapped.length === 1) {
          if (selected !== mapped[0].programId) setValue(mapped[0].programId)
        } else if (mapped.length === 0) {
          if (selected) setValue('')
        } else if (selected && !mapped.some((row) => row.programId === selected)) {
          setValue('')
        }
      } catch {
        if (!cancelled) {
          setOptions([])
          if (selected) setValue('')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- partner-driven reload
  }, [partnerId, setValue])

  // No partner → no program field. Exactly one membership → auto-filled, hide picker.
  if (!partnerId || options.length === 1) {
    return null
  }

  if (options.length === 0) {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium">
          {t(`${i18nPrefix}.fields.referringPartnerProgram`, 'Partner program')}
          <span className="text-destructive"> *</span>
        </label>
        <p className="text-sm text-muted-foreground">
          {loading
            ? t(`${i18nPrefix}.fields.referringPartnerProgramLoading`, 'Loading programs…')
            : t(
                `${i18nPrefix}.errors.referringPartnerNoPrograms`,
                'This partner has no program membership. Clear the referring party, or add them to a partner program first.',
              )}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {t(`${i18nPrefix}.fields.referringPartnerProgram`, 'Partner program')}
        <span className="text-destructive"> *</span>
      </label>
      <select
        className={CRUD_FORM_TEXT_INPUT_CLASS}
        value={selected}
        disabled={disabled || loading}
        onChange={(ev) => setValue(ev.target.value)}
        required
      >
        <option value="">
          {t(
            `${i18nPrefix}.fields.referringPartnerProgramPlaceholder`,
            'Select partner program…',
          )}
        </option>
        {options.map((row) => {
          const pct =
            row.incentivePercent != null && String(row.incentivePercent).length
              ? ` (${String(row.incentivePercent)}%)`
              : ''
          return (
            <option key={row.programId} value={row.programId}>
              {row.programName}
              {pct}
            </option>
          )
        })}
      </select>
    </div>
  )
}
