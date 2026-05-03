import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import type { ReactNode } from "react"

import Logo from "@/components/logo"

function buildAuthModeHref(path: "/entrar" | "/criar-conta", redirectTo?: string | null): string {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return path
  }

  return `${path}?redirect_to=${encodeURIComponent(redirectTo)}`
}

const features = [
  "Continue do ponto em que parou.",
  "Descubra o que melhorar no currículo com ajuda da IA.",
  "Suas análises ATS e PDFs ficam salvos na conta.",
]

export default function AuthShell({
  mode,
  title,
  description,
  children,
  redirectTo,
}: {
  mode: "login" | "signup"
  title: string
  description: string
  children: ReactNode
  redirectTo?: string | null
}) {
  return (
    <div className="flex min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-foreground via-foreground to-foreground/90 lg:flex lg:h-full lg:w-1/2">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-violet-900/20" />

        <div className="relative z-10 flex w-full flex-col justify-between p-8 xl:p-12">
          <div className="flex items-center">
            <Logo
              linkTo="/"
              className="items-center gap-2"
              iconClassName="h-10 w-10"
              textClassName="text-xl text-white"
            />
          </div>

          <div className="flex max-w-lg flex-1 flex-col justify-center py-6 xl:py-0">
            <h1 className="mb-5 text-3xl font-bold leading-tight text-white xl:mb-6 xl:text-5xl">
              {"Pare de enviar currículos genéricos."}
            </h1>
            <p className="mb-3 text-base leading-relaxed text-white/70 xl:mb-4 xl:text-lg">
              {"Deixe seu currículo mais claro para o ATS e aumente suas chances de entrevista."}
            </p>
            <p className="text-sm text-white xl:text-base">
              {"Seu currículo precisa mostrar rápido por que você merece avançar."}
            </p>
          </div>

          <div className="space-y-3 xl:space-y-4">
            {features.map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm xl:gap-4 xl:p-4"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-violet-400" />
                <span className="text-sm text-white/90">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto bg-muted/30 px-6 py-6 lg:h-full lg:w-1/2 lg:px-10 lg:py-8 xl:px-12 xl:py-10">
        <div className="w-full max-w-lg rounded-xl border border-border/50 bg-card shadow-xl">
          <div className="p-8">
            <div className="mb-8 flex items-center justify-center">
              <Logo
                linkTo="/"
                className="items-center gap-2"
                iconClassName="h-10 w-10"
                textClassName="text-xl"
              />
            </div>

            <div className="mb-8 flex items-center gap-2 rounded-xl bg-muted p-1.5">
              <Link
                href={buildAuthModeHref("/entrar", redirectTo)}
                className={`flex-1 rounded-lg px-4 py-3 text-center text-sm font-medium transition-all ${
                  mode === "login"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Entrar
              </Link>
              <Link
                href={buildAuthModeHref("/criar-conta", redirectTo)}
                className={`flex-1 rounded-lg px-4 py-3 text-center text-sm font-medium transition-all ${
                  mode === "signup"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Criar conta
              </Link>
            </div>

            <div className="mb-8 text-center">
              <h2 className="text-xl font-bold text-foreground">{title}</h2>
              {description ? (
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
              ) : null}
            </div>

            {children}
          </div>
        </div>
      </section>
    </div>
  )
}
