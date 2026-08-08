"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { ResourceSearchField } from './ResourceSearchField'
import { createCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { format } from 'date-fns'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'

export type AllocationEditSeed = {
  id?: string | null
  assignmentDate?: string | null
  shiftStart?: Date | null
  shiftEnd?: Date | null
  resourceId?: string | null
}

type AllocationEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamMemberId: string
  defaultResourceId?: string | null
  seed: AllocationEditSeed | null
  onSaved: () => void
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function AllocationEditDialog({
  open,
  onOpenChange,
  teamMemberId,
  defaultResourceId = null,
  seed,
  onSaved,
}: AllocationEditDialogProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const [assignmentDate, setAssignmentDate] = React.useState('')
  const [shiftStartLocal, setShiftStartLocal] = React.useState('')
  const [shiftEndLocal, setShiftEndLocal] = React.useState('')
  const [resourceId, setResourceId] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const date = seed?.assignmentDate ?? (seed?.shiftStart ? format(seed.shiftStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setAssignmentDate(date)
    setShiftStartLocal(seed?.shiftStart ? toDateTimeLocalValue(seed.shiftStart) : `${date}T06:00`)
    setShiftEndLocal(seed?.shiftEnd ? toDateTimeLocalValue(seed.shiftEnd) : `${date}T22:00`)
    setResourceId(seed?.resourceId ?? defaultResourceId ?? '')
  }, [defaultResourceId, open, seed])

  const isEdit = Boolean(seed?.id)

  const handleCancel = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleSave = React.useCallback(async () => {
    if (!organizationId || !tenantId) return
    if (!resourceId.trim()) {
      flash(t('taxi_fleet.allocations.vehicleRequired', 'Select a vehicle.'), 'error')
      return
    }
    setIsSaving(true)
    try {
      const payload = {
        teamMemberId,
        resourceId,
        assignmentDate,
        shiftStart: shiftStartLocal ? new Date(shiftStartLocal).toISOString() : null,
        shiftEnd: shiftEndLocal ? new Date(shiftEndLocal).toISOString() : null,
        status: 'planned' as const,
      }
      if (isEdit && seed?.id) {
        await updateCrud('taxi_fleet/assignments', { id: seed.id, ...payload }, {
          errorMessage: t('taxi_fleet.allocations.saveError', 'Could not save allocation.'),
        })
        flash(t('taxi_fleet.allocations.updated', 'Allocation updated.'), 'success')
      } else {
        await createCrud('taxi_fleet/assignments', {
          tenantId,
          organizationId,
          ...payload,
        }, {
          errorMessage: t('taxi_fleet.allocations.saveError', 'Could not save allocation.'),
        })
        flash(t('taxi_fleet.allocations.created', 'Allocation created.'), 'success')
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }, [assignmentDate, isEdit, onOpenChange, onSaved, organizationId, resourceId, seed?.id, shiftEndLocal, shiftStartLocal, t, teamMemberId, tenantId])

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit: !isSaving,
  })

  return (
    <TaxiFleetDialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEdit
          ? t('taxi_fleet.allocations.editTitle', 'Edit allocation')
          : t('taxi_fleet.allocations.createTitle', 'New allocation')
      }
      size="md"
      contentRef={dialogContentRef}
      onKeyDown={handleDialogKeyDown}
    >
      <TaxiFleetDialogForm
        onSubmit={(event) => {
          event.preventDefault()
          void handleSave()
        }}
        body={(
          <>
            <div className="space-y-1">
              <Label className="block text-sm font-medium">{t('taxi_fleet.allocations.date', 'Date')}</Label>
              <input
                type="date"
                value={assignmentDate}
                onChange={(event) => setAssignmentDate(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                disabled={isSaving}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="block text-sm font-medium">{t('taxi_fleet.allocations.from', 'From')}</Label>
                <input
                  type="datetime-local"
                  value={shiftStartLocal}
                  onChange={(event) => setShiftStartLocal(event.target.value)}
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1">
                <Label className="block text-sm font-medium">{t('taxi_fleet.allocations.to', 'To')}</Label>
                <input
                  type="datetime-local"
                  value={shiftEndLocal}
                  onChange={(event) => setShiftEndLocal(event.target.value)}
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  disabled={isSaving}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="block text-sm font-medium">{t('taxi_fleet.assignments.vehicle', 'Vehicle')}</Label>
              <ResourceSearchField value={resourceId} onChange={setResourceId} disabled={isSaving} />
            </div>
          </>
        )}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {t('common.save', 'Save')}
            </Button>
          </>
        )}
      />
    </TaxiFleetDialogFrame>
  )
}
