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
    <div className="space-y-3">
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
            "h-12 rounded-[10px] border-2 border-[#d0d0d5] bg-white px-4 text-base text-foreground shadow-none transition-colors",
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
      className="h-12 w-full rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/90"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
      className="h-12 w-full rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/90"
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
