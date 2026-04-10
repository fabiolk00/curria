import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"

import { getSafeRedirectPath } from "@/lib/auth/redirects"

export const metadata: Metadata = {
  title: "Continuar login - CurrIA",
  description: "Conclua as etapas adicionais de autenticacao na CurrIA",
}

type LoginContinuePageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

function readFirstParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0]
  }

  return null
}

function getContinuationMessage(status: string | null): string {
  switch (status) {
    case "needs_second_factor":
      return "Seu login precisa de uma verificacao adicional neste navegador. Continue abaixo."
    case "needs_new_password":
      return "Sua conta precisa definir uma nova senha antes de concluir o login."
    case "needs_first_factor":
    case "needs_identifier":
    case "abandoned":
      return "Retomamos seu login no fluxo seguro do Clerk para concluir a autenticacao."
    default:
      return "Continue seu login no fluxo seguro do Clerk."
  }
}

export default function LoginContinuePage({ searchParams }: LoginContinuePageProps) {
  const redirectTo = getSafeRedirectPath(readFirstParam(searchParams?.redirect_to))
  const status = readFirstParam(searchParams?.status)

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.15),transparent_45%)]" />
      <div className="pointer-events-none absolute bottom-[-10rem] left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(var(--chart-2)/0.12),transparent_60%)] blur-3xl" />
      <div className="relative w-full max-w-[440px] space-y-5">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Continuar login</h1>
          <p className="text-sm text-muted-foreground">{getContinuationMessage(status)}</p>
        </div>

        <SignIn
          routing="path"
          path="/login/continue"
          forceRedirectUrl={redirectTo}
          signUpUrl="/signup"
        />
      </div>
    </div>
  )
}
