"use client"

import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react"

import type { CvHighlightState } from "@/lib/resume/cv-highlight-artifact"
import { cn } from "@/lib/utils"

type ReviewItem = NonNullable<CvHighlightState["reviewItems"]>[number]

type ReviewWarningPanelProps = {
  items: ReviewItem[]
  hasInlineHighlights: boolean
  onItemSelect?: (item: ReviewItem) => void
  className?: string
}

const MOJIBAKE_REPAIRS: Array<[RegExp, string]> = [
  [/currÃƒÂ­culo|currÃ­culo/gi, "currículo"],
  [/atenÃƒÂ§ÃƒÂ£o|atenÃ§Ã£o/gi, "atenção"],
  [/aproximaÃƒÂ§ÃƒÂ£o|aproximaÃ§Ã£o/gi, "aproximação"],
  [/evidÃƒÂªncia|evidÃªncia/gi, "evidência"],
  [/experiÃƒÂªncia|experiÃªncia/gi, "experiência"],
  [/geraÃƒÂ§ÃƒÂ£o|geraÃ§Ã£o/gi, "geração"],
  [/adaptaÃƒÂ§ÃƒÂ£o|adaptaÃ§Ã£o/gi, "adaptação"],
  [/vocÃƒÂª|vocÃª/gi, "você"],
  [/nÃƒÂ£o|nÃ£o/gi, "não"],
]

export function repairMojibakeForDisplay(text: string): string {
  return MOJIBAKE_REPAIRS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  )
}

function inferHumanCopy(item: ReviewItem): {
  title: string
  description: string
  sectionLabel: string
} {
  const message = repairMojibakeForDisplay(item.message)
  const searchable = `${message} ${item.issueType ?? ""}`.toLocaleLowerCase()
  const sectionLabel = item.section === "experience"
    ? "Experiência"
    : item.section === "skills"
      ? "Skills"
      : item.section === "education"
        ? "Educação"
        : item.section === "certifications"
          ? "Certificações"
          : "Resumo"

  if (searchable.includes("skill sem evid") || searchable.includes("habilidade") || searchable.includes("unsupported")) {
    return {
      title: "Skill sem evidência suficiente",
      description: "O resumo pode mencionar uma habilidade que não aparece claramente no currículo original.",
      sectionLabel,
    }
  }

  if (
    searchable.includes("cargo alvo")
    || searchable.includes("se apresentar")
    || searchable.includes("target_role")
    || searchable.includes("low_fit")
  ) {
    return {
      title: "Cargo alvo assumido com pouca evidência",
      description: "O resumo pode estar se aproximando demais do cargo da vaga. Revise se essa apresentação representa bem seu histórico.",
      sectionLabel,
    }
  }

  if (item.severity === "supported") {
    return {
      title: "Trecho comprovado",
      description: "Este ponto tem sustentação no currículo original e foi destacado para conferência.",
      sectionLabel,
    }
  }

  if (item.severity === "caution") {
    return {
      title: "Aproximação cautelosa",
      description: "Este ponto cria uma ponte com a vaga, mas não deve soar como experiência direta sem base no seu histórico.",
      sectionLabel,
    }
  }

  return {
    title: "Ponto para revisar",
    description: message,
    sectionLabel,
  }
}

function SeverityBadge({ severity }: { severity: ReviewItem["severity"] }) {
  if (severity === "supported") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900">
        <CheckCircle2 className="h-3 w-3" />
        Comprovado
      </span>
    )
  }

  if (severity === "caution") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900">
        <Info className="h-3 w-3" />
        Atenção
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900">
      <AlertTriangle className="h-3 w-3" />
      Revisar
    </span>
  )
}

export function ReviewWarningPanel({
  items,
  hasInlineHighlights,
  onItemSelect,
  className,
}: ReviewWarningPanelProps) {
  const displayItems = items.filter((item) => item.severity === "risk" || item.inline)

  if (displayItems.length === 0) {
    return null
  }

  return (
    <aside
      data-testid="override-review-panel"
      className={cn(
        "rounded-lg border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-900/60 dark:bg-zinc-950",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Pontos para revisar
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
            A IA gerou esta versão mesmo com alguns avisos de aderência à vaga. Isso não impede o uso do currículo, mas recomendamos revisar estes pontos.
          </p>
        </div>
      </div>

      {!hasInlineHighlights ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Não há trechos destacados automaticamente, mas existem pontos de revisão listados abaixo.
        </p>
      ) : null}

      <div className="mt-4 space-y-3">
        {displayItems.map((item, index) => {
          const copy = inferHumanCopy(item)

          return (
            <button
              key={`${item.severity}-${item.issueType ?? "review"}-${index}`}
              type="button"
              onClick={() => onItemSelect?.(item)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-50 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-amber-900 dark:hover:bg-amber-950/30"
            >
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={item.severity} />
                <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {copy.sectionLabel}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {copy.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                {copy.description}
              </p>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
