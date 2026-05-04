"use client"

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '../../primitives/button'

export type HtmlRichTextEditorProps = {
  value?: string
  onChange: (html: string) => void
  disabled?: boolean
}

/** HTML rich text (contentEditable); returns HTML string on blur. */
export const HtmlRichTextEditor = React.memo(function HtmlRichTextEditor({
  value = '',
  onChange,
  disabled = false,
}: HtmlRichTextEditorProps) {
  const t = useT()
  const boldLabel = t('ui.forms.richtext.bold')
  const italicLabel = t('ui.forms.richtext.italic')
  const underlineLabel = t('ui.forms.richtext.underline')
  const listLabel = t('ui.forms.richtext.list')
  const heading3Label = t('ui.forms.richtext.heading3')
  const linkLabel = t('ui.forms.richtext.link')
  const linkUrlPrompt = t('ui.forms.richtext.linkUrlPrompt')
  const ref = React.useRef<HTMLDivElement | null>(null)
  const applyingExternal = React.useRef(false)
  const typingRef = React.useRef(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const current = el.innerHTML
    if (!typingRef.current && current !== value) {
      applyingExternal.current = true
      el.innerHTML = value || ''
      requestAnimationFrame(() => {
        applyingExternal.current = false
      })
    }
  }, [value])

  const exec = (cmd: string, arg?: string) => {
    const el = ref.current
    if (!el) return
    el.focus()
    try {
      document.execCommand(cmd, false, arg)
    } catch {
      // ignore execCommand failures
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMod = e.metaKey || e.ctrlKey
    if (!isMod) return
    const k = e.key.toLowerCase()
    if (k === 'b') {
      e.preventDefault()
      exec('bold')
    }
    if (k === 'i') {
      e.preventDefault()
      exec('italic')
    }
    if (k === 'u') {
      e.preventDefault()
      exec('underline')
    }
  }

  return (
    <div className={cn('w-full rounded border', disabled && 'pointer-events-none opacity-60')}>
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
        >
          {boldLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
        >
          {italicLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('underline')}
        >
          {underlineLabel}
        </Button>
        <span className="mx-2 text-muted-foreground">|</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('insertUnorderedList')}
        >
          • {listLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('formatBlock', '<h3>')}
        >
          {heading3Label}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-0.5 text-xs"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const url = window.prompt(linkUrlPrompt)?.trim()
            if (url) exec('createLink', url)
          }}
        >
          {linkLabel}
        </Button>
      </div>
      <div
        ref={ref}
        className="prose prose-sm max-w-none min-h-[100px] w-full px-2 py-2 focus:outline-none sm:min-h-[160px]"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onKeyDown={onKeyDown}
        onInput={() => {
          if (!applyingExternal.current) typingRef.current = true
        }}
        onBlur={() => {
          const el = ref.current
          if (!el) return
          typingRef.current = false
          onChange(el.innerHTML)
        }}
      />
    </div>
  )
}, (prev, next) => prev.value === next.value && prev.disabled === next.disabled)
