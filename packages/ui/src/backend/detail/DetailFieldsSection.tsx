"use client"

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { ComponentReplacementHandles } from '@open-mercato/shared/modules/widgets/component-registry'
import { useRegisteredComponent } from '../injection/useRegisteredComponent'
import {
  InlineMultilineEditor,
  InlineSelectEditor,
  InlineTextEditor,
  type InlineSelectOption,
  type InlineSelectEditorProps,
  type InlineTextEditorProps,
  type InlineMultilineEditorProps,
} from './InlineEditors'

type EditorVariant = 'default' | 'muted' | 'plain'

type DetailFieldCommon = {
  key: string
  label: string
  emptyLabel: string
  gridClassName?: string
  editorVariant?: EditorVariant
  activateOnClick?: boolean
  /** When false, inline field is display-only (no pencil). Default true. */
  showEditTrigger?: boolean
  containerClassName?: string
  triggerClassName?: string
}

export type DetailTextFieldConfig = DetailFieldCommon & {
  kind: 'text'
  value: string | null | undefined
  placeholder?: string
  onSave: (value: string | null) => Promise<void>
  inputType?: React.HTMLInputTypeAttribute
  validator?: (value: string) => string | null
  hideLabel?: boolean
  renderDisplay?: InlineTextEditorProps['renderDisplay']
}

export type DetailMultilineFieldConfig = DetailFieldCommon & {
  kind: 'multiline'
  value: string | null | undefined
  placeholder?: string
  onSave: (value: string | null) => Promise<void>
  validator?: (value: string) => string | null
  renderDisplay?: InlineMultilineEditorProps['renderDisplay']
}

export type DetailSelectFieldConfig = DetailFieldCommon & {
  kind: 'select'
  value: string | null | undefined
  onSave: (value: string | null) => Promise<void>
  options: InlineSelectOption[]
  hideLabel?: boolean
  renderDisplay?: InlineSelectEditorProps['renderDisplay']
  renderEditor?: InlineSelectEditorProps['renderEditor']
}

export type DetailCustomFieldConfig = DetailFieldCommon & {
  kind: 'custom'
  render: () => React.ReactNode
}

export type DetailFieldConfig =
  | DetailTextFieldConfig
  | DetailMultilineFieldConfig
  | DetailSelectFieldConfig
  | DetailCustomFieldConfig

export type DetailFieldsSectionProps = {
  fields: DetailFieldConfig[]
  className?: string
}

function DetailFieldsSectionImpl({ fields, className }: DetailFieldsSectionProps) {
  return (
    <div className={cn('grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 md:grid-cols-3', className)}>
      {fields.map((field) => {
        const variant = field.editorVariant ?? 'muted'
        const activateOnClick = field.activateOnClick ?? true
        const showEditTrigger = field.showEditTrigger ?? true
        const containerClassName = field.containerClassName ?? undefined
        const triggerClassName = field.triggerClassName ?? undefined
        const wrapperClassName = cn('h-full min-h-0', field.gridClassName ?? undefined)

        if (field.kind === 'text') {
          return (
            <div key={field.key} className={wrapperClassName}>
              <InlineTextEditor
                label={field.label}
                value={field.value}
                placeholder={field.placeholder}
                emptyLabel={field.emptyLabel}
                onSave={field.onSave}
                inputType={field.inputType}
                validator={field.validator}
                variant={variant}
                activateOnClick={activateOnClick}
                showEditTrigger={showEditTrigger}
                containerClassName={containerClassName}
                triggerClassName={triggerClassName}
                hideLabel={field.hideLabel}
                renderDisplay={field.renderDisplay}
              />
            </div>
          )
        }

        if (field.kind === 'multiline') {
          return (
            <div key={field.key} className={wrapperClassName}>
              <InlineMultilineEditor
                label={field.label}
                value={field.value}
                placeholder={field.placeholder}
                emptyLabel={field.emptyLabel}
                onSave={field.onSave}
                validator={field.validator}
                variant={variant === 'plain' ? 'default' : variant}
                activateOnClick={activateOnClick}
                showEditTrigger={showEditTrigger}
                containerClassName={containerClassName}
                triggerClassName={triggerClassName}
                renderDisplay={field.renderDisplay}
              />
            </div>
          )
        }

        if (field.kind === 'select') {
          return (
            <div key={field.key} className={wrapperClassName}>
              <InlineSelectEditor
                label={field.label}
                value={field.value}
                emptyLabel={field.emptyLabel}
                onSave={field.onSave}
                options={field.options}
                variant={variant}
                activateOnClick={activateOnClick}
                showEditTrigger={showEditTrigger}
                containerClassName={containerClassName}
                triggerClassName={triggerClassName}
                hideLabel={field.hideLabel}
                renderDisplay={field.renderDisplay}
                renderEditor={field.renderEditor}
              />
            </div>
          )
        }

        return (
          <div key={field.key} className={wrapperClassName}>
            {field.render()}
          </div>
        )
      })}
    </div>
  )
}

export function DetailFieldsSection(props: DetailFieldsSectionProps) {
  const handle = ComponentReplacementHandles.section('ui.detail', 'DetailFieldsSection')
  const Resolved = useRegisteredComponent<DetailFieldsSectionProps>(
    handle,
    DetailFieldsSectionImpl as React.ComponentType<DetailFieldsSectionProps>,
  )

  return (
    <div data-component-handle={handle}>
      <Resolved {...props} />
    </div>
  )
}
