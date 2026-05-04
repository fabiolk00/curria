import { ChevronRight, FileText } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { loadOptionalBillingInfo } from "@/lib/asaas/optional-billing-info"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { resolveSessionAtsReadiness } from "@/lib/ats/scoring"
import { db } from "@/lib/db/sessions"
import { PLANS } from "@/lib/plans"
import { buildResumeComparisonPath } from "@/lib/routes/app"
import { getExistingUserProfile } from "@/lib/profile/user-profiles"
import { getFallbackInitials, splitDisplayName } from "@/lib/user/display-name"

export const metadata = {
  title: "Configura\u00e7\u00f5es - CurrIA",
  description: "Gerencie seu perfil, plano e cr\u00e9ditos no CurrIA",
}

type FieldRowProps = {
  label: string
  value: ReactNode
  helper?: string
}

type FormattedSession = {
  id: string
  title: string
  createdAt: string
  atsReadiness: ReturnType<typeof resolveSessionAtsReadiness> | null
  workflowLabel: string
}

function formatSessionDate(value: Date): string {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatCreditCount(credits: number): string {
  return `${credits} cr\u00e9dito${credits === 1 ? "" : "s"}`
}

function parseWorkflowMode(mode?: string): "ats_enhancement" | "job_targeting" {
  return mode === "job_targeting" ? "job_targeting" : "ats_enhancement"
}

function getTargetRoleHint(targetJobDescription?: string): string | null {
  if (!targetJobDescription) {
    return null
  }

  const firstLine = targetJobDescription.split("\n")[0]?.trim() ?? ""
  const normalized = firstLine
    .replace(/^(?:cargo|vaga|position|role|title|funcao|funcao)\s*[:\-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()

  if (!normalized) {
    return null
  }

  return normalized.length > 50 ? `${normalized.slice(0, 47)}...` : normalized
}

function resolveSessionTitle(input: {
  workflowMode: "ats_enhancement" | "job_targeting"
  targetRoleHint: string | null
}): string {
  if (input.workflowMode === "job_targeting") {
    return input.targetRoleHint
      ? `Curr\u00edculo para ${input.targetRoleHint}`
      : "Curr\u00edculo para vaga-alvo"
  }

  return "Curr\u00edculo ATS otimizado"
}

function resolveWorkflowLabel(mode: "ats_enhancement" | "job_targeting"): string {
  return mode === "job_targeting" ? "Vaga alvo" : "ATS geral"
}

function FieldRow({ label, value, helper }: FieldRowProps) {
  return (
    <div className="grid gap-3 border-t border-border/70 px-4 py-3 sm:grid-cols-[1fr_220px] sm:items-center sm:px-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {helper ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
      </div>
      <div className="min-h-9 rounded-[6px] border border-border/80 bg-white px-3 py-2 text-sm font-medium text-foreground shadow-xs">
        {value}
      </div>
    </div>
  )
}

export default async function SettingsPage() {
  const appUser = await getCurrentAppUser()

  if (!appUser) {
    return null
  }

  const [{ billingInfo }, sessions, profile] = await Promise.all([
    loadOptionalBillingInfo(appUser.id, "settings_page"),
    db.getUserSessions(appUser.id, 2),
    getExistingUserProfile(appUser.id),
  ])

  const displayName = appUser.displayName?.trim()
  const email = appUser.primaryEmail || appUser.authIdentity.email || "N\u00e3o informado"
  const { firstName, lastName } = splitDisplayName(displayName)
  const avatarInitials = getFallbackInitials(displayName, email, "CR")
  const avatarImageUrl = profile?.profile_photo_url ?? null
  const planName = billingInfo ? PLANS[billingInfo.plan].name : "N\u00e3o informado"

  const formattedSessions: FormattedSession[] = sessions.map((session) => {
    const workflowMode = parseWorkflowMode(session.agentState.workflowMode)
    const targetRoleHint = getTargetRoleHint(session.agentState.targetJobDescription)

    return {
      id: session.id,
      title: resolveSessionTitle({
        workflowMode,
        targetRoleHint,
      }),
      createdAt: formatSessionDate(session.updatedAt),
      atsReadiness: resolveSessionAtsReadiness({ session }),
      workflowLabel: resolveWorkflowLabel(workflowMode),
    }
  })

  return (
    <div className="bg-bg-subtle px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[540px] space-y-5">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Perfil</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie seu perfil CurrIA</p>
        </header>

        <section className="overflow-hidden rounded-[8px] border border-border/80 bg-white shadow-xs">
          <div className="border-b border-border/70 bg-muted/50 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold text-foreground">Avatar</p>
          </div>

          <div className="flex justify-center bg-muted/60 px-4 py-8">
            <div aria-label="Avatar do perfil">
              <Avatar className="h-28 w-28 border border-border/50">
                <AvatarImage
                  className="object-cover"
                  src={avatarImageUrl ?? undefined}
                  alt={displayName ?? "Avatar do perfil"}
                />
                <AvatarFallback className="bg-[#3b8eea] text-4xl font-medium text-white">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <FieldRow label="Nome" value={<span className="break-words">{firstName}</span>} />
          <FieldRow label="Sobrenome" value={<span className="break-words">{lastName}</span>} />
          <FieldRow label="Email" value={<span className="break-all">{email}</span>} />
          <FieldRow label="Plano" value={planName} />
          <FieldRow label="Cr\u00e9ditos dispon\u00edveis" value={formatCreditCount(appUser.creditAccount.creditsRemaining)} />
        </section>

        <section className="overflow-hidden rounded-[8px] border border-border/80 bg-white shadow-xs">
          <div className="border-b border-border/70 bg-muted/50 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold text-foreground">2 \u00faltimos curr\u00edculos gerados</p>
          </div>

          {formattedSessions.length > 0 ? (
            <div className="divide-y divide-border/70">
              {formattedSessions.map((session) => (
                <Link
                  key={session.id}
                  href={buildResumeComparisonPath(session.id)}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] bg-muted text-muted-foreground">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {session.title}
                      </p>
                      <Badge variant="outline" className="rounded-[6px] text-[11px]">
                        {session.workflowLabel}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-xs text-muted-foreground">{session.createdAt}</p>
                      {session.atsReadiness?.display ? (
                        <Badge variant="secondary" className="rounded-[6px] text-[11px]">
                          ATS {session.atsReadiness.display.formattedScorePtBr}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary">
                    Abrir
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center sm:px-5">
              <p className="text-sm font-medium text-foreground">Nenhum curr\u00edculo gerado ainda.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Quando voc\u00ea gerar um curr\u00edculo, os acessos mais recentes aparecem aqui.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
