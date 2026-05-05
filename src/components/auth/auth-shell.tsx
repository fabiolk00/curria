import Link from "next/link"
import type { ReactNode } from "react"

import Logo from "@/components/logo"

function buildAuthModeHref(path: "/entrar" | "/criar-conta", redirectTo?: string | null): string {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return path
  }

  return `${path}?redirect_to=${encodeURIComponent(redirectTo)}`
}

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
    <main className="flex h-[100dvh] overflow-hidden flex-col items-center bg-gray-50 px-[clamp(0.75rem,2vw,3rem)] py-[clamp(0.5rem,1.6vh,1.5rem)] text-slate-900 selection:bg-gray-200 selection:text-gray-900 md:bg-white">
      <div className="mb-[clamp(0.25rem,1.4vh,1.25rem)] flex shrink-0 items-center justify-center">
        <Logo linkTo="/" variant="auth" className="justify-center" />
      </div>

      <section className="flex min-h-0 w-full max-w-[1120px] flex-1 flex-col overflow-hidden rounded-[clamp(16px,2vw,28px)] border border-gray-200/80 bg-white shadow-sm md:flex-row md:shadow-[0_2px_40px_-12px_rgba(0,0,0,0.04)]">
        <div className="relative flex min-h-0 flex-1 flex-col border-gray-100/70 p-[clamp(1rem,3vh,3.5rem)] md:border-r">
          <div className="mb-[clamp(0.75rem,2vh,1.75rem)] flex w-full shrink-0 justify-center">
            <div className="relative flex w-full max-w-[280px] rounded-xl bg-gray-100/80 p-1">
              <div
                className={`absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-[#111] shadow-sm transition-transform duration-300 ease-in-out ${
                  mode === "login" ? "translate-x-0" : "translate-x-[calc(100%+8px)]"
                }`}
              />
              <Link
                href={buildAuthModeHref("/entrar", redirectTo)}
                className={`z-10 flex-1 rounded-lg py-2 text-center text-[14px] font-semibold transition-colors duration-300 ${
                  mode === "login" ? "text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Entrar
              </Link>
              <Link
                href={buildAuthModeHref("/criar-conta", redirectTo)}
                className={`z-10 flex-1 rounded-lg py-2 text-center text-[14px] font-semibold transition-colors duration-300 ${
                  mode === "signup" ? "text-white" : "text-gray-500 hover:text-gray-900"
                }`}
              >
                Criar conta
              </Link>
            </div>
          </div>

          <div className="mx-auto flex min-h-0 w-full max-w-[360px] flex-1 flex-col justify-center [&_.space-y-6]:space-y-3 [&_form.space-y-5]:space-y-3 [&_form_.grid.gap-5]:gap-3">
            <div className="mb-[clamp(0.75rem,1.8vh,1.5rem)] shrink-0 text-center">
              <h1 className="text-[clamp(1rem,2.2vh,1.25rem)] font-semibold tracking-tight text-gray-950">
                {title}
              </h1>
              {description ? (
                <p className="mt-1 text-[clamp(0.75rem,1.55vh,0.875rem)] leading-5 text-gray-500">
                  {description}
                </p>
              ) : null}
            </div>
            {children}
          </div>

          <div className="mt-[clamp(0.5rem,1.4vh,1.25rem)] flex w-full shrink-0 justify-center [@media(max-height:760px)]:hidden">
            <p className="w-full max-w-[360px] text-center text-[11px] leading-[1.45] text-gray-500 md:text-left">
              Ao informar seu e-mail, você confirma que aceita receber contatos da Trampofy
              sobre nossos produtos e serviços. Você pode sair da lista a qualquer momento.
              Saiba mais em nossa{" "}
              <Link href="/privacidade" className="underline transition-colors hover:text-gray-800">
                política de privacidade
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="hidden flex-1 flex-col justify-center bg-gray-50/50 p-[clamp(2rem,5vw,4.5rem)] md:flex md:bg-transparent [@media(max-height:760px)]:hidden">
          <div className="mx-auto max-w-[420px] text-left">
            <h2 className="mb-[clamp(0.75rem,2vh,1.5rem)] text-[clamp(1.25rem,3vh,1.75rem)] font-semibold tracking-[-0.01em] text-gray-900">
              Bem-vindo ao Trampofy.
            </h2>

            <div className="space-y-[clamp(0.625rem,1.6vh,1.5rem)] text-[clamp(0.8125rem,1.6vh,0.9375rem)] leading-[1.55] text-gray-600">
              <p>
                O Trampofy ajuda você a transformar seu currículo real em versões mais
                claras, honestas e alinhadas para cada vaga.
              </p>

              <p>
                Analise a oportunidade, ajuste palavras-chave importantes para ATS e
                gere um currículo pronto para baixar sem inventar experiências.
              </p>

              <p>Vamos começar.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-[clamp(0.25rem,1.2vh,1rem)] flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1 pb-[clamp(0rem,0.8vh,0.5rem)] text-[clamp(0.6875rem,1.4vh,0.8125rem)] font-medium text-gray-500 [@media(max-height:700px)]:hidden">
        <span>© 2026 Trampofy</span>
        <Link href="/privacidade" className="transition-colors hover:text-gray-800">
          Política de privacidade
        </Link>
        <Link href="/termos" className="transition-colors hover:text-gray-800">
          Termos de uso
        </Link>
      </footer>
    </main>
  )
}
