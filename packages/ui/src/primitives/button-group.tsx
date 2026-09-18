import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { Separator } from './separator'

/** Flush item styles for `Button` / `IconButton` inside `ButtonGroup`. */
export const buttonGroupItemClassName =
  'rounded-none border-0 shadow-none focus-visible:relative focus-visible:z-10'

export function ButtonGroup({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  const items = React.Children.toArray(children)

  return (
    <div
      role="group"
      data-slot="button-group"
      className={cn(
        'inline-flex max-w-full flex-wrap items-stretch overflow-hidden rounded-md border border-border bg-background',
        className,
      )}
      {...props}
    >
      {items.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 ? (
            <Separator
              orientation="vertical"
              className="h-auto w-px shrink-0 self-stretch bg-border"
            />
          ) : null}
          {child}
        </React.Fragment>
      ))}
    </div>
  )
}
