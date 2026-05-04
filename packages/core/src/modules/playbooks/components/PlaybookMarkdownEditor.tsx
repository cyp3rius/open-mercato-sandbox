'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
import type { MDEditorProps as UiWMDEditorProps } from '@uiw/react-md-editor'
import { cn } from '@open-mercato/shared/lib/utils'

const MDEditor = dynamic(async () => {
  const mod = await import('@uiw/react-md-editor')
  return mod.default
}, { ssr: false }) as React.ComponentType<UiWMDEditorProps>

export type PlaybookMarkdownEditorProps = {
  value?: string
  onChange: (md: string) => void
  disabled?: boolean
  height?: number
}

export function PlaybookMarkdownEditor({
  value = '',
  onChange,
  disabled,
  height = 220,
}: PlaybookMarkdownEditorProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [local, setLocal] = React.useState<string>(value)
  const typingRef = React.useRef(false)

  React.useEffect(() => {
    if (!typingRef.current) setLocal(value)
  }, [value])

  const handleChange = React.useCallback((v?: string) => {
    typingRef.current = true
    setLocal(v ?? '')
  }, [])

  const commit = React.useCallback(() => {
    if (!typingRef.current) return
    typingRef.current = false
    onChange(local)
    requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector('textarea') as HTMLTextAreaElement | null
      ta?.focus()
    })
  }, [local, onChange])

  return (
    <div
      ref={containerRef}
      data-color-mode="light"
      className={cn('w-full', disabled && 'pointer-events-none opacity-60')}
      onBlur={() => commit()}
    >
      <MDEditor
        value={local}
        height={height}
        onChange={handleChange}
        previewOptions={{ remarkPlugins: [remarkGfm] }}
      />
    </div>
  )
}
