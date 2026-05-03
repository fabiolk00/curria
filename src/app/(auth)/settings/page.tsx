import { currentUser } from "@clerk/nextjs/server"
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CreditCard,
  FileText,
  History,
  LifeBuoy,
  LockKeyhole,
  Mail,
  ReceiptText,
  ShieldAlert,
  Sparkles,
  User,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { BillingActivityCard } from "@/components/dashboard/billing-activity-card"
import { PlanUpdateSection } from "@/components/dashboard/plan-update-section"
import SessionList from "@/components/dashboard/session-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { loadOptionalBillingInfo } from "@/lib/asaas/optional-billing-info"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { isE2EAuthEnabled } from "@/lib/auth/e2e-auth"
import { canAccessOperationsDashboard } from "@/lib/auth/operations-access"
import { resolveSessionAtsReadiness } from "@/lib/ats/scoring"
import { db } from "@/lib/db/sessions"
import { PLANS } from "@/lib/plans"
import {
  DASHBOARD_RESUMES_HISTORY_PATH,
  GENERATE_RESUME_PATH,
  PROFILE_SETUP_PATH,
} from "@/lib/routes/app"
import { PUBLIC_SECTION_ROUTES } from "@/lib/routes/public"

export const metadata = {
  title: "Configurações - CurrIA",
  description: "Gerencie sua conta, créditos e acessos no CurrIA",
}

type SettingsSectionProps = {
  title: string
  description: string
  children: ReactNode
  tone?: "default" | "danger"
}

type SettingsRowProps = {
  icon: LucideIcon
  label: string
  description: string
  value?: ReactNode
  action?: ReactNode
  tone?: "default" | "danger"
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

function formatAbsoluteDate(value: string): string | null {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) {
    return null
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatBillingStatus(status: "active" | "canceled" | "past_due" | null | undefined): string {
  switch (status) {
    case "active":
      return "Ativo"
    case "canceled":
      return "Cancelado"
    case "past_due":
      return "Pagamento pendente"
    default:
      return "Sem status de cobrança"
  }
}

function formatCreditCount(credits: number): string {
  return `${credits} crédito${credits === 1 ? "" : "s"}`
}

function formatAvailableCreditCount(credits: number): string {
  return credits === 1 ? "1 disponível" : `${credits} disponíveis`
}

function getAtsReadinessSnapshotForSession(session: Parameters<typeof resolveSessionAtsReadiness>[0]["session"]) {
  return resolveSessionAtsReadiness({ session })
}

function SettingsSection({
  title,
  description,
  children,
  tone = "default",
}: SettingsSectionProps) {
  return (
    <section
      className={
        tone === "danger"
          ? "overflow-hidden rounded-[8px] border border-rose-200 bg-white shadow-xs"
          : "overflow-hidden rounded-[8px] border border-border/70 bg-white shadow-xs"
      }
    >
      <div
        className={
          tone === "danger"
            ? "border-b border-rose-100 px-5 py-4 sm:px-6"
            : "border-b border-border/70 px-5 py-4 sm:px-6"
        }
      >
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      <div className={tone === "danger" ? "divide-y divide-rose-100" : "divide-y divide-border/70"}>
        {children}
      </div>
    </section>
  )
}

function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  action,
  tone = "default",
}: SettingsRowProps) {
  return (
    <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex min-w-0 gap-3">
        <div
          className={
            tone === "danger"
              ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-rose-50 text-rose-700"
              : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-muted text-muted-foreground"
          }
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className={tone === "danger" ? "text-sm font-semibold text-rose-950" : "text-sm font-semibold text-foreground"}>
            {label}
          </p>
          <p className={tone === "danger" ? "mt-1 text-sm leading-6 text-rose-800/80" : "mt-1 text-sm leading-6 text-muted-foreground"}>
            {description}
          </p>
        </div>
      </div>

      {(value || action) ? (
        <div className="flex shrink-0 flex-col gap-2 sm:min-w-[220px] sm:items-end">
          {value ? <div className="text-sm font-medium text-foreground sm:text-right">{value}</div> : null}
          {action}
        </div>
      ) : null}
    </div>
  )
}

function IdentifierRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="max-w-xl break-all text-left text-sm font-medium text-foreground sm:text-right">
        {value}
      </p>
    </div>
  )
}

