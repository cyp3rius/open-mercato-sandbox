'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { BankAccountLookupResult } from '../lib/bankAccountLookup'

type Props = {
  accountNumber: string
  disabled?: boolean
}

export function BankAccountValidationHints(props: Props) {
  const { accountNumber, disabled } = props
  const t = useT()
  const [pending, setPending] = React.useState(false)
  const [result, setResult] = React.useState<BankAccountLookupResult | null>(null)

  React.useEffect(() => {
    const raw = accountNumber.trim()
    if (raw.length < 8) {
      setResult(null)
      setPending(false)
      return
    }
    if (disabled) {
      setResult(null)
      setPending(false)
      return
    }

    let cancelled = false
    setPending(true)
    const handle = window.setTimeout(() => {
      void (async () => {
        const call = await apiCall<BankAccountLookupResult>('/api/accounting/bank-account-lookup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ accountNumber: raw }),
        })
        if (cancelled) return
        setPending(false)
        if (!call.ok || !call.result || typeof call.result !== 'object') {
          setResult(null)
          return
        }
        setResult(call.result as BankAccountLookupResult)
      })()
    }, 420)

    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [accountNumber, disabled])

  if (disabled || accountNumber.trim().length < 8) return null

  if (pending) {
    return (
      <p className="text-xs text-muted-foreground">
        {t('accounting.bankAccount.lookup.loading', 'Checking account number…')}
      </p>
    )
  }

  if (!result) return null

  if (!result.valid) {
    return (
      <p className="text-xs text-destructive">
        {t('accounting.bankAccount.lookup.invalid', 'Invalid bank account number (IBAN).')}
      </p>
    )
  }

  const typedElectronic = accountNumber.replace(/[\s-]/g, '').toUpperCase()

  if (result.directoryHit && (result.bankName || result.bic)) {
    const bank = result.bankName ?? ''
    const bic = result.bic ?? ''
    const parts = [bank, bic ? `BIC ${bic}` : ''].filter(Boolean)
    return (
      <p className="text-xs text-muted-foreground">
        {parts.join(' · ')}
        {result.normalizedIban && result.normalizedIban !== typedElectronic ? (
          <>
            {' '}
            <span className="tabular-nums">({result.normalizedIban})</span>
          </>
        ) : null}
      </p>
    )
  }

  return (
    <p className="text-xs text-muted-foreground">
      {t(
        'accounting.bankAccount.lookup.validNoDirectory',
        'Valid IBAN. Bank name and BIC are available for Polish accounts from the national directory.',
      )}
    </p>
  )
}
