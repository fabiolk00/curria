'use client'

import * as React from 'react'
import * as ResizablePrimitive from 'react-resizable-panels'

import { cn } from '@/lib/utils'

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      className={cn(
        'flex h-full w-full',
        className,
      )}
      {...props}
    />
  )
}

function ResizablePanel(
  props: React.ComponentProps<typeof ResizablePrimitive.Panel>,
) {
  return <ResizablePrimitive.Panel {...props} />
}

function ResizableHandle({
  className,
  withHandle = false,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      className={cn(
        'group relative flex w-5 shrink-0 cursor-col-resize items-center justify-center focus-visible:outline-none',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border/50 transition-colors group-hover:bg-border group-focus-visible:bg-border" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-16 w-[4px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/12 transition-colors group-hover:bg-foreground/18 group-focus-visible:bg-foreground/18" />
        </>
      ) : null}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
