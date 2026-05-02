'use client'

import { Check, Loader2, X } from 'lucide-react'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      closeButton
      icons={{
        loading: <Loader2 className="h-4 w-4 animate-spin text-white" />,
        success: (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
        ),
        error: (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white">
            <X className="h-3.5 w-3.5" />
          </span>
        ),
        close: <X className="h-4 w-4 text-white" />,
      }}
      toastOptions={{
        classNames: {
          closeButton: '!border-white/15 !bg-black !text-white hover:!bg-white/10 hover:!text-white',
        },
      }}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--color-action-primary)',
          '--normal-text': 'var(--color-action-primary-text)',
          '--normal-border': '#3f3f46',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
