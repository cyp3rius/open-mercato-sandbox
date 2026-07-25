'use client'

import * as React from 'react'
import { Info } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { SimpleTooltip, TooltipProvider } from '@open-mercato/ui/primitives/tooltip'

export function CustomerDetailSaveGuideHint() {
  const t = useT()
  const guide = t(
    'customers.detail.saveGuide',
    'Profile fields save with the main Save button. Tags save automatically. The related sections below save independently inside their own tabs and panels.',
  )
  const ariaLabel = t('customers.detail.saveGuide.aria', 'How saving works on this page')

  return (
    <TooltipProvider delayDuration={200}>
      <SimpleTooltip content={<span className="block max-w-xs text-left leading-relaxed">{guide}</span>} side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 px-0 text-muted-foreground"
          aria-label={ariaLabel}
        >
          <Info className="size-4" aria-hidden />
        </Button>
      </SimpleTooltip>
    </TooltipProvider>
  )
}
