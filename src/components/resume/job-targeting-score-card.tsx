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
    return "text-emerald-700 dark:text-emerald-300"
  }

  if (score >= 50) {
    return "text-amber-700 dark:text-amber-300"
  }

  return "text-red-600 dark:text-red-300"
}

export function JobTargetingScoreCard({
  breakdown,
  className,
}: JobTargetingScoreCardProps) {
  return (
    <section
      data-testid="job-targeting-score-card"
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Composição da nota
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Aderência estimada desta versão à vaga.
          </p>
        </div>
        <span className={cn("text-sm font-bold tabular-nums", scoreTextColor(breakdown.total))}>
          {breakdown.total}
          <span className="text-xs font-medium text-zinc-400">/{breakdown.maxTotal}</span>
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {breakdown.items.map((item) => (
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
                className={cn("h-full rounded-full transition-all duration-500", scoreColor(item.score))}
                style={{ width: `${item.score}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {breakdown.criticalGaps.length > 0 ? (
        <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
            Gaps críticos
          </p>
          <ul className="mt-2 space-y-2">
            {breakdown.criticalGaps.map((gap) => (
              <li key={gap} className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                <span className="text-xs leading-relaxed text-red-700 dark:text-red-300">
                  {gap}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
