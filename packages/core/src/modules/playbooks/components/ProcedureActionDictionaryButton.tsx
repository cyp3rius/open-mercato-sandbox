'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'

export function ProcedureActionDictionaryButton() {
  const t = useT()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  const openDictionary = React.useCallback(async () => {
    setLoading(true)
    try {
      const call = await apiCall<{ dictionaryId?: string }>(
        '/api/playbooks/dictionaries/procedure-action',
      )
      const dictionaryId =
        call.ok && typeof call.result?.dictionaryId === 'string'
          ? call.result.dictionaryId.trim()
          : ''
      if (!dictionaryId) {
        flash(
          t('playbooks.config.actions.ensureError', 'Could not open the procedure action dictionary.'),
          'error',
        )
        return
      }
      router.push(
        `/backend/config/dictionaries?dictionaryId=${encodeURIComponent(dictionaryId)}`,
      )
    } catch {
      flash(
        t('playbooks.config.actions.ensureError', 'Could not open the procedure action dictionary.'),
        'error',
      )
    } finally {
      setLoading(false)
    }
  }, [router, t])

  return (
    <Button type="button" variant="outline" disabled={loading} onClick={() => void openDictionary()}>
      {loading
        ? t('playbooks.config.actions.opening', 'Opening…')
        : t('playbooks.config.actions.open', 'Manage actions')}
    </Button>
  )
}
