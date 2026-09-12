'use client'

import * as React from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { ResourceSearchField } from './ResourceSearchField'
import {
  ASSIGNMENT_STATUSES,
  AssignmentStatusField,
  type AssignmentStatusCode,
} from './AssignmentStatusField'
import { createCrud, deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
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
  plannedShiftStart?: Date | null
  plannedShiftEnd?: Date | null
  /** @deprecated Prefer plannedShiftStart — kept for slot-click create seeds. */
  shiftStart?: Date | null
  /** @deprecated Prefer plannedShiftEnd */
  shiftEnd?: Date | null
  actualShiftStart?: Date | null
  actualShiftEnd?: Date | null
  status?: AssignmentStatusCode | string | null
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

function parseLocalDateTime(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeStatus(value: string | null | undefined): AssignmentStatusCode {
  if (value && (ASSIGNMENT_STATUSES as readonly string[]).includes(value)) {
    return value as AssignmentStatusCode
  }
  return 'planned'
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
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const dialogContentRef = React.useRef<HTMLDivElement | null>(null)
  const [plannedStartLocal, setPlannedStartLocal] = React.useState('')
  const [plannedEndLocal, setPlannedEndLocal] = React.useState('')
  const [actualStartLocal, setActualStartLocal] = React.useState('')
  const [actualEndLocal, setActualEndLocal] = React.useState('')
  const [status, setStatus] = React.useState<AssignmentStatusCode>('planned')
  const [resourceId, setResourceId] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    const plannedStart = seed?.plannedShiftStart ?? seed?.shiftStart ?? null
    const plannedEnd = seed?.plannedShiftEnd ?? seed?.shiftEnd ?? null
    const date =
      seed?.assignmentDate ??
      (plannedStart ? format(plannedStart, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'))
    setPlannedStartLocal(plannedStart ? toDateTimeLocalValue(plannedStart) : `${date}T06:00`)
    setPlannedEndLocal(plannedEnd ? toDateTimeLocalValue(plannedEnd) : `${date}T22:00`)
    setActualStartLocal(seed?.actualShiftStart ? toDateTimeLocalValue(seed.actualShiftStart) : '')
    setActualEndLocal(seed?.actualShiftEnd ? toDateTimeLocalValue(seed.actualShiftEnd) : '')
    setStatus(normalizeStatus(seed?.status))
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
    if (!plannedStartLocal.trim()) {
      flash(t('taxi_fleet.allocations.fromRequired', 'Set the shift start time.'), 'error')
      return
    }
    const plannedStart = parseLocalDateTime(plannedStartLocal)
    if (!plannedStart) {
      flash(t('taxi_fleet.allocations.fromInvalid', 'Enter a valid start date and time.'), 'error')
      return
    }
    const plannedEnd = parseLocalDateTime(plannedEndLocal)
    if (plannedEndLocal.trim() && !plannedEnd) {
      flash(t('taxi_fleet.allocations.toInvalid', 'Enter a valid end date and time.'), 'error')
      return
    }
    const actualStart = parseLocalDateTime(actualStartLocal)
    if (actualStartLocal.trim() && !actualStart) {
      flash(
        t('taxi_fleet.allocations.actualFromInvalid', 'Enter a valid actual start date and time.'),
        'error',
      )
      return
    }
    const actualEnd = parseLocalDateTime(actualEndLocal)
    if (actualEndLocal.trim() && !actualEnd) {
      flash(
        t('taxi_fleet.allocations.actualToInvalid', 'Enter a valid actual end date and time.'),
        'error',
      )
      return
    }
    const assignmentDate = format(plannedStart, 'yyyy-MM-dd')
    setIsSaving(true)
    try {
      if (isEdit && seed?.id) {
        await updateCrud(
          'taxi_fleet/assignments',
          {
            id: seed.id,
            teamMemberId,
            resourceId,
            assignmentDate,
            plannedShiftStart: plannedStart.toISOString(),
            plannedShiftEnd: plannedEnd ? plannedEnd.toISOString() : null,
            shiftStart: actualStart ? actualStart.toISOString() : null,
            shiftEnd: actualEnd ? actualEnd.toISOString() : null,
            status,
          },
          {
            errorMessage: t('taxi_fleet.allocations.saveError', 'Could not save allocation.'),
          },
        )
        flash(t('taxi_fleet.allocations.updated', 'Allocation updated.'), 'success')
      } else {
        await createCrud(
          'taxi_fleet/assignments',
          {
            tenantId,
            organizationId,
            teamMemberId,
            resourceId,
            assignmentDate,
            plannedShiftStart: plannedStart.toISOString(),
            plannedShiftEnd: plannedEnd ? plannedEnd.toISOString() : null,
            status: 'planned',
          },
          {
            errorMessage: t('taxi_fleet.allocations.saveError', 'Could not save allocation.'),
          },
        )
        flash(t('taxi_fleet.allocations.created', 'Allocation created.'), 'success')
      }
      onOpenChange(false)
      onSaved()
    } finally {
      setIsSaving(false)
    }
  }, [
    actualEndLocal,
    actualStartLocal,
    isEdit,
    onOpenChange,
    onSaved,
    organizationId,
    plannedEndLocal,
    plannedStartLocal,
    resourceId,
    seed?.id,
    status,
    t,
    teamMemberId,
    tenantId,
  ])

  const handleDelete = React.useCallback(async () => {
    if (!seed?.id) return
    const confirmed = await confirm({
      title: t('taxi_fleet.allocations.deleteConfirm', 'Delete this allocation?'),
      variant: 'destructive',
    })
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await deleteCrud('taxi_fleet/assignments', seed.id, {
        errorMessage: t('taxi_fleet.allocations.deleteError', 'Could not delete allocation.'),
      })
      flash(t('taxi_fleet.allocations.deleted', 'Allocation deleted.'), 'success')
      onOpenChange(false)
      onSaved()
    } finally {
      setIsDeleting(false)
    }
  }, [confirm, onOpenChange, onSaved, seed?.id, t])

  const isBusy = isSaving || isDeleting

  const handleDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: dialogContentRef,
    onCancel: handleCancel,
    canSubmit: !isBusy,
  })

  return (
    <>
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
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {t('taxi_fleet.allocations.planSection', 'Planned schedule')}
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="block text-sm font-medium">
                      {t('taxi_fleet.allocations.planFrom', 'Plan from')}
                    </Label>
                    <input
                      type="datetime-local"
                      value={plannedStartLocal}
                      onChange={(event) => setPlannedStartLocal(event.target.value)}
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="block text-sm font-medium">
                      {t('taxi_fleet.allocations.planTo', 'Plan to')}
                    </Label>
                    <input
                      type="datetime-local"
                      value={plannedEndLocal}
                      onChange={(event) => setPlannedEndLocal(event.target.value)}
                      className={CRUD_FORM_TEXT_INPUT_CLASS}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              </div>

              {isEdit ? (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-sm font-medium text-foreground">
                    {t('taxi_fleet.allocations.actualSection', 'Actual (driver punch)')}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="block text-sm font-medium">
                        {t('taxi_fleet.allocations.actualFrom', 'Actual start')}
                      </Label>
                      <input
                        type="datetime-local"
                        value={actualStartLocal}
                        onChange={(event) => setActualStartLocal(event.target.value)}
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        disabled={isBusy}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="block text-sm font-medium">
                        {t('taxi_fleet.allocations.actualTo', 'Actual end')}
                      </Label>
                      <input
                        type="datetime-local"
                        value={actualEndLocal}
                        onChange={(event) => setActualEndLocal(event.target.value)}
                        className={CRUD_FORM_TEXT_INPUT_CLASS}
                        disabled={isBusy}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="block text-sm font-medium">
                      {t('taxi_fleet.assignments.status', 'Status')}
                    </Label>
                    <AssignmentStatusField
                      value={status}
                      onChange={(next) => setStatus(normalizeStatus(next))}
                      disabled={isBusy}
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1 border-t pt-4">
                <Label className="block text-sm font-medium">
                  {t('taxi_fleet.assignments.vehicle', 'Vehicle')}
                </Label>
                <ResourceSearchField value={resourceId} onChange={setResourceId} disabled={isBusy} />
              </div>
            </>
          )}
          footer={(
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              {isEdit ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleDelete()}
                  disabled={isBusy}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 mr-2" />
                  )}
                  {t('ui.forms.actions.delete', 'Delete')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isBusy}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={isBusy}>
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          )}
        />
      </TaxiFleetDialogFrame>
      {ConfirmDialogElement}
    </>
  )
}