export default async function SettingsPage() {
  const [appUser, clerkUser] = await Promise.all([
    getCurrentAppUser(),
    isE2EAuthEnabled() ? Promise.resolve(null) : currentUser(),
  ])

  if (!appUser) {
    return null
  }

  const { billingInfo, billingNotice } = await loadOptionalBillingInfo(appUser.id, "settings_page")
  const sessions = await db.getUserSessions(appUser.id, 4)
  const displayName =
    clerkUser?.fullName?.trim()
    || clerkUser?.firstName?.trim()
    || clerkUser?.username
    || appUser.displayName?.trim()
    || "Conta CurrIA"
  const email =
    clerkUser?.primaryEmailAddress?.emailAddress
    || clerkUser?.emailAddresses[0]?.emailAddress
    || appUser.primaryEmail
    || appUser.authIdentity.email
    || "E-mail não disponível"
  const planName = billingInfo ? PLANS[billingInfo.plan].name : "Não informado"
  const billingStatus = billingInfo ? formatBillingStatus(billingInfo.status) : "Não carregado"
  const renewalDate = billingInfo?.renewsAt ? formatAbsoluteDate(billingInfo.renewsAt) : null
  const activeRecurringPlan = billingInfo?.hasActiveRecurringSubscription ? billingInfo.plan : null
  const showOperationsLink = canAccessOperationsDashboard(appUser)

  const formattedSessions = sessions.map((session) => ({
    atsReadiness: getAtsReadinessSnapshotForSession(session),
    id: session.id,
    phase: session.phase,
    createdAt: formatSessionDate(session.updatedAt),
  }))

  return (
    <div className="bg-bg-subtle px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Configurações
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Conta e uso do CurrIA
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Este é o centro de controle da sua conta: identidade, créditos, plano, histórico de geração e informações úteis para suporte.
          </p>
        </header>

        <SettingsSection
          title="Visão geral da conta"
          description="Dados principais usados para identificar sua conta e resumir seu acesso atual."
        >
          <SettingsRow
            icon={User}
            label={displayName}
            description="Nome exibido na conta CurrIA."
            value={<Badge variant="secondary" className="rounded-[8px]">Conta autenticada</Badge>}
          />
          <SettingsRow
            icon={Mail}
            label="E-mail principal"
            description="Usado para autenticação, suporte e comunicações transacionais."
            value={<span className="break-all">{email}</span>}
          />
          <SettingsRow
            icon={BadgeCheck}
            label="Plano atual"
            description="O plano controla limites, renovações e opções disponíveis para geração."
            value={planName}
          />
          <SettingsRow
            icon={WalletCards}
            label="Créditos disponíveis"
            description="Saldo usado para gerar otimizações e currículos adaptados."
            value={formatCreditCount(appUser.creditAccount.creditsRemaining)}
          />
        </SettingsSection>

        <SettingsSection
          title="Plano e créditos"
          description="Acompanhe consumo, cobrança e próximos passos de assinatura sem alterar regras de billing."
        >
          <SettingsRow
            icon={WalletCards}
            label="Saldo de créditos"
            description="Use créditos para gerar versões ATS ou adaptar currículos para vagas específicas."
            value={
              billingInfo
                ? `${billingInfo.creditsRemaining} de ${billingInfo.maxCredits}`
                : formatAvailableCreditCount(appUser.creditAccount.creditsRemaining)
            }
          />
          <SettingsRow
            icon={CreditCard}
            label="Status do plano"
            description={billingNotice ?? "Informação carregada do estado de billing atual da conta."}
            value={billingStatus}
          />
          <SettingsRow
            icon={CalendarClock}
            label="Renovação"
            description="Quando disponível, mostra a próxima data registrada para renovação do plano recorrente."
            value={
              renewalDate
                ? `Renova em ${renewalDate}`
                : billingInfo?.hasActiveRecurringSubscription
                  ? "Renovação sem data registrada"
                  : "Sem renovação recorrente ativa"
            }
          />
          <SettingsRow
            icon={Sparkles}
            label="Alterar plano"
            description="Abra o seletor existente de planos. Restrições de plano recorrente continuam valendo no modal."
            action={
              billingInfo ? (
                <PlanUpdateSection
                  activeRecurringPlan={activeRecurringPlan}
                  currentCredits={appUser.creditAccount.creditsRemaining}
                />
              ) : (
                <Button asChild variant="outline" className="rounded-[8px]">
                  <Link href={PUBLIC_SECTION_ROUTES.pricing}>Ver planos</Link>
                </Button>
              )
            }
          />
          <SettingsRow
            icon={ArrowUpRight}
            label="Comparativo de preços"
            description="Veja todos os planos públicos usando a rota oficial de pricing."
            action={
              <Button asChild variant="ghost" className="rounded-[8px]">
                <Link href={PUBLIC_SECTION_ROUTES.pricing}>Abrir preços</Link>
              </Button>
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Currículo e perfil"
          description="Entradas rápidas para manter seu currículo base e iniciar novas otimizações."
        >
          <SettingsRow
            icon={FileText}
            label="Perfil e currículo base"
            description="Revise dados pessoais, experiências, skills e a base usada para novas gerações."
            action={
              <Button asChild variant="outline" className="rounded-[8px]">
                <Link href={PROFILE_SETUP_PATH}>Editar perfil</Link>
              </Button>
            }
          />
          <SettingsRow
            icon={Sparkles}
            label="Nova otimização ATS"
            description="Abra a tela dedicada para melhorar para ATS ou adaptar para uma vaga específica."
            action={
              <Button asChild className="rounded-[8px]">
                <Link href={GENERATE_RESUME_PATH}>Gerar currículo</Link>
              </Button>
            }
          />
          <SettingsRow
            icon={History}
            label="Histórico de currículos gerados"
            description="Acesse versões geradas, compare resultados e retome downloads protegidos."
            value={`${sessions.length} sessão${sessions.length === 1 ? "" : "s"} recente${sessions.length === 1 ? "" : "s"}`}
            action={
              <Button asChild variant="ghost" className="rounded-[8px]">
                <Link href={DASHBOARD_RESUMES_HISTORY_PATH}>Ver histórico</Link>
              </Button>
            }
          />
        </SettingsSection>

        <SettingsSection
          title="Atividade recente"
          description="Suas últimas sessões com o mesmo snapshot de ATS Readiness usado nas demais superfícies."
        >
          <div className="px-5 py-4 sm:px-6">
            {formattedSessions.length > 0 ? (
              <SessionList sessions={formattedSessions} variant="compact" />
            ) : (
              <div className="rounded-[8px] border border-dashed border-border/70 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Nenhuma sessão recente ainda.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  Quando você gerar ou adaptar um currículo, os acessos rápidos vão aparecer aqui.
                </p>
              </div>
            )}
          </div>
        </SettingsSection>

        <BillingActivityCard className="rounded-[8px] shadow-xs" />

        <SettingsSection
          title="Suporte e identificadores"
          description="Use estes identificadores ao falar com suporte. Eles ficam em baixa ênfase porque não fazem parte do uso diário."
        >
          <IdentifierRow label="App user" value={appUser.id} />
          <IdentifierRow label="Clerk user" value={clerkUser?.id ?? "Não disponível"} />
          <IdentifierRow label="Conta de créditos" value={appUser.creditAccount.id} />
          {showOperationsLink ? (
            <SettingsRow
              icon={LifeBuoy}
              label="Operações internas"
              description="Acesso administrativo disponível para esta conta."
              action={
                <Button asChild variant="outline" className="rounded-[8px]">
                  <Link href="/operations">Abrir operações</Link>
                </Button>
              }
            />
          ) : null}
        </SettingsSection>

        <SettingsSection
          title="Zona sensível"
          description="Ações destrutivas ou de alto impacto ficam isoladas para evitar mudanças acidentais."
          tone="danger"
        >
          <SettingsRow
            icon={ShieldAlert}
            label="Exclusão de conta"
            description="Exclusão de conta ainda não está disponível pelo painel. Entre em contato com suporte para tratar dados e acesso com segurança."
            tone="danger"
            action={
              <Button type="button" variant="destructive" className="rounded-[8px]" disabled>
                Não disponível
              </Button>
            }
          />
          <SettingsRow
            icon={LockKeyhole}
            label="Segurança da conta"
            description="Autenticação e credenciais são gerenciadas pelo provedor de login. Ações críticas não são executadas por UI sem backend seguro."
            tone="danger"
          />
          <SettingsRow
            icon={ReceiptText}
            label="Suporte"
            description="Para dúvidas de cobrança, créditos ou privacidade, fale com support@curria.com.br."
            tone="danger"
          />
        </SettingsSection>
      </div>
    </div>
  )
}
