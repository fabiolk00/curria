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
        'group relative flex w-4 shrink-0 cursor-col-resize items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-border/60 group-focus-visible:bg-border/60" />
      ) : null}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
