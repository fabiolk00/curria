"use client"

import { AlertCircle, AlertTriangle, Briefcase, CheckCircle2, Info } from "lucide-react"

import type { CvHighlightState } from "@/lib/resume/cv-highlight-artifact"
import { cn } from "@/lib/utils"

type ReviewItem = NonNullable<CvHighlightState["reviewItems"]>[number]

type ReviewWarningPanelProps = {
  items: ReviewItem[]
  hasInlineHighlights: boolean
  reviewCardCount?: number
  highlightRangeCount?: number
  compatibilityStatus?: CvHighlightState["compatibilityStatus"]
  className?: string
  scrollClassName?: string
}

type ReviewPanelContent = {
  relevantExperience: string[]
  provenProfile: string
  missingEvidence: string[]
  whyReview: string
}

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

function repairMojibakeForDisplay(text: string): string {
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

function dedupe(values: Array<string | undefined>): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  values.forEach((value) => {
    const repaired = repairMojibakeForDisplay(value ?? "").trim()
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

function firstUsefulProvenProfile(items: ReviewItem[]): string {
  const supportedEvidence = dedupe(items.flatMap((item) => item.supportedEvidence ?? []))
  const candidates = dedupe([
    ...items.flatMap((item) => [item.provenProfile, item.originalProfileLabel]),
    supportedEvidence.length > 0 ? supportedEvidence.join(", ") : undefined,
  ])

  return candidates.find((candidate) => !isGenericProvenProfile(candidate)) ?? FALLBACK_PROFILE
}

function firstUsefulParagraph(items: ReviewItem[], field: "whyItMatters" | "summary" | "explanation" | "message"): string {
  return dedupe(items.map((item) => item[field]))[0] ?? ""
}

function resolvePanelContent(items: ReviewItem[]): ReviewPanelContent {
  const jobRequirements = dedupe(items.flatMap((item) => item.jobRequirements ?? []))
  const itemTitles = dedupe(items.map((item) => item.title))
  const missingEvidence = dedupe(items.flatMap((item) => [
    ...(item.missingEvidence ?? []),
    ...(item.unsupportedRequirements ?? []),
  ]))

  const relevantExperience = (jobRequirements.length > 0 ? jobRequirements : itemTitles).slice(0, 6)
  const visibleMissingEvidence = (missingEvidence.length > 0 ? missingEvidence : itemTitles).slice(0, 4)
  const whyReview = firstUsefulParagraph(items, "whyItMatters")
    || firstUsefulParagraph(items, "summary")
    || firstUsefulParagraph(items, "explanation")
    || firstUsefulParagraph(items, "message")
    || "Revise os pontos antes de enviar para evitar uma versão que pareça artificial ou sem sustentação no currículo original."

  return {
    relevantExperience,
    provenProfile: firstUsefulProvenProfile(items),
    missingEvidence: visibleMissingEvidence,
    whyReview,
  }
}

function formatBulletText(value: string): string {
  const text = repairMojibakeForDisplay(value)
    .trim()
    .replace(/[.;:,]+$/u, "")

  return text ? `${text};` : text
}

function AmberBulletList({
  items,
  tone = "default",
}: {
  items: string[]
  tone?: "default" | "warning"
}) {
  if (items.length === 0) return null

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={normalizeForComparison(item)} className="flex items-start gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
          <span className={tone === "warning" ? "text-amber-950/80" : "text-gray-700"}>
            {formatBulletText(item)}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ReviewWarningPanel(props: ReviewWarningPanelProps) {
  const { items, className, scrollClassName, reviewCardCount, highlightRangeCount, compatibilityStatus } = props
  const displayItems = items.filter((item) => item.severity === "risk" || item.severity === "caution" || item.severity === "review")

  if (displayItems.length === 0 && (reviewCardCount ?? 0) === 0) {
    return null
  }

  const content = displayItems.length > 0 ? resolvePanelContent(displayItems) : {
    relevantExperience: ["Evidência inferida"],
    provenProfile: "Evidência não encontrada no texto",
    missingEvidence: ["Como melhorar score ATS"],
    whyReview: "A análise sugere lacunas prováveis. Revise o texto para manter aderência real ao seu histórico.",
  }

  return (
    <section
      data-testid="override-review-panel"
      className={cn(
        "bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden",
        className,
      )}
    >
      <div className="bg-amber-50 border-b border-amber-100 px-6 py-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          {compatibilityStatus === "likely_with_gaps"
            ? "Compatibilidade provável com lacunas: revise os pontos abaixo antes de enviar."
            : "Esta versão foi gerada mesmo com avisos de aderência à vaga. Recomendamos revisar os pontos abaixo antes de enviar."}
        </p>
      </div>
      <div className="px-6 py-2 text-xs text-amber-900 bg-amber-100/60 border-b border-amber-100">
        Cards: {reviewCardCount ?? displayItems.length} · Destaques: {highlightRangeCount ?? 0}
      </div>

      <div className="px-6 pt-8 pb-2 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap shrink-0">Pontos para revisar</h1>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <div
        data-testid="override-review-panel-scroll"
        className={cn(
          "px-6 pb-8 space-y-8",
          scrollClassName,
        )}
      >
        <section className="pt-2">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Experiência relevante</h2>
          </div>
          <AmberBulletList items={content.relevantExperience} />
        </section>

        <section className="border-t border-gray-100 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Seu perfil comprovado</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {content.provenProfile}
          </p>
        </section>

        <section className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-5 mt-2">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-amber-900">Pontos sem evidência suficiente</h2>
          </div>
          <AmberBulletList items={content.missingEvidence} tone="warning" />
        </section>

        <section className="border-t border-gray-100 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Por que revisar</h2>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {content.whyReview}
          </p>
        </section>
      </div>
    </section>
  )
}
