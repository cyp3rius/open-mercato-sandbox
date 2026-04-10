"use client"

import * as React from 'react'
import { CloudSync } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import type { CrudCustomFieldRenderProps } from '@open-mercato/ui/backend/CrudForm'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { isValidNip, normalizeNipDigits } from '../lib/nip'
import { isValidRegon, normalizeRegonDigits } from '../lib/regon'
import type { MfRegistryCompanyData } from '../lib/mfVatRegistry'

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

type RegistryLookupResponse = { ok: true; data: MfRegistryCompanyData | null }

export function createCompanyRegistrySyncBridgeField(
  applyRef: React.MutableRefObject<((patch: Record<string, unknown>) => void) | null>,
): {
  id: string
  label: string
  type: 'custom'
  layout: 'full'
  component: (props: CrudCustomFieldRenderProps) => null
} {
  return {
    id: '__companyRegistrySyncBridge',
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

export function CompanyRegistrySyncDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (data: MfRegistryCompanyData) => void | Promise<void>
}) {
  const { open, onOpenChange, onSuccess } = props
  const t = useT()
  const [nip, setNip] = React.useState('')
  const [regon, setRegon] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setNip('')
    setRegon('')
    setError(null)
    setPending(false)
  }, [open])

  const nipDigits = React.useMemo(() => (nip.trim().length ? normalizeNipDigits(nip) : null), [nip])
  const regonDigits = React.useMemo(() => (regon.trim().length ? normalizeRegonDigits(regon) : null), [regon])

  const nipLiveError =
    nip.trim().length && nipDigits && (nipDigits.length !== 10 || !isValidNip(nipDigits))
      ? t('customers.companies.form.nipInvalid', 'Invalid NIP.')
      : null
  const regonLiveError =
    regon.trim().length && regonDigits && !isValidRegon(regonDigits)
      ? t('customers.companies.form.regonInvalid', 'Invalid REGON.')
      : null

  const runSync = React.useCallback(async () => {
    const nTrim = nip.trim()
    const rTrim = regon.trim()
    if (!nTrim && !rTrim) {
      setError(t('customers.companies.form.registrySync.needIdentifier', 'Enter NIP or REGON.'))
      return
    }
    const n = nTrim.length ? normalizeNipDigits(nTrim) : null
    const r = rTrim.length ? normalizeRegonDigits(rTrim) : null
    if (n && (n.length !== 10 || !isValidNip(n))) {
      setError(t('customers.companies.form.nipInvalid', 'Invalid NIP.'))
      return
    }
    if (r && !isValidRegon(r)) {
      setError(t('customers.companies.form.regonInvalid', 'Invalid REGON.'))
      return
    }
    setError(null)
    setPending(true)
    try {
      const payload: { nip?: string; regon?: string } = {}
      if (n) payload.nip = n
      else if (r) payload.regon = r

      const result = await readApiResultOrThrow<RegistryLookupResponse>(
        '/api/customers/companies/registry-lookup',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
        {
          errorMessage: t(
            'customers.companies.form.registrySync.requestError',
            'Could not fetch data from the registry.',
          ),
        },
      )
      if (!result.data) {
        setError(
          t(
            'customers.companies.form.registrySync.notFound',
            'No company found for this identifier in the VAT whitelist.',
          ),
        )
        return
      }
      await onSuccess(result.data)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    } finally {
      setPending(false)
    }
  }, [nip, regon, onOpenChange, onSuccess, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('customers.companies.form.registrySync.title', 'Synchronize company data')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'customers.companies.form.registrySync.description',
              'Data is retrieved from the Polish Ministry of Finance VAT whitelist (public API, daily limits apply).',
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="registry-nip">{t('customers.companies.form.nip', 'NIP')}</Label>
            <input
              id="registry-nip"
              className={cn(CRUD_FORM_TEXT_INPUT_CLASS, nipLiveError && 'border-destructive')}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              disabled={pending}
              placeholder={t('customers.companies.form.nipPlaceholder', '10-digit tax number')}
            />
            {nipLiveError ? <p className="text-sm text-destructive">{nipLiveError}</p> : null}
          </div>
          <SectionRule>{t('customers.companies.form.registrySync.orRule', '— or —')}</SectionRule>
          <div className="space-y-2">
            <Label htmlFor="registry-regon">{t('customers.companies.form.regon', 'REGON')}</Label>
            <input
              id="registry-regon"
              className={cn(CRUD_FORM_TEXT_INPUT_CLASS, regonLiveError && 'border-destructive')}
              value={regon}
              onChange={(e) => setRegon(e.target.value)}
              disabled={pending}
              placeholder={t('customers.companies.form.regonPlaceholder', '9 or 14 digits')}
            />
            {regonLiveError ? <p className="text-sm text-destructive">{regonLiveError}</p> : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('customers.companies.form.registrySync.cancel', 'Cancel')}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void runSync()}>
            <CloudSync className="mr-2 h-4 w-4" />
            {t('customers.companies.form.registrySync.submit', 'Synchronize')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CompanyRegistrySyncToolbarButton(props: {
  onSuccess: (data: MfRegistryCompanyData) => void | Promise<void>
}) {
  const { onSuccess } = props
  const t = useT()
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <CloudSync className="mr-2 h-4 w-4" />
        {t('customers.companies.form.registrySync.label', 'Synchronize data')}
      </Button>
      <CompanyRegistrySyncDialog open={open} onOpenChange={setOpen} onSuccess={onSuccess} />
    </>
  )
}
