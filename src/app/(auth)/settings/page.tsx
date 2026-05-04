import { ChevronRight, FileText } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { resolveSessionAtsReadiness } from "@/lib/ats/scoring"
import { loadOptionalBillingInfo } from "@/lib/asaas/optional-billing-info"
import { buildResumeGenerationHistoryMetadata } from "@/lib/resume-history/resume-generation-history"
import { getCurrentAppUser } from "@/lib/auth/app-user"
import { db } from "@/lib/db/sessions"
import { PLANS } from "@/lib/plans"
import { buildResumeComparisonPath } from "@/lib/routes/app"
import { getExistingUserProfile } from "@/lib/profile/user-profiles"
import { getFallbackInitials, splitDisplayName } from "@/lib/user/display-name"
import type { Session } from "@/types/agent"

export const metadata = {
  title: "Configurações - Trampofy",
  description: "Gerencie seu perfil, plano e créditos no Trampofy",
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
  return `${credits} crédito${credits === 1 ? "" : "s"}`
}

function parseWorkflowMode(mode?: string): "ats_enhancement" | "job_targeting" {
  return mode === "job_targeting" ? "job_targeting" : "ats_enhancement"
}

const TARGET_ROLE_MAX_LENGTH = 72
const TARGET_ROLE_MAX_WORDS = 12
const MAX_SESSION_ROLE_LINES = 6
const GENERIC_TARGET_ROLE_KEYWORDS = [
  "descri\u0063ao",
  "descripcion",
  "requisitos",
  "requisito",
  "vaga",
  "vaga alvo",
  "requisitos da vaga",
  "requisitos obrigatorios",
  "responsabilidades",
  "responsabilidade",
  "atividades",
  "resumo",
  "sobre a vaga",
  "sobre nos",
  "sobre o time",
  "empresa",
  "qualificacoes",
  "beneficios",
  "requisitos tecnicos",
  "job description",
  "about the role",
  "about the job",
  "job target",
]

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isGenericSectionLabel(value: string): boolean {
  const normalizedValue = normalizeText(value)

  return (
    GENERIC_TARGET_ROLE_KEYWORDS.includes(normalizedValue)
    || /curr[íi]culo\s+para\s+(?:descricao|descricao\s+da\s+vaga|requisitos|requisito|atividade|atividades|resumo|vaga|cargo|vaga\s+alvo)$/i
      .test(normalizedValue)
  )
}

function cleanTargetRole(value: string): string {
  return value
    .replace(/^\s*(?:[*\u2022\-]|\d+[.)]\s*)\s*/u, "")
    .replace(/^(?:cargo|vaga|position|role|title|funcao|função|nome da vaga|t[ií]tulo|titulo)\s*[:=\-]?\s*/iu, "")
    .replace(/\s+(?:para atuar|responsavel por|responsável por)\s*$/iu, "")
    .replace(/[.;:|]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
}

function hasRoleWords(value: string): boolean {
  const normalized = normalizeText(value)
  return !/^(?:we|we're|we are|looking for|buscamos|procuramos|estamos buscando|procurando)\b/u.test(normalized)
}

function isLikelyRoleLine(value: string): boolean {
  const targetRole = cleanTargetRole(value)

  if (!targetRole || isGenericSectionLabel(targetRole) || !hasRoleWords(targetRole)) {
    return false
  }

  if (targetRole.length > TARGET_ROLE_MAX_LENGTH || targetRole.length < 3) {
    return false
  }

  if (/(?:[.!?]|:)/u.test(targetRole)) {
    return false
  }

  const wordCount = targetRole.split(/\s+/u).filter(Boolean).length
  if (wordCount < 2 || wordCount > TARGET_ROLE_MAX_WORDS) {
    return false
  }

  return true
}

function extractTargetRoleFromAgentState(agentState: Session["agentState"]): string | null {
  const explicitPlanRole = cleanTargetRole(agentState.targetingPlan?.targetRole ?? "")
  if (explicitPlanRole && isLikelyRoleLine(explicitPlanRole)) {
    return explicitPlanRole
  }

  const compatibilityRole = cleanTargetRole(agentState.jobCompatibilityAssessment?.targetRole ?? "")
  if (compatibilityRole && isLikelyRoleLine(compatibilityRole)) {
    return compatibilityRole
  }

  const lines = (agentState.targetJobDescription ?? "")
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return null
  }

  const explicitRolePattern = /^\s*(?:cargo|vaga|title|position|role|job title|target role|nome da vaga|t[ií]tulo)\s*[:=\-]\s*(.+?)\s*$/iu
  for (let index = 0; index < Math.min(lines.length, MAX_SESSION_ROLE_LINES); index += 1) {
    const explicitMatch = lines[index].match(explicitRolePattern)
    const explicitCandidate = cleanTargetRole(explicitMatch?.[1] ?? "")
    if (explicitCandidate && isLikelyRoleLine(explicitCandidate)) {
      return explicitCandidate
    }
  }

  for (let index = 0; index < Math.min(lines.length, MAX_SESSION_ROLE_LINES); index += 1) {
    const candidate = cleanTargetRole(lines[index])
    if (isLikelyRoleLine(candidate)) {
      return candidate
    }
  }

  return null
}

function resolveSessionTitle(input: {
  workflowMode: "ats_enhancement" | "job_targeting"
  targetRoleHint: string | null
}): string {
  return buildResumeGenerationHistoryMetadata({
    workflowMode: input.workflowMode,
    targetRole: input.targetRoleHint,
  }).historyTitle
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
  const email = appUser.primaryEmail || appUser.authIdentity.email || "Não informado"
  const { firstName, lastName } = splitDisplayName(displayName)
  const avatarInitials = getFallbackInitials(displayName, email, "CR")
  const avatarImageUrl = profile?.profile_photo_url ?? null
  const planName = billingInfo ? PLANS[billingInfo.plan].name : "Não informado"

  const formattedSessions: FormattedSession[] = sessions.map((session) => {
    const workflowMode = parseWorkflowMode(session.agentState.workflowMode)
    const targetRoleHint = extractTargetRoleFromAgentState(session.agentState)

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
          <p className="mt-1 text-sm text-muted-foreground">Gerencie seu perfil Trampofy</p>
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
          <FieldRow
            label="Créditos disponíveis"
            value={formatCreditCount(appUser.creditAccount.creditsRemaining)}
          />
        </section>

        <section className="overflow-hidden rounded-[8px] border border-border/80 bg-white shadow-xs">
          <div className="border-b border-border/70 bg-muted/50 px-4 py-3 sm:px-5">
            <p className="text-xs font-semibold text-foreground">2 últimos currículos gerados</p>
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
              <p className="text-sm font-medium text-foreground">Nenhum currículo gerado ainda.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                Quando você gerar um currículo, os acessos mais recentes aparecem aqui.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

