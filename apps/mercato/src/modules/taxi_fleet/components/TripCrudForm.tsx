'use client'

import * as React from 'react'
import type { z } from 'zod'
import { AlertTriangle } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@open-mercato/ui/primitives/tooltip'
import type { FleetDriverProfile } from './useFleetDriverDirectory'
import { taxiFleetDialogCrudTabbedBodyClass } from './TaxiFleetDialogShell'
import {
  buildTripFormFields,
  buildTripFormGroups,
  listTripFormBlockingIssues,
  tripFormSchema,
  TRIP_FORM_SYNC_GROUP_ID,
  type TripFormValues,
} from './tripFormConfig'
import { tripFormTabGroupId, type TripFormTabId } from './TripFormTabNav'
import {
  tripDetailLockMode,
} from '../lib/tripDetailWorkflow'

export type TripCrudFormLayout = 'page' | 'dialog'

export type TripCrudFormSharedOptions = {
  mode: 'create' | 'edit'
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  driverLocked?: boolean
  lockedTeamMemberId?: string | null
  onAssignmentResolved?: (assignmentId: string | null) => void
  statusOptions?: Array<{ value: string; label: string }>
  readOnly?: boolean
  lockStatus?: string | null
}

type TripCrudFormBaseProps = TripCrudFormSharedOptions & {
  initialValues: TripFormValues
  onSubmit: (values: TripFormValues) => Promise<void>
  formKey?: React.Key
  submitLabel: string
  extraActions?: React.ReactNode
  /** Rendered in CrudForm column 2 (sidebar), below status/pricing groups. */
  sidebarExtra?: React.ReactNode
  /** Rendered in column 2 after pricing, before `sidebarExtra` (e.g. PayPal payment). */
  sidebarAfterPricing?: React.ReactNode
  onSubmitReadyChange?: (ready: boolean) => void
  /** Live form values for detail-header status shortcuts (save-then-transition). */
  onLiveValuesChange?: (values: TripFormValues) => void
}

type TripCrudFormPageProps = TripCrudFormBaseProps & {
  layout: 'page'
  title?: string
  backHref?: string
  cancelHref?: string
  onDelete?: () => void
}

type TripCrudFormDialogProps = TripCrudFormBaseProps & {
  layout: 'dialog'
  activeTab?: TripFormTabId
}

export type TripCrudFormProps = TripCrudFormPageProps | TripCrudFormDialogProps

