import { currentUser } from "@clerk/nextjs/server"
import { BarChart3, CreditCard, Plus, Settings2, ShieldCheck, Sparkles } from "lucide-react"
import Link from "next/link"

import SessionList from "@/components/dashboard/session-list"
import { BillingActivityCard } from "@/components/dashboard/billing-activity-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PlanUpdateSection } from "@/components/dashboard/plan-update-section"
import { loadOptionalBillingInfo } from "@/lib/asaas/optional-billing-info"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { db } from "@/lib/db/sessions"
import { PLANS } from "@/lib/plans"

import { createSession } from "../dashboard/actions"

export const metadata = {
  title: "Configurações - CurrIA",
  description: "Gerencie sua conta, créditos e acessos no CurrIA",
}

function formatSessionDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default async function SettingsPage() {
  const [appUser, clerkUser] = await Promise.all([getCurrentAppUser(), currentUser()])

  if (!appUser) {
    return null
  }

  let billingInfo = null
  const billingResult = await loadOptionalBillingInfo(appUser.id, "settings_page")
  billingInfo = billingResult.billingInfo

  const sessions = await db.getUserSessions(appUser.id, 4)
  const firstName = clerkUser?.firstName?.trim() || clerkUser?.username || "Você"
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress ||
    clerkUser?.emailAddresses[0]?.emailAddress ||
    appUser.authIdentity.email ||
    "E-mail não disponível"

  const formattedSessions = sessions.map((session) => ({
    id: session.id,
    phase: session.phase,
    atsScore: session.atsScore?.total,
    createdAt: formatSessionDate(session.updatedAt),
  }))

  const bestScore = sessions.reduce<number | null>((best, session) => {
    const score = session.atsScore?.total
    if (score === undefined) {
      return best
    }

    if (best === null || score > best) {
      return score
    }

    return best
  }, null)

  return (
    <div className="relative overflow-hidden px-4 py-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,oklch(var(--primary)/0.14),transparent_62%)]" />
      <div className="pointer-events-none absolute right-0 top-20 h-64 w-64 bg-[radial-gradient(circle,oklch(var(--chart-2)/0.12),transparent_65%)] blur-3xl" />

      <div className="relative space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/90 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
          <div className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1.2fr)_340px] lg:px-8">
            <div>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]">
                Conta CurrIA
              </Badge>
              <h1 className="mt-4 text-3xl font-black tracking-tight lg:text-4xl">
                Tudo o que você precisa para continuar suas análises
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
                Acompanhe seus créditos, veja a atividade recente da conta e acesse os próximos passos sem mexer em nenhuma configuração crítica do produto.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <form action={createSession}>
                  <Button type="submit" className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova análise
                  </Button>
                </form>
                {billingInfo ? (
                  <PlanUpdateSection
                    activeRecurringPlan={billingInfo.hasActiveRecurringSubscription ? billingInfo.plan : null}
                    currentCredits={appUser.creditAccount.creditsRemaining}
                  />
                ) : (
                  <Button asChild variant="outline" className="rounded-full">
                    <Link href="/precos">
                      <CreditCard className="mr-2 h-4 w-4" />
                      Ver como funciona
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-border/60 bg-background/75 p-5 shadow-[0_24px_70px_-60px_oklch(var(--foreground)/0.8)]">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{firstName}</p>
                  <p className="text-sm text-muted-foreground">{email}</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Créditos disponíveis</span>
                  <span className="text-lg font-black">{appUser.creditAccount.creditsRemaining}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Sessões criadas</span>
                  <span className="text-lg font-black">{sessions.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                  <span className="text-sm text-muted-foreground">Melhor score ATS</span>
                  <span className="text-lg font-black">{bestScore ?? "--"}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
            <CardHeader className="pt-8">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Atividade recente
              </CardTitle>
              <CardDescription>
                Retome rapidamente suas últimas sessões sem sair da área autenticada.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-8">
              {formattedSessions.length > 0 ? (
                <SessionList sessions={formattedSessions} />
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/60 px-6 py-12 text-center text-sm text-muted-foreground">
                  Sua biblioteca ainda está vazia. Crie a primeira análise para ver atividade aqui.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
              <CardHeader className="pt-8">
                <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                  Upgrade rápido
                </CardTitle>
                <CardDescription>
                  Os planos pagos liberam mais créditos mensais e histórico de uso para processos paralelos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-8">
                <div className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4">
                  <p className="text-sm font-semibold">{PLANS.monthly.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {PLANS.monthly.credits} créditos por mês para manter várias candidaturas ativas.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-border/60 bg-background/75 p-4">
                  <p className="text-sm font-semibold">{PLANS.pro.name}</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {PLANS.pro.credits} créditos por mês para uso intenso, revisões frequentes e suporte prioritário.
                  </p>
                </div>
                <Button asChild className="w-full rounded-full">
                  <Link href="/precos">Abrir comparativo de planos</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-border/60 bg-card/90 py-0 shadow-[0_28px_90px_-70px_oklch(var(--foreground)/0.9)]">
              <CardHeader className="pt-8">
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Identificadores da conta
                </CardTitle>
                <CardDescription>
                  Informações úteis para suporte e verificação de acesso.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-8">
                <div className="rounded-[1.25rem] border border-border/60 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    App user
                  </p>
                  <p className="mt-2 break-all text-sm font-medium">{appUser.id}</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Clerk user
                  </p>
                  <p className="mt-2 break-all text-sm font-medium">{clerkUser?.id ?? "Não disponível"}</p>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-background/75 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Conta de créditos
                  </p>
                  <p className="mt-2 break-all text-sm font-medium">{appUser.creditAccount.id}</p>
                </div>
              </CardContent>
            </Card>

            <BillingActivityCard />
          </div>
        </section>
      </div>
    </div>
  )
}
