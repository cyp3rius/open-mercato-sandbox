"use client"

import * as React from 'react'
import type { MessageContentProps } from '@open-mercato/shared/modules/messages/types'

export function ProcedureNotifyMessageContent({ message }: MessageContentProps) {
  return (
    <section className="space-y-4">
      <div
        className="prose prose-sm max-w-none text-sm text-foreground [&>*]:mb-2 [&>*:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: message.body }}
      />
    </section>
  )
}

export default ProcedureNotifyMessageContent