export function TripCrudForm(props: TripCrudFormProps) {
  const t = useT()
  const {
    layout,
    mode,
    initialValues,
    onSubmit,
    formKey,
    submitLabel,
    extraActions,
    sidebarExtra,
    sidebarAfterPricing,
    onSubmitReadyChange,
    onLiveValuesChange,
    driverProfiles,
    resolveDriverName,
    driverLocked = false,
    lockedTeamMemberId = null,
    onAssignmentResolved,
    statusOptions,
    readOnly = false,
    lockStatus = null,
  } = props

  const activeTab = layout === 'dialog' ? (props.activeTab ?? 'route') : null

  // Freeze clock when the form instance mounts (or remounts via formKey).
  const minAdvanceReference = React.useMemo(() => new Date(), [formKey])

  const [liveStatus, setLiveStatus] = React.useState(() =>
    typeof initialValues.status === 'string' ? initialValues.status : '',
  )
  React.useEffect(() => {
    setLiveStatus(typeof initialValues.status === 'string' ? initialValues.status : '')
  }, [formKey, initialValues.status])

  // In edit mode, field locks follow the status selected in the form so changing
  // e.g. scheduled → new unlocks the driver and other fields before save.
  const effectiveLockStatus = React.useMemo(() => {
    if (readOnly) return lockStatus
    if (mode !== 'edit') return lockStatus
    if (!liveStatus.trim()) return lockStatus
    return tripDetailLockMode(liveStatus) === 'none' ? null : liveStatus
  }, [liveStatus, lockStatus, mode, readOnly])

  const fields = React.useMemo(
    () =>
      buildTripFormFields(t, {
        mode,
        surface: layout,
        driverProfiles,
        resolveDriverName,
        driverLocked,
        lockedTeamMemberId,
        onAssignmentResolved,
        statusOptions,
        readOnly,
        lockStatus: effectiveLockStatus,
        minAdvanceReference,
        // CRM may schedule/add trips without the public booking lead-time rule.
        minAdvanceHours: 0,
        currentPaymentType:
          typeof initialValues.paymentType === 'string' ? initialValues.paymentType : null,
      }),
    [
      effectiveLockStatus,
      driverLocked,
      driverProfiles,
      initialValues.paymentType,
      layout,
      lockedTeamMemberId,
      minAdvanceReference,
      mode,
      onAssignmentResolved,
      readOnly,
      resolveDriverName,
      statusOptions,
      t,
    ],
  )

  const allGroups = React.useMemo(() => buildTripFormGroups(t, layout, { mode }), [layout, mode, t])

  const groups = React.useMemo(() => {
    const base =
      layout !== 'dialog' || !activeTab
        ? allGroups
        : allGroups.filter(
            (group) =>
              group.id === tripFormTabGroupId(activeTab) || group.id === TRIP_FORM_SYNC_GROUP_ID,
          )
    if (layout !== 'page') return base
    const next = [...base]
    if (sidebarAfterPricing) {
      const pricingIndex = next.findIndex((group) => group.id === 'pricing')
      const insertAt = pricingIndex >= 0 ? pricingIndex + 1 : next.length
      next.splice(insertAt, 0, {
        id: 'trip-sidebar-after-pricing',
        column: 2 as const,
        bare: true,
        component: () => sidebarAfterPricing,
      })
    }
    if (sidebarExtra) {
      next.push({
        id: 'trip-sidebar-extra',
        column: 2 as const,
        bare: true,
        component: () => sidebarExtra,
      })
    }
    return next
  }, [activeTab, allGroups, layout, sidebarAfterPricing, sidebarExtra])

  const requireDriver = !(driverLocked && lockedTeamMemberId?.trim().length)
  const validationOptions = React.useMemo(
    () => ({
      requireDriver,
      // CRM create/edit: no 24h booking lead-time gate (driver app keeps its own rules).
      enforceMinAdvance: false,
      minAdvanceHours: 0,
      minAdvanceReference,
    }),
    [minAdvanceReference, requireDriver],
  )

  const schema = React.useMemo(
    () => tripFormSchema(t, validationOptions),
    [t, validationOptions],
  )

  const [blockingIssues, setBlockingIssues] = React.useState<string[]>(() =>
    listTripFormBlockingIssues(initialValues, t, validationOptions),
  )

  React.useEffect(() => {
    const issues = listTripFormBlockingIssues(initialValues, t, validationOptions)
    setBlockingIssues(issues)
    onSubmitReadyChange?.(issues.length === 0)
    onLiveValuesChange?.(initialValues)
  }, [formKey, initialValues, onLiveValuesChange, onSubmitReadyChange, t, validationOptions])

  const handleValuesChange = React.useCallback(
    (values: TripFormValues) => {
      if (typeof values.status === 'string') {
        setLiveStatus(values.status)
      }
      const issues = listTripFormBlockingIssues(values, t, validationOptions)
      setBlockingIssues(issues)
      onSubmitReadyChange?.(issues.length === 0)
      onLiveValuesChange?.(values)
    },
    [onLiveValuesChange, onSubmitReadyChange, t, validationOptions],
  )

  const showBlockingHint = !readOnly && mode === 'create' && blockingIssues.length > 0
  const incompleteTitle = t(
    'taxi_fleet.trips.form.incompleteTitle',
    'Complete required fields to create the trip:',
  )

  const blockingFooterIcon = (
    <span className="mr-auto inline-flex h-9 shrink-0 items-center self-center">
      {showBlockingHint ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                aria-label={incompleteTitle}
              >
                <AlertTriangle className="size-5" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" align="start" className="max-w-sm space-y-1.5 p-3 text-left">
              <div className="font-medium">{incompleteTitle}</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {blockingIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              {layout === 'dialog' ? (
                <p className="text-[11px] text-slate-300">
                  {t(
                    'taxi_fleet.trips.form.incompleteTabsHint',
                    'Check the Route, Assignment, and Customer tabs.',
                  )}
                </p>
              ) : null}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  )

  const mergedExtraActions =
    blockingFooterIcon || extraActions ? (
      <>
        {blockingFooterIcon}
        {extraActions}
      </>
    ) : undefined

  const crudFormProps = {
    fields,
    groups,
    initialValues,
    schema: schema as z.ZodType<TripFormValues>,
    submitLabel,
    extraActions: mergedExtraActions,
    readOnly,
    // Completed/cancelled trips must stay viewable (OCR sidebar, scroll) without CrudForm's frosted overlay.
    readOnlyOverlay: readOnly ? (false as const) : undefined,
    // Keep submit clickable so Zod field errors surface; only gate on read-only.
    submitDisabled: readOnly,
    onValuesChange: handleValuesChange,
    onSubmit,
  }

  if (layout === 'dialog') {
    return (
      <div className={taxiFleetDialogCrudTabbedBodyClass}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <CrudForm<TripFormValues>
            key={formKey}
            embedded
            {...crudFormProps}
          />
        </div>
      </div>
    )
  }

  const { title, backHref, cancelHref, onDelete } = props

  return (
    <CrudForm<TripFormValues>
      key={formKey}
      title={title}
      backHref={backHref}
      cancelHref={readOnly ? undefined : cancelHref}
      onDelete={onDelete}
      {...crudFormProps}
    />
  )
}
