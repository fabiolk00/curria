"use client"

import { AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export function AuthDivider() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Ou
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export function AuthErrorMessage({ message }: { message: string | null }) {
  if (!message) {
    return null
  }

  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

export function AuthField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  endAdornment,
}: {
  id: string
  label: string
  type?: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  endAdornment?: ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor={id}
        className="text-sm font-semibold text-foreground"
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-11 rounded-[10px] border-2 border-[#d0d0d5] bg-white px-4 text-base text-foreground shadow-none transition-colors",
            "placeholder:text-[#727286] focus-visible:border-foreground focus-visible:ring-0",
            endAdornment ? "pr-12" : "",
          )}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {endAdornment}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AuthGoogleButton({
  onClick,
  pending,
  children = "Continuar com Google",
}: {
  onClick: () => void | Promise<void>
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <Button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      className="h-11 w-full rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/90"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
        >
          <path
            fill="#EA4335"
            d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5a9.5 9.5 0 1 0 0 19c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12Z"
          />
          <path
            fill="#34A853"
            d="M3.6 7.9 6.8 10.3A6 6 0 0 1 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5c-3.7 0-6.9 2.1-8.4 5.4Z"
          />
          <path
            fill="#FBBC05"
            d="M12 21.5c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.5-1.8.9-3.3.9-3.8 0-5.2-2.5-5.4-3.8l-3.3 2.5A9.5 9.5 0 0 0 12 21.5Z"
          />
          <path
            fill="#4285F4"
            d="M3.3 16.4 6.6 14A5.7 5.7 0 0 1 6.3 12c0-.7.1-1.4.3-2L3.3 7.5A9.4 9.4 0 0 0 2.5 12c0 1.6.4 3.1.8 4.4Z"
          />
        </svg>
      )}
      <span>{children}</span>
    </Button>
  )
}

export function AuthLinkedInButton({
  onClick,
  pending,
  children = "Continuar com LinkedIn",
}: {
  onClick: () => void | Promise<void>
  pending?: boolean
  children?: ReactNode
}) {
  return (
    <Button
      type="button"
      onClick={() => void onClick()}
      disabled={pending}
      className="h-11 w-full rounded-xl bg-[#0A66C2] text-white shadow-none hover:bg-[#004182]"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
        >
          <path
            fill="currentColor"
            d="M20.45 20.45h-3.56v-5.58c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.68H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.32 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.54V9H7.1v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z"
          />
        </svg>
      )}
      <span>{children}</span>
    </Button>
  )
}

export function AuthSubmitButton({
  label,
  pending,
  disabled,
}: {
  label: string
  pending?: boolean
  disabled?: boolean
}) {
  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className="h-11 w-full rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/90"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
      )}
      <span>{label}</span>
    </Button>
  )
}
