"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react"

import type { CvHighlightState } from "@/lib/resume/cv-highlight-artifact"
import { cn } from "@/lib/utils"

type ReviewItem = NonNullable<CvHighlightState["reviewItems"]>[number]

const MOJIBAKE_MARKER_RE = new RegExp("(?:\\u00c3|\\u00c2|\\u00e2|\\ufffd)", "u")
const FALLBACK_PROFILE = "O currículo original não deixou claro um perfil diretamente alinhado a esta vaga."

function markerCount(value: string): number {
  return Array.from(value.matchAll(new RegExp(MOJIBAKE_MARKER_RE.source, "gu"))).length
}

function decodeLatin1Utf8(value: string): string | null {
  if (!MOJIBAKE_MARKER_RE.test(value)) return value
  if ([...value].some((char) => char.charCodeAt(0) > 255)) return null

  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0)))
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export function repairMojibakeForDisplay(text: string): string {
  let current = text

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const repaired = decodeLatin1Utf8(current)
    if (!repaired || repaired === current) break
    if (markerCount(repaired) > markerCount(current)) break
    current = repaired
  }

  return current
}

function normalizeForComparison(value: string): string {
  return repairMojibakeForDisplay(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const repaired = repairMojibakeForDisplay(value).trim()
    const normalized = normalizeForComparison(repaired)
    if (!repaired || !normalized || seen.has(normalized)) return
    seen.add(normalized)
    result.push(repaired)
  })

  return result
}

function isGenericProvenProfile(value: string): boolean {
  const normalized = normalizeForComparison(value)
  if (!normalized) return true

  return normalized === "profissional"
    || normalized === "perfil profissional"
    || normalized === normalizeForComparison("experiência anterior")
    || normalized.includes(normalizeForComparison("profissional com experiência técnica aderente"))
    || normalized.includes(normalizeForComparison("profissional com experiência anterior"))
    || normalized.includes(normalizeForComparison("experiência técnica comprovada no currículo original"))
}

function resolveProvenProfile(item: ReviewItem): string {
  const repaired = repairMojibakeForDisplay(item.provenProfile || item.originalProfileLabel || "").trim()
  return repaired && !isGenericProvenProfile(repaired) ? repaired : FALLBACK_PROFILE
}

function resolveLists(item: ReviewItem): {
  compactCritical: string[]
  visibleJobRequirements: string[]
  visiblePreferredRequirements: string[]
  visibleMissingEvidence: string[]
} {
  const jobRequirements = dedupe(item.jobRequirements ?? [])
  const preferredRequirements = dedupe(item.preferredRequirements ?? [])
  const missingEvidence = dedupe(item.missingEvidence ?? item.unsupportedRequirements ?? jobRequirements)
  const visibleJobRequirements = jobRequirements.slice(0, 6)
  const visiblePreferredRequirements = preferredRequirements.slice(0, 5)
  const leadingJobKeys = new Set(visibleJobRequirements.slice(0, 3).map(normalizeForComparison))
  const filteredMissing = missingEvidence.filter((value) => !leadingJobKeys.has(normalizeForComparison(value)))
  const visibleMissingEvidence = (filteredMissing.length > 0 ? filteredMissing : missingEvidence).slice(0, 4)
  const compactCritical = missingEvidence.slice(0, 3)

  return {
    compactCritical,
    visibleJobRequirements,
    visiblePreferredRequirements,
    visibleMissingEvidence,
  }
}

function RequirementList({
  items,
  idPrefix,
}: {
  items: string[]
  idPrefix: string
}) {
  if (items.length === 0) return null

  return (
    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
      {items.map((item) => (
        <li key={`${idPrefix}-${normalizeForComparison(item)}`}>{item}</li>
      ))}
    </ul>
  )
}

export function ReviewDiagnosticCard({ item }: { item: ReviewItem }) {
  const [expanded, setExpanded] = useState(false)
  const lists = useMemo(() => resolveLists(item), [item])
  const title = repairMojibakeForDisplay(item.title)
  const summary = repairMojibakeForDisplay(item.summary || item.explanation || item.message)
  const targetRole = repairMojibakeForDisplay(item.targetRole || "")
  const provenProfile = resolveProvenProfile(item)
  const whyItMatters = repairMojibakeForDisplay(item.whyItMatters || "")
  const suggestedAction = repairMojibakeForDisplay(item.suggestedAction || "")

  return (
    <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left dark:border-zinc-800 dark:bg-zinc-900/70">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900">
          <AlertTriangle className="h-3 w-3" />
          Revisar
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Diagnóstico da vaga
        </span>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-snug text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-1 line-clamp-2 max-w-prose text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
        {summary}
      </p>

      {targetRole ? (
        <div className="mt-3 text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
          <p className="font-semibold text-zinc-800 dark:text-zinc-100">Vaga alvo</p>
          <p>{targetRole}</p>
        </div>
      ) : null}

      {!expanded && lists.compactCritical.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            Principais pontos sem evidência
          </p>
          <RequirementList items={lists.compactCritical} idPrefix={`${item.id}-compact`} />
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {lists.visibleJobRequirements.length > 0 ? (
            <section>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Requisitos principais</p>
              <RequirementList items={lists.visibleJobRequirements} idPrefix={`${item.id}-job`} />
            </section>
          ) : null}

          {lists.visiblePreferredRequirements.length > 0 ? (
            <section>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Diferenciais da vaga</p>
              <RequirementList items={lists.visiblePreferredRequirements} idPrefix={`${item.id}-preferred`} />
            </section>
          ) : null}

          <section>
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Seu perfil comprovado</p>
            <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
              {provenProfile}
            </p>
          </section>

          {lists.visibleMissingEvidence.length > 0 ? (
            <section>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                Pontos sem evidência suficiente
              </p>
              <RequirementList items={lists.visibleMissingEvidence} idPrefix={`${item.id}-missing`} />
            </section>
          ) : null}

          {whyItMatters ? (
            <section>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Por que revisar</p>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
                {whyItMatters}
              </p>
            </section>
          ) : null}

          {suggestedAction ? (
            <section>
              <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">Ação sugerida</p>
              <p className="mt-1 max-w-prose text-xs leading-relaxed text-zinc-700 dark:text-zinc-200">
                {suggestedAction}
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "mt-3 inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-900",
          "dark:text-amber-200 dark:hover:text-amber-100",
        )}
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
    </section>
  )
}
