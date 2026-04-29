"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { RewriteChangeSummary } from "@/types/agent"

type RewriteDiffPanelProps = {
  changes: RewriteChangeSummary[]
  className?: string
}

function intensityLabel(intensity: RewriteChangeSummary["changeIntensity"]): string {
  if (intensity === "strong") {
    return "Forte"
  }

  if (intensity === "moderate") {
    return "Moderada"
  }

  if (intensity === "light") {
    return "Leve"
  }

  return "Sem mudança"
}

function TextBlock({
  label,
  text,
}: {
  label: "Antes" | "Depois"
  text: string
}) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
        {text || "Sem conteúdo nesta seção."}
      </p>
    </div>
  )
}

export function RewriteDiffPanel({
  changes,
  className,
}: RewriteDiffPanelProps) {
  const changedSections = changes.filter((change) => change.changed)

  if (changedSections.length === 0) {
    return null
  }

  return (
    <section
      data-testid="rewrite-diff-panel"
      className={cn(
        "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Entenda o que mudou
        </h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
          Compare as seções reescritas e veja quais requisitos motivaram cada ajuste.
        </p>
      </div>

      <Accordion type="single" collapsible className="mt-3">
        {changedSections.map((change) => (
          <AccordionItem
            key={change.id}
            value={change.id}
            data-testid="rewrite-change-section"
          >
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex flex-wrap items-center gap-2">
                <span>{change.sectionLabel}</span>
                <Badge variant="secondary" className="text-[11px]">
                  {intensityLabel(change.changeIntensity)}
                </Badge>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 md:grid-cols-2">
                <TextBlock label="Antes" text={change.beforeText} />
                <TextBlock label="Depois" text={change.afterText} />
              </div>

              {change.changeReasons.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    Por que mudou:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {change.changeReasons.map((reason) => (
                      <li
                        key={reason}
                        className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"
                      >
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {change.safetyNotes.length > 0 ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    O que não afirmamos:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {change.safetyNotes.map((note) => (
                      <li
                        key={note}
                        className="text-xs leading-relaxed text-amber-900 dark:text-amber-100"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
