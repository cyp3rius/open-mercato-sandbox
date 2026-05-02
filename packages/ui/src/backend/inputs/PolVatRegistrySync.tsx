'use client'

import * as React from 'react'
import { CloudSync } from 'lucide-react'
import { isValidNip, normalizeNipDigits } from '@open-mercato/shared/lib/pl/nip'
import { isValidRegon, normalizeRegonDigits } from '@open-mercato/shared/lib/pl/regon'
import { cn } from '@open-mercato/shared/lib/utils'
import { Button } from '../../primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../primitives/dialog'
import { Label } from '../../primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '../CrudForm'

export type PolVatRegistrySyncLabels = {
  title: string
  description: string
  nip: string
  regon: string
  nipPlaceholder: string
  regonPlaceholder: string
  orRule: string
  cancel: string
  submit: string
  buttonLabel: string
  needIdentifier: string
  nipInvalid: string
  regonInvalid: string
  notFound: string
  requestError: string
}

function SectionRule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export function PolVatRegistrySyncDialog<TData>(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  labels: PolVatRegistrySyncLabels
  onLookup: (args: { nip: string | null; regon: string | null }) => Promise<TData | null>
  onSuccess: (data: TData) => void | Promise<void>
}) {
  const { open, onOpenChange, onLookup, onSuccess, labels } = props
  const baseId = React.useId()
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
  const regonDigits = React.useMemo(
    () => (regon.trim().length ? normalizeRegonDigits(regon) : null),
    [regon],
  )

  const nipLiveError =
    nip.trim().length && nipDigits && (nipDigits.length !== 10 || !isValidNip(nipDigits))
      ? labels.nipInvalid
      : null
  const regonLiveError =
    regon.trim().length && regonDigits && !isValidRegon(regonDigits) ? labels.regonInvalid : null

  const runSync = React.useCallback(async () => {
    const nTrim = nip.trim()
    const rTrim = regon.trim()
    if (!nTrim && !rTrim) {
      setError(labels.needIdentifier)
      return
    }
    const n = nTrim.length ? normalizeNipDigits(nTrim) : null
    const r = rTrim.length ? normalizeRegonDigits(rTrim) : null
    if (n && (n.length !== 10 || !isValidNip(n))) {
      setError(labels.nipInvalid)
      return
    }
    if (r && !isValidRegon(r)) {
      setError(labels.regonInvalid)
      return
    }
    setError(null)
    setPending(true)
    try {
      const out = await onLookup({
        nip: n,
        regon: n ? null : r,
      })
      if (out == null) {
        setError(labels.notFound)
        return
      }
      await onSuccess(out)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message || labels.requestError)
    } finally {
      setPending(false)
    }
  }, [nip, regon, onLookup, onOpenChange, onSuccess, labels])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-nip`}>{labels.nip}</Label>
            <input
              id={`${baseId}-nip`}
              className={cn(CRUD_FORM_TEXT_INPUT_CLASS, nipLiveError && 'border-destructive')}
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              disabled={pending}
              placeholder={labels.nipPlaceholder}
            />
            {nipLiveError ? <p className="text-sm text-destructive">{nipLiveError}</p> : null}
          </div>
          <SectionRule>{labels.orRule}</SectionRule>
          <div className="space-y-2">
            <Label htmlFor={`${baseId}-regon`}>{labels.regon}</Label>
            <input
              id={`${baseId}-regon`}
              className={cn(CRUD_FORM_TEXT_INPUT_CLASS, regonLiveError && 'border-destructive')}
              value={regon}
              onChange={(e) => setRegon(e.target.value)}
              disabled={pending}
              placeholder={labels.regonPlaceholder}
            />
            {regonLiveError ? <p className="text-sm text-destructive">{regonLiveError}</p> : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter className="gap-3 sm:gap-3">
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void runSync()}>
            <CloudSync className="mr-2 h-4 w-4" />
            {labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PolVatRegistrySyncToolbarButton<TData>(props: {
  labels: PolVatRegistrySyncLabels
  onLookup: (args: { nip: string | null; regon: string | null }) => Promise<TData | null>
  onSuccess: (data: TData) => void | Promise<void>
}) {
  const { labels, onLookup, onSuccess } = props
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <CloudSync className="mr-2 h-4 w-4" />
        {labels.buttonLabel}
      </Button>
      <PolVatRegistrySyncDialog
        open={open}
        onOpenChange={setOpen}
        labels={labels}
        onLookup={onLookup}
        onSuccess={onSuccess}
      />
    </>
  )
}
