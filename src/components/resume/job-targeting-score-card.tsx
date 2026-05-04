"use client"

import { AlertCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { JobTargetingScoreBreakdown } from "@/types/agent"

type JobTargetingScoreCardProps = {
  breakdown: JobTargetingScoreBreakdown
  className?: string
}

function scoreColor(score: number): string {
  if (score >= 75) {
    return "bg-emerald-500"
  }

  if (score >= 50) {
    return "bg-amber-400"
  }

  return "bg-red-400"
}

function scoreTextColor(score: number): string {
  if (score >= 75) {
    return "text-emerald-600 dark:text-emerald-300"
  }

  if (score >= 50) {
    return "text-amber-700 dark:text-amber-300"
  }

  return "text-red-600 dark:text-red-300"
}

function toPercentage(score: number, max: number): number {
  if (max <= 0) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round((score / max) * 100)))
}

export function JobTargetingScoreCard({
  breakdown,
  className,
}: JobTargetingScoreCardProps) {
  const technicalScore = breakdown.technicalScore ?? breakdown.total
  const displayScore = breakdown.displayScore ?? breakdown.total
  const totalPercentage = toPercentage(displayScore, breakdown.maxTotal)
  const criticalGroups = breakdown.gapPresentation?.criticalGroups.length
    ? breakdown.gapPresentation.criticalGroups
    : breakdown.criticalGaps.length
      ? [{
        title: "Gaps críticos",
        items: breakdown.criticalGaps.slice(0, 5),
      }]
      : []

  return (
    <section
      data-testid="job-targeting-score-card"
      className={cn(
        "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold leading-tight text-zinc-950 dark:text-zinc-50">
            Compatibilidade com a vaga
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Diagnóstico estimado desta versão para os requisitos principais.
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("text-4xl font-bold leading-none tabular-nums sm:text-[2.75rem]", scoreTextColor(totalPercentage))}>
            {displayScore}
          </span>
          <span className="ml-1 align-baseline text-sm font-medium text-zinc-300 sm:text-base">/{breakdown.maxTotal}</span>
          {breakdown.scoreLabel ? (
            <p className="mt-1 max-w-32 text-right text-[11px] font-semibold leading-tight text-red-600 dark:text-red-300">
              {breakdown.scoreLabel}
            </p>
          ) : null}
          {displayScore !== technicalScore ? (
            <p className="mt-0.5 text-[10px] leading-tight text-zinc-400">
              Técnico: {technicalScore}/{breakdown.maxTotal}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Composição da nota
        </p>
        {breakdown.items.map((item) => {
          const itemPercentage = toPercentage(item.score, item.max)

          return (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  {item.label}
                </span>
                <span className="text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
                  {item.score}
                  <span className="font-normal text-zinc-400">/{item.max}</span>
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
                role="progressbar"
                aria-label={`Nota de ${item.label}`}
                aria-valuemin={1}
                aria-valuemax={item.max}
                aria-valuenow={item.score}
              >
                <div
                  className={cn("h-full rounded-full transition-all duration-500", scoreColor(itemPercentage))}
                  style={{ width: `${itemPercentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {criticalGroups.length > 0 ? (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Gaps críticos
          </p>
          <div className="mt-2 space-y-3">
            {criticalGroups.map((group) => (
              <div key={group.title} className="space-y-1.5">
                <p className="text-xs font-semibold leading-snug text-zinc-700 dark:text-zinc-200">
                  {group.title}
                </p>
                <ul className="space-y-2">
                  {group.items.map((gap) => (
                    <li key={`${group.title}-${gap}`} className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <span className="text-xs leading-relaxed text-red-700 dark:text-red-300">
                        {gap}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
