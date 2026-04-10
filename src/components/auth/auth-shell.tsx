import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import type { ReactNode } from "react"

import Logo from "@/components/logo"

const loginBenefits = [
  "Continue de onde voce parou no seu curriculo otimizado.",
  "Email e senha funcionam melhor em navegadores embutidos.",
  "Suas analises ATS e PDFs ficam salvos na sua conta.",
]

export default function AuthShell({
  mode,
  eyebrow,
  title,
  description,
  children,
}: {
  mode: "login" | "signup"
  eyebrow: string
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fb_0%,#eef2ff_100%)]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#2952f3_0%,#3f6af8_44%,#547cf8_100%)] px-6 py-8 text-white sm:px-10 lg:px-12 lg:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_32%)]" />
          <div className="relative flex h-full flex-col">
            <div className="inline-flex w-fit items-center rounded-full border border-white/25 bg-white/10 px-3 py-1.5 backdrop-blur">
              <Logo linkTo="/" />
            </div>

            <div className="mt-12 max-w-2xl lg:mt-20">
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-white/70">{eyebrow}</p>
              <h1 className="mt-5 max-w-xl text-4xl font-black leading-[1.02] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Entre rapido e continue seu curriculo otimizado sem atrito.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-white/82 sm:text-lg">
                Seu perfil salvo ja alimenta a experiencia. Aqui voce entra, revisa a aderencia ATS e gera o PDF
                final sem perder o contexto da sessao.
              </p>
            </div>

            <div className="mt-10 space-y-4 lg:mt-auto">
              {loginBenefits.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-3 rounded-2xl border border-white/18 bg-white/8 px-4 py-4 text-sm font-medium text-white/92 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-sm sm:text-base"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/14">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="w-full max-w-[34rem] rounded-[2rem] border border-slate-200/80 bg-white/92 p-4 shadow-[0_24px_80px_rgba(43,62,130,0.14)] backdrop-blur sm:p-6 lg:p-8">
            <div className="rounded-[1.6rem] border border-slate-200/70 bg-slate-50/90 p-2">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className={`rounded-[1.15rem] px-4 py-3 text-center text-sm font-semibold transition ${
                    mode === "login"
                      ? "bg-white text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                  }`}
                >
                  Entrar
                </Link>
                <Link
                  href="/signup"
                  className={`rounded-[1.15rem] px-4 py-3 text-center text-sm font-semibold transition ${
                    mode === "signup"
                      ? "bg-white text-slate-950 shadow-[0_8px_24px_rgba(15,23,42,0.08)]"
                      : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                  }`}
                >
                  Criar conta
                </Link>
              </div>
            </div>

            <div className="px-2 pb-2 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">{eyebrow}</p>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950">{title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
            </div>

            <div className="mt-4">{children}</div>

            <div className="mt-6 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Melhor experiencia em navegadores embutidos</p>
              <p className="mt-1 leading-6 text-slate-600">
                Se Google falhar no X ou Threads, use email e senha para entrar sem sair da app.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
