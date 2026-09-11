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
  allowDriverEdit?: boolean
}

type TripCrudFormBaseProps = TripCrudFormSharedOptions & {
  initialValues: TripFormValues
  onSubmit: (values: TripFormValues) => Promise<void>
  formKey?: React.Key
  submitLabel: string
  extraActions?: React.ReactNode
  /** Rendered in CrudForm column 2 (sidebar), below status/pricing groups. */
  sidebarExtra?: React.ReactNode
  onSubmitReadyChange?: (ready: boolean) => void
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
    onSubmitReadyChange,
    driverProfiles,
    resolveDriverName,
    driverLocked = false,
    lockedTeamMemberId = null,
    onAssignmentResolved,
    statusOptions,
    readOnly = false,
    lockStatus = null,
    allowDriverEdit = false,
  } = props

  const activeTab = layout === 'dialog' ? (props.activeTab ?? 'route') : null

  // Freeze lead-time clock when the form instance mounts (or remounts via formKey).
  const minAdvanceReference = React.useMemo(() => new Date(), [formKey])

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
        lockStatus,
        allowDriverEdit,
        minAdvanceReference,
      }),
    [
      allowDriverEdit,
      driverLocked,
      driverProfiles,
      layout,
      lockStatus,
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
    if (!sidebarExtra || layout !== 'page') return base
    return [
      ...base,
      {
        id: 'trip-sidebar-extra',
        column: 2 as const,
        bare: true,
        component: () => sidebarExtra,
      },
    ]
  }, [activeTab, allGroups, layout, sidebarExtra])

  const enforceMinAdvance = mode === 'create'
  const requireDriver = !(driverLocked && lockedTeamMemberId?.trim().length)
  const validationOptions = React.useMemo(
    () => ({ requireDriver, enforceMinAdvance, minAdvanceReference }),
    [enforceMinAdvance, minAdvanceReference, requireDriver],
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
  }, [formKey, initialValues, onSubmitReadyChange, t, validationOptions])

  const handleValuesChange = React.useCallback(
    (values: TripFormValues) => {
      const issues = listTripFormBlockingIssues(values, t, validationOptions)
      setBlockingIssues(issues)
      onSubmitReadyChange?.(issues.length === 0)
    },
    [onSubmitReadyChange, t, validationOptions],
  )

  const showBlockingHint = !readOnly && mode === 'create' && blockingIssues.length > 0
  const incompleteTitle = t(
    'taxi_fleet.trips.form.incompleteTitle',
    'Complete required fields to create the trip:',
  )

  const blockingFooterIcon = (
    <span className="mr-auto inline-flex shrink-0 items-center">
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

  const mergedExtraActions = (
    <>
      {blockingFooterIcon}
      {extraActions}
    </>
  )

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
