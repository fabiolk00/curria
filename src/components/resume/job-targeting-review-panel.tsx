"use client"

import { AlertTriangle, CheckCircle2, CircleAlert, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type {
  UserFriendlyJobReview,
  UserFriendlyRequirementCard,
  UserFriendlyRequirementStatus,
} from "@/lib/agent/job-targeting/user-friendly-review"

type JobTargetingReviewPanelProps = {
  review: UserFriendlyJobReview
  className?: string
  surface?: "pre_generation" | "post_generation"
  onAddEvidence?: (requirement: UserFriendlyRequirementCard) => void
  onContinueWithoutRequirement?: (requirement: UserFriendlyRequirementCard) => void
  onGenerateConservativeVersion?: () => void
  onChooseAnotherJob?: () => void
}

const STATUS_CONFIG: Record<UserFriendlyRequirementStatus, {
  badge: string
  borderClassName: string
  badgeClassName: string
  icon: typeof CheckCircle2
  iconClassName: string
}> = {
  proven: {
    badge: "Comprovado",
    borderClassName: "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    badgeClassName: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600 dark:text-emerald-300",
  },
  related: {
    badge: "Experiência relacionada",
    borderClassName: "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20",
    badgeClassName: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
    icon: AlertTriangle,
    iconClassName: "text-amber-600 dark:text-amber-300",
  },
  needs_evidence: {
    badge: "Precisa de evidência",
    borderClassName: "border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20",
    badgeClassName: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200",
    icon: CircleAlert,
    iconClassName: "text-sky-600 dark:text-sky-300",
  },
}

function RequirementCard({
  requirement,
  onAddEvidence,
  onContinueWithoutRequirement,
}: {
  requirement: UserFriendlyRequirementCard
  onAddEvidence?: (requirement: UserFriendlyRequirementCard) => void
  onContinueWithoutRequirement?: (requirement: UserFriendlyRequirementCard) => void
}) {
  const config = STATUS_CONFIG[requirement.status]
  const Icon = config.icon

  return (
    <article
      data-testid={`job-targeting-review-card-${requirement.status}`}
      className={cn("rounded-lg border p-3", config.borderClassName)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClassName)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
              {requirement.label}
            </h3>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", config.badgeClassName)}>
              {config.badge}
            </span>
          </div>

          <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {requirement.explanation}
          </p>

          {requirement.foundEvidence.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                Encontramos evidência no seu currículo:
              </p>
              <ul className="space-y-1">
                {requirement.foundEvidence.map((evidence) => (
                  <li key={evidence} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    “{evidence}”
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {requirement.safeSuggestion ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold">Sugestão segura: </span>
              {requirement.safeSuggestion}
            </p>
          ) : null}

          {requirement.canAddEvidence && (onAddEvidence || onContinueWithoutRequirement) ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {onAddEvidence ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onAddEvidence(requirement)}
                >
                  Adicionar evidência
                </Button>
              ) : null}
              {onContinueWithoutRequirement ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onContinueWithoutRequirement(requirement)}
                >
                  Continuar sem mencionar {requirement.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export function JobTargetingReviewPanel({
  review,
  className,
  surface = "pre_generation",
  onAddEvidence,
  onContinueWithoutRequirement,
  onGenerateConservativeVersion,
  onChooseAnotherJob,
}: JobTargetingReviewPanelProps) {
  const isLowFit = review.fitLevel === "low"
  const isPostGeneration = surface === "post_generation"
  const eyebrow = isPostGeneration ? "Diagnostico da versao gerada" : "RevisÃ£o antes de gerar"
  const title = isPostGeneration && review.title.includes("Antes de gerar")
    ? "Pontos de aderencia para revisar"
    : review.title
  const description = isPostGeneration
    ? "A versao gerada evita afirmar requisitos sem evidencia direta. Estes pontos ficaram como diagnostico para ajuste manual do perfil."
    : review.description
  const helperText = isPostGeneration
    ? "Use estes gaps como checklist de evidencias reais que podem melhorar proximas versoes."
    : "VocÃª pode adicionar uma evidÃªncia real ao seu perfil ou continuar com uma versÃ£o mais conservadora."

  return (
    <section
      data-testid="job-targeting-review-panel"
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-bold leading-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {description}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {helperText}
          </p>
        </div>
      </div>

      {isLowFit ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
          <p className="font-semibold">Essa vaga parece um pouco distante do seu currículo atual</p>
          <p className="mt-1 leading-relaxed">
            A versão conservadora valoriza o que você realmente já fez, sem inventar experiências.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {review.requirements.map((requirement) => (
          <RequirementCard
            key={requirement.id}
            requirement={requirement}
            onAddEvidence={onAddEvidence}
            onContinueWithoutRequirement={onContinueWithoutRequirement}
          />
        ))}
      </div>

      {(onGenerateConservativeVersion || onChooseAnotherJob) && review.canGenerateConservativeVersion ? (
        <div className="mt-5 flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row">
          {onGenerateConservativeVersion ? (
            <Button type="button" onClick={onGenerateConservativeVersion}>
              Gerar versão conservadora
            </Button>
          ) : null}
          {onChooseAnotherJob ? (
            <Button type="button" variant="outline" onClick={onChooseAnotherJob}>
              Escolher outra vaga
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
