"use client"

import { useState } from "react"
import { ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TargetRecommendation } from "@/types/agent"

type TargetRecommendationsCardProps = {
  recommendations: TargetRecommendation[]
  className?: string
}

const INITIAL_VISIBLE_COUNT = 3

function priorityLabel(priority: TargetRecommendation["priority"]): string {
  if (priority === "high") {
    return "Alta"
  }

  if (priority === "medium") {
    return "Média"
  }

  return "Baixa"
}

export function TargetRecommendationsCard({
  recommendations,
  className,
}: TargetRecommendationsCardProps) {
  const [expanded, setExpanded] = useState(false)
  const visibleRecommendations = expanded
    ? recommendations
    : recommendations.slice(0, INITIAL_VISIBLE_COUNT)

  if (recommendations.length === 0) {
    return null
  }

  return (
    <section
      data-testid="target-recommendations-card"
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Sugestões para melhorar sua aderência
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            Encontramos requisitos da vaga que estão próximos do seu perfil, mas não aparecem de forma explícita no currículo.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <ShieldCheck className="h-3 w-3" />
          Adicione apenas se for verdadeiro
        </Badge>
      </div>

      <ol className="mt-4 space-y-3">
        {visibleRecommendations.map((recommendation, index) => (
          <li
            key={recommendation.id}
            data-testid="target-recommendation-item"
            className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/70"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                {index + 1}.
              </span>
              <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {recommendation.jobRequirement}
              </span>
              <Badge variant="secondary" className="text-[11px]">
                {priorityLabel(recommendation.priority)}
              </Badge>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
              {recommendation.suggestedUserAction}
            </p>
            {recommendation.safeExample ? (
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">Exemplo seguro:</span>{" "}
                {recommendation.safeExample}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {recommendations.length > INITIAL_VISIBLE_COUNT ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((value) => !value)}
          className="mt-4"
        >
          {expanded ? "Mostrar menos" : "Ver todas"}
        </Button>
      ) : null}
    </section>
  )
}
