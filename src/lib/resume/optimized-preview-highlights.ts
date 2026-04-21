import type { CVState, ExperienceEntry } from "@/types/cv"

export type HighlightSegment = {
  text: string
  highlighted: boolean
  evidenceTier?: "strong" | "secondary"
  evidenceCategory?: ExperienceHighlightCategory
}

export type HighlightedLine = {
  segments: HighlightSegment[]
  highlightWholeLine: boolean
  highlightTier?: "strong" | "secondary"
  highlightCategory?: ExperienceHighlightCategory
}

export type HighlightedExperienceEntry = {
  title: HighlightedLine
  bullets: HighlightedLine[]
}

export type OptimizedPreviewHighlights = {
  summary: HighlightedLine
  experience: HighlightedExperienceEntry[]
}

export const SUMMARY_SEMANTIC_HIGHLIGHT_ENABLED = false
export const MAX_HIGHLIGHTED_SPANS_PER_EXPERIENCE_BULLET = 1
export const MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY = 2
const EXPERIENCE_HIGHLIGHT_SURFACING_DEBUG_FLAG = "__CURRIA_DEBUG_EXPERIENCE_HIGHLIGHT_SURFACING__"

type HighlightDensityMode = "summary" | "experience" | "inline"

type PhraseUnit = {
  content: string
  trailing: string
}

type HighlightPolicy = {
  maxHighlights: number
  minScore: number
  maxWordsPerSegment: number
  maxCharactersPerSegment: number
  maxCoverageRatio: number
}

type HighlightMatch = {
  text: string
  start: number
  end: number
}

export type ExperienceHighlightCategory =
  | "metric"
  | "scope_scale"
  | "contextual_stack"
  | "anchored_leadership"
  | "anchored_outcome"

type ExperienceHighlightCandidate = HighlightMatch & {
  category: ExperienceHighlightCategory
  score: number
}

type ExperienceBulletImprovement = {
  eligible: boolean
  score: number
}

export type ExperienceBulletHighlightResult = {
  bullet: string
  bulletIndex: number
  line: HighlightedLine
  eligible: boolean
  hasVisibleHighlightCandidate: boolean
  renderable: boolean
  improvementScore: number
  winnerScore: number
  highlightTier?: "strong" | "secondary"
  highlightCategory?: ExperienceHighlightCategory
}

const STRONG_VERB_PREFIXES = [
  "lider",
  "otimiz",
  "estrutur",
  "aceler",
  "reduz",
  "aument",
  "melhor",
  "escal",
  "automat",
  "desenvolv",
  "implement",
  "arquitet",
  "consol",
  "transform",
]

const SENIORITY_TERMS = [
  "senior",
  "lead",
  "principal",
  "especialista",
  "consultor",
  "staff",
]

const TARGET_KEYWORD_TERMS = [
  "business",
  "intelligence",
  "analytics",
  "engenheiro",
  "engineer",
  "consultor",
  "etl",
  "elt",
  "sql",
  "python",
  "power",
  "bi",
  "bigquery",
  "dbt",
  "databricks",
  "aws",
  "azure",
  "gcp",
  "latam",
  "global",
  "regional",
  "qualidade",
  "producao",
  "throughput",
  "sla",
]

const TECHNOLOGY_TERMS = [
  "microsoft",
  "qlikview",
  "qlik",
  "bigquery",
  "databricks",
  "dbt",
  "sql",
  "python",
  "power",
  "bi",
  "aws",
  "azure",
  "gcp",
]

const STOPWORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "um",
  "uma",
  "the",
  "and",
  "of",
  "to",
  "in",
])

const WORD_PATTERN = /[\p{L}\p{N}%./+-]+/u
const SUMMARY_JSON_FIELD_PATTERN = /"(profile|content|text|rewritten_content)"\s*:\s*"((?:\\.|[^"\\])*)"/i
const ATS_TECH_TERMS = [
  "sql",
  "bi",
  "dbt",
  "etl",
  "python",
  "pyspark",
  "power bi",
  "qlik",
  "qlik sense",
  "qlik cloud",
  "databricks",
  "azure databricks",
  "gcp",
  "bigquery",
  "apis",
  "api",
  "sharepoint",
  "dynamics crm",
]
const EXPERIENCE_CONTEXTUAL_PATTERNS = [
  /(?:até|mais de|cerca de|aproximadamente|quase)\s+\d+(?:[.,]\d+)?%?(?:\s+[^\s,.;:]+){0,3}/giu,
  /\d+(?:[.,]\d+)?%(?:\s+[^\s,.;:]+){0,3}/giu,
  /\b(?:latam|global|regional)\b/giu,
  /\bgrandes volumes de dados\b/giu,
  /\b(?:mais de|m[uú]ltiplas?)\s+(?:fontes|bases|dashboards|pipelines|aplica(?:coes|ções)|clientes|times|processos|fontes de dados)\b/giu,
  /\b(?:azure databricks(?:\s+com\s+pyspark)?|pyspark|power bi\s+para\s+[\p{L}\s]{2,24}|bi\s+em\s+gcp,\s*bigquery|etl,\s*sql\s+e\s+power bi|sql,\s*python\s+e\s+power bi|qlik(?:\s+sense|\s+cloud)?|sharepoint|dynamics crm)\b/giu,
  /\b(?:reduz\w*|aument\w*|elev\w*|melhor\w*|otimiz\w*|aceler\w*|contribu\w*)(?:\s+[^\s,.;:]+){0,4}/giu,
]

const STRUCTURAL_LABEL_PATTERNS = [
  /^resumo profissional[:\-\s]*$/i,
  /^professional summary[:\-\s]*$/i,
  /^summary[:\-\s]*$/i,
]

const HIGHLIGHT_POLICIES: Record<HighlightDensityMode, HighlightPolicy> = {
  summary: {
    maxHighlights: 2,
    minScore: 3,
    maxWordsPerSegment: 8,
    maxCharactersPerSegment: 72,
    maxCoverageRatio: 0.56,
  },
  experience: {
    maxHighlights: 2,
    minScore: 2,
    maxWordsPerSegment: 8,
    maxCharactersPerSegment: 88,
    maxCoverageRatio: 0.4,
  },
  inline: {
    maxHighlights: 1,
    minScore: 4,
    maxWordsPerSegment: 4,
    maxCharactersPerSegment: 34,
    maxCoverageRatio: 0.4,
  },
}

const SUMMARY_FALLBACK_PATTERNS = [
  /\b(?:senior|lead|principal|especialista|consultor|staff)(?:\s+[\p{L}\p{N}]+){0,3}/giu,
  /\b(?:[\p{L}\p{N}]+\s+){0,2}business intelligence\b/giu,
  /\b(?:[\p{L}\p{N}]+\s+){0,2}(?:analytics|sql|power bi|python|dbt|databricks)\b/giu,
  /\b(?:[\p{L}\p{N}]+\s+){0,2}(?:operacional|estrategicas?|executivas?)\b/giu,
]

const EXPERIENCE_FALLBACK_PATTERNS = [
  /\b(?:lider\w*|otimiz\w*|reduz\w*|aument\w*|melhor\w*|implement\w*|estrutur\w*)(?:\s+[\p{L}\p{N}%]+){0,6}/giu,
  /\b(?:escopo\s+)?(?:latam|global|regional)\b/giu,
  /\b\d+(?:[.,]\d+)?%?(?:\s+[\p{L}\p{N}]+){0,4}/giu,
]

const WEAK_TRAILING_CONNECTORS = new Set([
  "com",
  "para",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "ao",
  "a",
  "o",
  "e",
])

function normalizeText(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeHumanReadableText(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

function parseStructuredSummaryRecord(record: Record<string, unknown>): string | null {
  if (Array.isArray(record.items)) {
    const lines = record.items
      .flatMap((item) => {
        if (typeof item === "string") {
          return item
        }

        if (!item || typeof item !== "object") {
          return []
        }

        const itemRecord = item as Record<string, unknown>
        const content = [itemRecord.content, itemRecord.text, itemRecord.profile]
          .find((candidate) => typeof candidate === "string")

        return typeof content === "string" ? content : []
      })
      .map((item) => normalizeHumanReadableText(item))
      .filter(Boolean)

    if (lines.length > 0) {
      return lines.join(" ")
    }
  }

  const directField = [record.profile, record.content, record.text, record.rewritten_content]
    .find((candidate) => typeof candidate === "string" && candidate.trim())

  return typeof directField === "string"
    ? normalizeHumanReadableText(directField)
    : null
}

export function normalizePreviewSummaryText(summary: unknown): string {
  if (typeof summary === "string") {
    const trimmed = summary.trim()
    if (!trimmed) {
      return ""
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parseStructuredSummaryRecord(parsed as Record<string, unknown>) ?? trimmed
        }
      } catch {
        const match = trimmed.match(SUMMARY_JSON_FIELD_PATTERN)
        if (match?.[2]) {
          try {
            return normalizeHumanReadableText(JSON.parse(`"${match[2]}"`))
          } catch {
            return normalizeHumanReadableText(match[2].replace(/\\"/g, '"'))
          }
        }
      }
    }

    return normalizeHumanReadableText(trimmed)
  }

  if (summary && typeof summary === "object" && !Array.isArray(summary)) {
    return parseStructuredSummaryRecord(summary as Record<string, unknown>) ?? ""
  }

  return ""
}

function tokenizePreservingWhitespace(text: string): string[] {
  return text.match(/(\s+|[^\s]+)/g) ?? []
}

function isWordToken(token: string): boolean {
  return WORD_PATTERN.test(token)
}

function normalizeToken(token: string): string {
  return normalizeText(token).replace(/^[^\p{L}\p{N}%]+|[^\p{L}\p{N}%]+$/gu, "")
}

function buildTokenCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>()

  tokenizePreservingWhitespace(text).forEach((token) => {
    if (!isWordToken(token)) {
      return
    }

    const normalized = normalizeToken(token)
    if (!normalized) {
      return
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
  })

  return counts
}

function isMinorFormattingOnlyChange(original: string, optimized: string): boolean {
  return normalizeText(original).replace(/[^\p{L}\p{N}%]/gu, "") === normalizeText(optimized).replace(/[^\p{L}\p{N}%]/gu, "")
}

function isRelevantAddedToken(token: string): boolean {
  const normalized = normalizeToken(token)

  if (!normalized || STOPWORDS.has(normalized)) {
    return false
  }

  if (/\d/.test(normalized)) {
    return true
  }

  if (TARGET_KEYWORD_TERMS.includes(normalized)) {
    return true
  }

  if (SENIORITY_TERMS.includes(normalized)) {
    return true
  }

  if (STRONG_VERB_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true
  }

  return normalized.length >= 6
}

function collapseSegments(segments: HighlightSegment[]): HighlightSegment[] {
  if (segments.length === 0) {
    return segments
  }

  const collapsed: HighlightSegment[] = []

  for (const segment of segments) {
    const previous = collapsed[collapsed.length - 1]
    if (
      previous
      && previous.highlighted === segment.highlighted
      && previous.evidenceTier === segment.evidenceTier
      && previous.evidenceCategory === segment.evidenceCategory
    ) {
      previous.text += segment.text
      continue
    }

    collapsed.push({ ...segment })
  }

  return collapsed
}

function splitIntoPhraseUnits(text: string): PhraseUnit[] {
  const matches = text.matchAll(/([^,;:.!?]+)([,:;.!?]*\s*)/g)
  const units = Array.from(matches, (match) => ({
    content: match[1] ?? "",
    trailing: match[2] ?? "",
  })).filter((unit) => unit.content.length > 0 || unit.trailing.length > 0)

  return units.length > 0 ? units : [{ content: text, trailing: "" }]
}

function getWordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function isStructuralPhraseUnit(content: string): boolean {
  const normalized = normalizeText(content).replace(/\s+/g, " ").trim()
  return STRUCTURAL_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))
}

function createNonHighlightedLine(text: string): HighlightedLine {
  return { segments: [{ text, highlighted: false }], highlightWholeLine: false }
}

function tierForExperienceCategory(category: ExperienceHighlightCategory): "strong" | "secondary" {
  return category === "metric" || category === "scope_scale"
    ? "strong"
    : "secondary"
}

/**
 * Editorial same-entry category order for visible experience highlights.
 * This directly controls which bullets win the limited visible slots under cap pressure,
 * so changes here require explicit editorial review rather than casual sorting tweaks.
 */
export const EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY: Record<ExperienceHighlightCategory, number> = {
  metric: 0,
  scope_scale: 1,
  contextual_stack: 2,
  anchored_leadership: 3,
  anchored_outcome: 4,
}

function countTechTerms(text: string): number {
  const normalized = normalizeText(text)
  return ATS_TECH_TERMS.filter((term) => normalized.includes(term)).length
}

function isMeaningfulExperienceContext(text: string): boolean {
  const normalized = normalizeText(text)
  return /\d/.test(normalized)
    || /\b(latam|global|regional|volume|volumes|fontes|bases|supply chain|crm|sharepoint|apis?|bigquery|databricks|pyspark|governanca|analitica|dados)\b/i.test(normalized)
}

function isLowValueGenericSpan(text: string): boolean {
  const normalized = normalizeText(text)
  return /^(profissional|consultor|analista|business intelligence|apoiei|atuei|iniciei)(?:\s+[\p{L}\p{N}]+){0,3}$/iu.test(normalized)
}

function hasCandidateOverlap(left: HighlightMatch, right: HighlightMatch): boolean {
  return !(left.end <= right.start || left.start >= right.end)
}

function trimWeakTrailingConnectors(text: string): string {
  let next = text.trim()

  while (next) {
    const words = next.split(/\s+/)
    const lastWord = normalizeText(words[words.length - 1] ?? "")
    if (!WEAK_TRAILING_CONNECTORS.has(lastWord)) {
      break
    }

    words.pop()
    next = words.join(" ").trim().replace(/[,:;]+$/g, "").trim()
  }

  return next
}

function extractContextualStackCore(text: string): string {
  const cleaned = text.trim().replace(/^[,:;]+|[,:;]+$/g, "").trim()
  const withoutLead = cleaned.replace(/^(?:com|utilizando|usando|em)\s+/i, "")
  const match = withoutLead.match(
    /\b(?:[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\s*(?:,|\/|e)\s*){1,4}[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\b/i,
  )

  return trimWeakTrailingConnectors(match?.[0] ?? withoutLead)
}

function appendFollowingWords(
  optimized: string,
  start: number,
  end: number,
  maxWords: number,
): HighlightMatch {
  const tail = optimized.slice(end)
  const tailMatch = tail.match(new RegExp(`^\\s+([^\\s,.;:]+(?:\\s+[^\\s,.;:]+){0,${Math.max(0, maxWords - 1)}})`))
  if (!tailMatch?.[1]) {
    return {
      text: optimized.slice(start, end).trim(),
      start,
      end,
    }
  }

  const expanded = `${optimized.slice(start, end).trim()} ${tailMatch[1]}`.trim()
  return {
    text: expanded,
    start,
    end: start + expanded.length,
  }
}

function prependImmediateWord(
  optimized: string,
  start: number,
  end: number,
  allowedWordPattern: RegExp,
): HighlightMatch {
  const prefix = optimized.slice(0, start)
  const prefixMatch = prefix.match(/([^\s,.;:]+)\s+$/)
  if (!prefixMatch?.[1] || !allowedWordPattern.test(normalizeText(prefixMatch[1]))) {
    return {
      text: optimized.slice(start, end).trim(),
      start,
      end,
    }
  }

  const expandedStart = start - prefixMatch[0].length
  return {
    text: optimized.slice(expandedStart, end).trim(),
    start: expandedStart,
    end,
  }
}

function buildWindowedMatch(
  optimized: string,
  windowStart: number,
  match: RegExpMatchArray,
): HighlightMatch {
  const text = match[0]?.trim() ?? ""
  const relativeStart = match.index ?? -1
  const start = relativeStart >= 0 ? windowStart + relativeStart : -1

  return {
    text,
    start,
    end: start >= 0 ? start + text.length : -1,
  }
}

function collectWindowPatternMatches(
  optimized: string,
  start: number,
  end: number,
  patterns: RegExp[],
  windowPadding = 72,
): HighlightMatch[] {
  const windowStart = Math.max(0, start - windowPadding)
  const windowEnd = Math.min(optimized.length, end + windowPadding)
  const windowText = optimized.slice(windowStart, windowEnd)
  const matches: HighlightMatch[] = []

  for (const pattern of patterns) {
    const activePattern = new RegExp(pattern.source, pattern.flags)
    for (const match of windowText.matchAll(activePattern)) {
      const candidate = buildWindowedMatch(optimized, windowStart, match)
      if (candidate.text.length > 0) {
        matches.push(candidate)
      }
    }
  }

  return matches
}

function pickBestCompletedSpan(
  optimized: string,
  start: number,
  end: number,
  patterns: RegExp[],
  anchorStart = start,
  anchorEnd = end,
): HighlightMatch | null {
  const candidates = collectWindowPatternMatches(optimized, start, end, patterns)
    .map((candidate) => ({
      ...candidate,
      wordCount: getWordCount(candidate.text),
    }))
    .filter((candidate) =>
      candidate.start <= anchorStart
      && candidate.end >= anchorEnd
      && candidate.wordCount > 0
      && candidate.wordCount <= 7
      && candidate.text.length <= 52,
    )
    .sort((left, right) =>
      left.wordCount - right.wordCount
      || left.text.length - right.text.length
      || left.start - right.start,
    )

  if (candidates.length === 0) {
    return null
  }

  const { wordCount: _wordCount, ...best } = candidates[0]
  return best
}

function findMetricAnchorBounds(
  optimized: string,
  start: number,
  end: number,
): { start: number; end: number } {
  const current = optimized.slice(start, end)
  const anchorMatch = current.match(/(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?%?/i)

  if (!anchorMatch || anchorMatch.index === undefined) {
    return { start, end }
  }

  const anchorStart = start + anchorMatch.index
  return {
    start: anchorStart,
    end: anchorStart + anchorMatch[0].length,
  }
}

function getImmediatePrefixToken(
  optimized: string,
  start: number,
): string | null {
  const prefix = optimized.slice(0, start)
  const match = prefix.match(/([^\s,.;:]+)\s+$/)
  return match?.[1] ?? null
}

function pickBestMetricCompletedSpan(
  optimized: string,
  start: number,
  end: number,
  patterns: RegExp[],
): HighlightMatch | null {
  const anchor = findMetricAnchorBounds(optimized, start, end)
  const candidates = collectWindowPatternMatches(optimized, start, end, patterns)
    .map((candidate) => ({
      ...candidate,
      wordCount: getWordCount(candidate.text),
    }))
    .filter((candidate) =>
      candidate.start <= anchor.start
      && candidate.end >= anchor.end
      && candidate.wordCount > 0
      && candidate.wordCount <= 7
      && candidate.text.length <= 52,
    )
    .sort((left, right) =>
      left.wordCount - right.wordCount
      || left.text.length - right.text.length
      || left.start - right.start,
    )

  if (candidates.length === 0) {
    return null
  }

  const { wordCount: _wordCount, ...best } = candidates[0]
  return best
}

function completeMetricSpan(
  optimized: string,
  start: number,
  end: number,
): HighlightMatch {
  const current = optimized.slice(start, end).trim()
  const anchor = findMetricAnchorBounds(optimized, start, end)
  const anchorText = optimized.slice(anchor.start, anchor.end)
  const beforeAnchor = optimized.slice(Math.max(0, anchor.start - 72), anchor.start)
  const leftNounPhraseMatch = beforeAnchor.match(/([\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2})\s+em\s*$/iu)

  if (leftNounPhraseMatch) {
    const phrase = leftNounPhraseMatch[1]
    if (getWordCount(phrase) >= 2 && getWordCount(phrase) <= 4) {
      const expanded = `${phrase} em ${anchorText}`.trim()
      if (getWordCount(expanded) <= 6 && expanded.length <= 44) {
        return {
          text: expanded,
          start: anchor.start - (`${phrase} em `.length),
          end: anchor.start - (`${phrase} em `.length) + expanded.length,
        }
      }
    }
  }

  const immediatePrefix = getImmediatePrefixToken(optimized, anchor.start)
  const rightWindow = optimized.slice(anchor.start, Math.min(optimized.length, anchor.end + 72))
  const rightMetricObjectMatch = rightWindow.match(
    /^(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?%?(?:\s+(?:o|a|os|as))?\s+[\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,1}\b/iu,
  )

  if (rightMetricObjectMatch) {
    const normalizedImmediatePrefix = immediatePrefix ? normalizeText(immediatePrefix) : ""
    const prefix = normalizedImmediatePrefix && /^(?:em|r\$|usd|eur)$/i.test(normalizedImmediatePrefix) ? `${immediatePrefix} ` : ""
    const expanded = `${prefix}${rightMetricObjectMatch[0].trim()}`.trim()
    const expandedStart = prefix ? anchor.start - prefix.length : anchor.start
    const maxWords = /r\$/i.test(expanded) ? 8 : 7

    if (getWordCount(expanded) <= maxWords && expanded.length <= 44) {
      return {
        text: expanded,
        start: expandedStart,
        end: expandedStart + expanded.length,
      }
    }
  }

  const metricShapeMatch = pickBestMetricCompletedSpan(optimized, start, end, [
    /\b[\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2}\s+em\s+(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?%?\b/giu,
    /\bem\s+(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?%?\s+(?:o|a|os|as)\s+[\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2}\b/giu,
    /\b(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?%?\s+(?:o|a|os|as)\s+[\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2}\b/giu,
    /\b(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?\s+horas?\s+por\s+(?:semana|mes|m[eê]s)\b/giu,
    /\b(?:r\$\s*)?\d+(?:[.,]\d+)?(?:\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es))?\s+[\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2}\b/giu,
  ])

  if (metricShapeMatch) {
    return metricShapeMatch
  }

  const before = optimized.slice(Math.max(0, start - 72), start)
  const nounPhraseMatch = before.match(/([\p{L}\p{N}]+(?:\s+de\s+[\p{L}\p{N}]+){0,2})\s+em\s*$/iu)

  if (nounPhraseMatch) {
    const phrase = nounPhraseMatch[1]
    if (getWordCount(phrase) >= 2) {
      const expandedStart = start - (`${phrase} em `.length)
      const expanded = optimized.slice(expandedStart, end).trim()
      if (getWordCount(expanded) <= 7 && expanded.length <= 52) {
        return {
          text: expanded,
          start: expandedStart,
          end: expandedStart + expanded.length,
        }
      }
    }
  }

  if (/^\d+(?:[.,]\d+)?%?(?:\s|$)/.test(current)) {
    let next = prependImmediateWord(optimized, start, end, /^(?:em|de)$/i)
    if (/^\d+(?:[.,]\d+)?%?(?:\s+(?:o|a|os|as)\b)?/i.test(next.text) && getWordCount(next.text) <= 6) {
      next = appendFollowingWords(optimized, next.start, next.end, 1)
    }

    return next
  }

  return {
    text: current,
    start,
    end,
  }
}

function completeScopeScaleSpan(
  optimized: string,
  start: number,
  end: number,
): HighlightMatch {
  const scopeShapeMatch = pickBestCompletedSpan(optimized, start, end, [
    /\b[\p{L}\p{N}]+\s+(?:regional|nacional|global|internacional|latam)\s+com\s+alto\s+volume(?:\s+de\s+[\p{L}\p{N}]+){0,2}\b/giu,
    /\b(?:escopo\s+)?(?:regional|nacional|global|internacional|latam)\s+para\s+multipl(?:as|os)\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)?\b/giu,
    /\b(?:mais\s+de\s+\d+|dezenas\s+de|centenas\s+de|milhares\s+de)\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,3}\b/giu,
    /\balto\s+volume\s+de\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,2}\b/giu,
    /\b[\p{L}\p{N}]+\s+(?:regional|nacional|global|internacional|latam)\b/giu,
  ])

  if (scopeShapeMatch) {
    return scopeShapeMatch
  }

  let next = prependImmediateWord(optimized, start, end, /^(?:escopo)$/i)

  if (/\b(?:global|regional|nacional|internacional|latam)\s+para\s+multipl(?:as|os)\b/i.test(next.text)) {
    next = appendFollowingWords(optimized, next.start, next.end, 1)
  }

  if (/\b(?:alto volume de|grandes volumes? de|dezenas de|centenas de|milhares de|mais de \d+)\b/i.test(next.text)) {
    next = appendFollowingWords(optimized, next.start, next.end, 3)
  }

  return {
    text: next.text.trim(),
    start: next.start,
    end: next.start + next.text.trim().length,
  }
}

function expandIncompleteEvidenceSpan(
  optimized: string,
  start: number,
  end: number,
  category: ExperienceHighlightCandidate["category"],
): HighlightMatch {
  let nextStart = start
  let nextEnd = end
  let nextText = optimized.slice(nextStart, nextEnd).trim()

  if (category === "contextual_stack") {
    const core = extractContextualStackCore(nextText)
    const offset = nextText.toLowerCase().indexOf(core.toLowerCase())
    if (core && offset >= 0) {
      nextStart += offset
      nextEnd = nextStart + core.length
      nextText = core
    }
  }

  if (category === "metric") {
    const completed = completeMetricSpan(optimized, nextStart, nextEnd)
    nextStart = completed.start
    nextEnd = completed.end
    nextText = completed.text
  }

  if (category === "scope_scale") {
    const completed = completeScopeScaleSpan(optimized, nextStart, nextEnd)
    nextStart = completed.start
    nextEnd = completed.end
    nextText = completed.text
  }

  nextText = trimWeakTrailingConnectors(nextText)
  nextEnd = nextStart + nextText.length

  if (
    (category === "metric" || category === "scope_scale")
    && /\b(?:mais de \d+|alto volume de|dezenas de|centenas de|milhares de)\b/i.test(nextText)
  ) {
    const tail = optimized.slice(nextEnd)
    const tailMatch = tail.match(/^\s+([^\s,.;:]+(?:\s+[^\s,.;:]+){0,2})/)
    if (tailMatch?.[1]) {
      const expanded = `${nextText} ${tailMatch[1]}`.trim()
      if (getWordCount(expanded) <= 6 && expanded.length <= 52) {
        nextText = expanded
        nextEnd = nextStart + expanded.length
      }
    }
  }

  return {
    text: nextText,
    start: nextStart,
    end: nextEnd,
  }
}

function buildExperienceCandidate(
  optimized: string,
  match: HighlightMatch,
  category: ExperienceHighlightCandidate["category"],
): ExperienceHighlightCandidate | null {
  const refinedMatch = expandIncompleteEvidenceSpan(optimized, match.start, match.end, category)
  const text = normalizeHumanReadableText(refinedMatch.text)
  const normalized = normalizeText(text)
  const wordCount = getWordCount(text)
  const techTermCount = countTechTerms(text)
  const hasMetric = /\d/.test(normalized)
  const hasScope = /\b(latam|global|regional|nacional|internacional|multi(?:pais|country))\b/.test(normalized)
  const hasScale = /\b(grandes volumes?|alto volume|mais de|multipl(?:as|os)|dezenas|centenas|milhares)\b/.test(normalized)
  const hasLeadership = /\b(lider\w*|coordenei|gerenciei|supervisionei|owner|responsavel)\b/.test(normalized)
  const hasOutcome = /\b(reduz|aument|elev|melhor|otimiz|aceler|ampli|expand|contribu)\w*/.test(normalized)
  const hasMethodology = /\b(scrum|agile|kanban|lean|itil|okrs?|iso|six sigma|framework|metodologia|certifica\w*)\b/.test(normalized)
  const meaningfulContext = isMeaningfulExperienceContext(text) || isMeaningfulExperienceContext(optimized)

  if (!text || match.start < 0 || match.end <= match.start) {
    return null
  }

  if (!normalized || isLowValueGenericSpan(text) || wordCount > 7 || text.length > 52) {
    return null
  }

  if (category === "contextual_stack" && (techTermCount < 2 || (!meaningfulContext && !hasMethodology))) {
    return null
  }

  if (category === "anchored_leadership" && (!hasLeadership || (!hasMetric && !hasScope && !hasScale && techTermCount < 1))) {
    return null
  }

  if (category === "anchored_outcome" && (!hasOutcome || (!hasMetric && !hasScope && !hasScale))) {
    return null
  }

  let score = 0
  switch (category) {
    case "metric":
      score += 100
      break
    case "scope_scale":
      score += 80
      break
    case "contextual_stack":
      score += 60
      break
    case "anchored_leadership":
      score += 40
      break
    case "anchored_outcome":
      score += 20
      break
  }

  if (hasMetric) score += 12
  if (hasScope) score += 8
  if (hasScale) score += 7
  if (techTermCount >= 2) score += 6
  if (hasMethodology) score += 4
  if (meaningfulContext) score += 3
  if (wordCount <= 4) score += 2
  if (match.start < 10 && category !== "metric" && category !== "scope_scale") score -= 3

  return {
    ...refinedMatch,
    text,
    category,
    score,
  }
}

function collectPatternMatches(
  optimized: string,
  pattern: RegExp,
  category: ExperienceHighlightCandidate["category"],
): ExperienceHighlightCandidate[] {
  const activePattern = new RegExp(pattern.source, pattern.flags)

  return Array.from(optimized.matchAll(activePattern), (rawMatch) => {
    const text = normalizeHumanReadableText(rawMatch[0] ?? "")
    const start = rawMatch.index ?? -1
    return buildExperienceCandidate(
      optimized,
      { text, start, end: start >= 0 ? start + (rawMatch[0]?.length ?? 0) : -1 },
      category,
    )
  }).filter((candidate): candidate is ExperienceHighlightCandidate => candidate !== null)
}

function collectRankedExperienceHighlightCandidates(optimized: string): ExperienceHighlightCandidate[] {
  const metricPatterns = [
    /\b\d+(?:[.,]\d+)?%(?:\s+[^\s,.;:]+){0,4}/giu,
    /\b(?:r\$\s*|usd\s*|eur\s*)\d+(?:[.,]\d+)?(?:\s+[^\s,.;:]+){0,3}/giu,
    /\b\d+(?:[.,]\d+)?\s*(?:mil|k|mi|mm|milhoes|milh[oõ]es)(?:\s+[^\s,.;:]+){0,3}/giu,
  ]
  const scopeScalePatterns = [
    /\b(?:latam|global|regional|nacional|internacional)\b(?:\s+[^\s,.;:]+){0,2}/giu,
    /\b(?:mais de|multipl(?:as|os)|grandes volumes?|alto volume|dezenas|centenas|milhares)\s+(?:[^\s,.;:]+){1,4}/giu,
  ]
  const contextualStackPatterns = [
    /\b(?:[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\s*(?:,|\/|e)\s*){1,4}[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\b/giu,
    /\b(?:com|utilizando|usando|em)\s+(?:[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\s*(?:,|\/|e)\s*){1,4}[a-z0-9.+#-]+(?:\s+[a-z0-9.+#-]+)?\b/giu,
  ]
  const leadershipPatterns = [
    /\b(?:lider\w*|coordenei|gerenciei|supervisionei|owner|responsavel(?:\s+por)?)\b(?:\s+[^\s,.;:]+){1,5}/giu,
  ]
  const outcomePatterns = [
    /\b(?:reduz\w*|aument\w*|elev\w*|melhor\w*|otimiz\w*|aceler\w*|ampli\w*|expand\w*|contribu\w*)(?:\s+[^\s,.;:]+){1,5}/giu,
  ]

  const rawCandidates = [
    ...metricPatterns.flatMap((pattern) => collectPatternMatches(optimized, pattern, "metric")),
    ...scopeScalePatterns.flatMap((pattern) => collectPatternMatches(optimized, pattern, "scope_scale")),
    ...contextualStackPatterns.flatMap((pattern) => collectPatternMatches(optimized, pattern, "contextual_stack")),
    ...leadershipPatterns.flatMap((pattern) => collectPatternMatches(optimized, pattern, "anchored_leadership")),
    ...outcomePatterns.flatMap((pattern) => collectPatternMatches(optimized, pattern, "anchored_outcome")),
  ]

  const deduped: ExperienceHighlightCandidate[] = []

  for (const candidate of rawCandidates.sort((left, right) => right.score - left.score || left.start - right.start)) {
    if (
      deduped.some((existing) =>
        normalizeText(existing.text) === normalizeText(candidate.text)
        || hasCandidateOverlap(existing, candidate),
      )
    ) {
      continue
    }

    deduped.push(candidate)
  }

  return deduped
}

function collectExperienceHighlightCandidates(original: string, optimized: string): ExperienceHighlightCandidate[] {
  const originalNormalized = normalizeText(original)

  return EXPERIENCE_CONTEXTUAL_PATTERNS
    .flatMap((pattern) => {
      const activePattern = new RegExp(pattern.source, pattern.flags)
      return Array.from(optimized.matchAll(activePattern), (match) => {
        const text = normalizeHumanReadableText(match[0] ?? "")
        const start = match.index ?? -1
        const end = start >= 0 ? start + (match[0]?.length ?? 0) : -1
        return { text, start, end }
      })
    })
    .filter((candidate) => {
      if (!candidate.text || candidate.start < 0 || candidate.end <= candidate.start) {
        return false
      }

      const normalizedCandidate = normalizeText(candidate.text)
      return normalizedCandidate.length > 0
        && !originalNormalized.includes(normalizedCandidate)
        && !isLowValueGenericSpan(candidate.text)
        && getWordCount(candidate.text) <= 6
        && candidate.text.length <= 48
    })
    .map((candidate) => {
      const normalized = normalizeText(candidate.text)
      const techTermCount = countTechTerms(candidate.text)
      const hasMetric = /\d/.test(normalized)
      const hasScope = /\b(latam|global|regional)\b/.test(normalized)
      const hasScale = /\b(grandes volumes de dados|mais de|m[uú]ltiplas?)\b/.test(normalized)
      const hasOutcome = /\b(reduz|aument|elev|melhor|otimiz|aceler|contribu)\w*/.test(normalized)
      const meaningfulContext = isMeaningfulExperienceContext(candidate.text) || isMeaningfulExperienceContext(optimized)
      const category: ExperienceHighlightCandidate["category"] = hasMetric
        ? "metric"
        : hasScope || hasScale
        ? "scope_scale"
        : techTermCount >= 2
        ? "contextual_stack"
        : hasOutcome
        ? "anchored_outcome"
        : "anchored_leadership"

      let score = 0
      if (hasMetric) score += 5
      if (hasScope) score += 3
      if (hasScale) score += 2
      if (hasOutcome) score += 2
      if (techTermCount >= 2) score += 3
      if (techTermCount >= 2 && meaningfulContext) score += 2
      if (meaningfulContext) score += 2
      if (techTermCount === 1 && meaningfulContext) score += 2
      if (techTermCount === 1 && !meaningfulContext) score -= 3
      if (candidate.start < 12 && !hasMetric && !hasScope && !(techTermCount >= 2 && meaningfulContext)) score -= 2

      return {
        ...candidate,
        category,
        score,
      }
    })
    .filter((candidate) => candidate.score >= 4)
    .sort((left, right) => right.score - left.score || left.start - right.start)
}

function buildExperienceHighlightLine(text: string, candidate: ExperienceHighlightCandidate | null): HighlightedLine {
  if (!candidate) {
    return createNonHighlightedLine(text)
  }

  const highlightTier = tierForExperienceCategory(candidate.category)
  const segments: HighlightSegment[] = []
  if (candidate.start > 0) {
    segments.push({ text: text.slice(0, candidate.start), highlighted: false })
  }
  segments.push({
    text: text.slice(candidate.start, candidate.end),
    highlighted: true,
    evidenceTier: highlightTier,
    evidenceCategory: candidate.category,
  })
  if (candidate.end < text.length) {
    segments.push({ text: text.slice(candidate.end), highlighted: false })
  }

  return {
    segments: collapseSegments(segments),
    highlightWholeLine: false,
    highlightTier,
    highlightCategory: candidate.category,
  }
}

function evaluateExperienceBulletImprovement(
  original: string,
  optimized: string,
): ExperienceBulletImprovement {
  if (!optimized.trim()) {
    return { eligible: false, score: 0 }
  }

  if (original.trim() && isMinorFormattingOnlyChange(original, optimized)) {
    return { eligible: false, score: 0 }
  }

  const originalSimilarity = original.trim() ? calculateTextSimilarity(original, optimized) : 0
  const diffSignals = scorePhraseUnit(optimized, buildTokenCounts(original))
  const renderCandidate = collectRankedExperienceHighlightCandidates(optimized)[0] ?? null

  let score = diffSignals.score
  if (!original.trim()) score += 2
  if (originalSimilarity < 0.75) score += 2
  else if (originalSimilarity < 0.9) score += 1

  const eligible = renderCandidate !== null
    && (
      score >= 5
      || diffSignals.hasMetric
      || diffSignals.hasScope
    )

  return {
    eligible,
    score: eligible ? score : 0,
  }
}

function collectRegexMatches(
  text: string,
  pattern: RegExp,
  originalNormalized: string,
  policy: HighlightPolicy,
): HighlightMatch[] {
  const matches: HighlightMatch[] = []
  const activePattern = new RegExp(pattern.source, pattern.flags)

  for (const match of text.matchAll(activePattern)) {
    const candidate = match[0]?.trim()
    const start = match.index ?? -1
    if (!candidate || start < 0) {
      continue
    }

    const normalizedCandidate = normalizeText(candidate)
    if (
      !normalizedCandidate
      || originalNormalized.includes(normalizedCandidate)
      || isStructuralPhraseUnit(candidate)
      || getWordCount(candidate) > policy.maxWordsPerSegment
      || candidate.length > policy.maxCharactersPerSegment
    ) {
      continue
    }

    matches.push({
      text: candidate,
      start,
      end: start + match[0].length,
    })
  }

  return matches
}

function buildFallbackHighlightLine(
  original: string,
  optimized: string,
  mode: HighlightDensityMode,
): HighlightedLine | null {
  const policy = HIGHLIGHT_POLICIES[mode]
  const originalNormalized = normalizeText(original)
  const patterns = mode === "experience" ? EXPERIENCE_FALLBACK_PATTERNS : SUMMARY_FALLBACK_PATTERNS
  const candidates = patterns
    .flatMap((pattern) => collectRegexMatches(optimized, pattern, originalNormalized, policy))
    .sort((left, right) => left.start - right.start)

  if (candidates.length === 0) {
    return null
  }

  const chosen: HighlightMatch[] = []
  let coverage = 0

  for (const candidate of candidates) {
    if (chosen.length >= policy.maxHighlights) {
      break
    }

    if (chosen.some((item) => !(candidate.end <= item.start || candidate.start >= item.end))) {
      continue
    }

    const nextCoverage = (coverage + candidate.text.length) / (optimized.trim().length || 1)
    if (nextCoverage > policy.maxCoverageRatio) {
      continue
    }

    chosen.push(candidate)
    coverage += candidate.text.length
  }

  if (chosen.length === 0) {
    return null
  }

  const segments: HighlightSegment[] = []
  let cursor = 0

  for (const match of chosen) {
    if (cursor < match.start) {
      segments.push({ text: optimized.slice(cursor, match.start), highlighted: false })
    }

    segments.push({ text: optimized.slice(match.start, match.end), highlighted: true })
    cursor = match.end
  }

  if (cursor < optimized.length) {
    segments.push({ text: optimized.slice(cursor), highlighted: false })
  }

  return {
    segments: collapseSegments(segments),
    highlightWholeLine: false,
  }
}

function scorePhraseUnit(
  content: string,
  originalCounts: Map<string, number>,
): {
  score: number
  addedRelevantCount: number
  significantWordCount: number
  hasMetric: boolean
  hasScope: boolean
  hasSeniority: boolean
  hasStrongVerb: boolean
  technologyOnly: boolean
} {
  const significantWords = new Set<string>()
  const technologyWords = new Set<string>()
  let addedRelevantCount = 0
  let hasMetric = false
  let hasScope = false
  let hasSeniority = false
  let hasStrongVerb = false

  tokenizePreservingWhitespace(content).forEach((token) => {
    if (!isWordToken(token)) {
      return
    }

    const normalized = normalizeToken(token)
    if (!normalized) {
      return
    }

    const remaining = originalCounts.get(normalized) ?? 0
    if (remaining > 0) {
      originalCounts.set(normalized, remaining - 1)
      return
    }

    if (!isRelevantAddedToken(token)) {
      return
    }

    addedRelevantCount += 1

    if (!STOPWORDS.has(normalized)) {
      significantWords.add(normalized)
    }

    if (/\d/.test(normalized)) {
      hasMetric = true
    }

    if (["latam", "global", "regional"].includes(normalized)) {
      hasScope = true
    }

    if (SENIORITY_TERMS.includes(normalized)) {
      hasSeniority = true
    }

    if (STRONG_VERB_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
      hasStrongVerb = true
    }

    if (TECHNOLOGY_TERMS.includes(normalized)) {
      technologyWords.add(normalized)
    }
  })

  const significantWordCount = significantWords.size
  const technologyOnly = significantWordCount > 0 && technologyWords.size === significantWordCount

  let score = 0
  if (hasMetric) score += 5
  if (hasScope) score += 3
  if (hasSeniority) score += 2
  if (hasStrongVerb) score += 2
  score += Math.min(significantWordCount, 4)

  return {
    score,
    addedRelevantCount,
    significantWordCount,
    hasMetric,
    hasScope,
    hasSeniority,
    hasStrongVerb,
    technologyOnly,
  }
}

function shouldHighlightPhraseUnit(
  content: string,
  originalCounts: Map<string, number>,
  mode: HighlightDensityMode,
): {
  highlighted: boolean
  score: number
} {
  const analysis = scorePhraseUnit(content, originalCounts)
  const policy = HIGHLIGHT_POLICIES[mode]
  const trimmedContent = content.trim()

  if (analysis.addedRelevantCount === 0) {
    return { highlighted: false, score: 0 }
  }

  if (!trimmedContent || isStructuralPhraseUnit(trimmedContent)) {
    return { highlighted: false, score: 0 }
  }

  if (analysis.technologyOnly && !analysis.hasMetric && !analysis.hasScope && !analysis.hasStrongVerb) {
    return { highlighted: false, score: 0 }
  }

  if (!analysis.hasMetric && analysis.significantWordCount < 2) {
    return { highlighted: false, score: 0 }
  }

  if (
    getWordCount(trimmedContent) > policy.maxWordsPerSegment
    || trimmedContent.length > policy.maxCharactersPerSegment
  ) {
    return { highlighted: false, score: 0 }
  }

  const highlighted = (
    analysis.score >= policy.minScore
    || analysis.significantWordCount >= 3
  ) && (
    analysis.significantWordCount >= 2
    || analysis.hasMetric
    || analysis.hasScope
  )
  return { highlighted, score: highlighted ? analysis.score : 0 }
}

function buildChunkedHighlightLine(
  original: string,
  optimized: string,
  mode: HighlightDensityMode,
): HighlightedLine {
  const units = splitIntoPhraseUnits(optimized)
  const originalCounts = buildTokenCounts(original)
  const policy = HIGHLIGHT_POLICIES[mode]
  const totalCharacters = optimized.trim().length || 1
  const evaluations = units.map((unit) => ({
    unit,
    ...shouldHighlightPhraseUnit(unit.content, originalCounts, mode),
  }))

  const rankedCandidates = evaluations
    .map((evaluation, index) => ({
      index,
      score: evaluation.score,
      text: `${evaluation.unit.content}${evaluation.unit.trailing}`,
    }))
    .filter((evaluation) => evaluation.score > 0)
    .sort((left, right) => right.score - left.score)

  const allowedIndexes = new Set<number>()
  let highlightedCharacters = 0

  for (const candidate of rankedCandidates) {
    if (allowedIndexes.size >= policy.maxHighlights) {
      break
    }

    const nextCoverage = (highlightedCharacters + candidate.text.trim().length) / totalCharacters
    if (nextCoverage > policy.maxCoverageRatio) {
      continue
    }

    allowedIndexes.add(candidate.index)
    highlightedCharacters += candidate.text.trim().length
  }

  const segments = evaluations.map((evaluation, index) => ({
    text: `${evaluation.unit.content}${evaluation.unit.trailing}`,
    highlighted: allowedIndexes.has(index),
  }))

  return {
    segments: collapseSegments(segments),
    highlightWholeLine: false,
  }
}

export function buildRelevantHighlightLine(
  original: string,
  optimized: string,
  mode: HighlightDensityMode = "inline",
): HighlightedLine {
  if (mode === "summary") {
    return createNonHighlightedLine(normalizePreviewSummaryText(optimized))
  }

  if (!optimized.trim()) {
    return createNonHighlightedLine(optimized)
  }

  if (!original.trim() || isMinorFormattingOnlyChange(original, optimized)) {
    return createNonHighlightedLine(optimized)
  }

  if (mode === "experience") {
    const bestCandidate = collectRankedExperienceHighlightCandidates(optimized)[0] ?? null
    return buildExperienceHighlightLine(optimized, bestCandidate)
  }

  const chunked = buildChunkedHighlightLine(original, optimized, mode)
  if (chunked.segments.some((segment) => segment.highlighted)) {
    return chunked
  }

  return buildFallbackHighlightLine(original, optimized, mode) ?? chunked
}

function calculateTextSimilarity(original: string, optimized: string): number {
  const left = new Set(
    normalizeText(original)
      .split(/[^a-z0-9%]+/g)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  )
  const right = new Set(
    normalizeText(optimized)
      .split(/[^a-z0-9%]+/g)
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token)),
  )

  if (left.size === 0 || right.size === 0) {
    return 0
  }

  let shared = 0
  left.forEach((token) => {
    if (right.has(token)) {
      shared += 1
    }
  })

  return shared / Math.max(left.size, right.size)
}

function findClosestOriginalBullet(originalBullets: string[], optimizedBullet: string): string | undefined {
  let bestMatch: string | undefined
  let bestScore = -1

  for (const originalBullet of originalBullets) {
    const score = calculateTextSimilarity(originalBullet, optimizedBullet)
    if (score > bestScore) {
      bestScore = score
      bestMatch = originalBullet
    }
  }

  return bestMatch
}

function buildBulletHighlight(
  originalEntry: ExperienceEntry | undefined,
  optimizedBullet: string,
  bulletIndex: number,
): ExperienceBulletHighlightResult {
  const originalBullets = originalEntry?.bullets ?? []
  const closestOriginalBullet = findClosestOriginalBullet(originalBullets, optimizedBullet) ?? ""
  const improvement = evaluateExperienceBulletImprovement(closestOriginalBullet, optimizedBullet)
  const bestCandidate = collectRankedExperienceHighlightCandidates(optimizedBullet)[0] ?? null
  const canRenderHighlight = improvement.eligible && bestCandidate !== null
  const highlightTier = bestCandidate ? tierForExperienceCategory(bestCandidate.category) : undefined

  return {
    bullet: optimizedBullet,
    bulletIndex,
    line: canRenderHighlight
      ? buildExperienceHighlightLine(optimizedBullet, bestCandidate)
      : createNonHighlightedLine(optimizedBullet),
    eligible: improvement.eligible,
    hasVisibleHighlightCandidate: bestCandidate !== null,
    renderable: canRenderHighlight,
    improvementScore: improvement.score,
    winnerScore: bestCandidate?.score ?? 0,
    highlightTier,
    highlightCategory: bestCandidate?.category,
  }
}

function hasRenderedExperienceHighlight(result: ExperienceBulletHighlightResult): boolean {
  return result.renderable
    && result.line.segments.some((segment) => segment.highlighted)
    && result.highlightTier !== undefined
    && result.highlightCategory !== undefined
}

function getExperienceHighlightTierPriority(result: ExperienceBulletHighlightResult): number {
  if (result.highlightTier === "strong") {
    return 0
  }

  if (result.highlightTier === "secondary") {
    return 1
  }

  return Number.MAX_SAFE_INTEGER
}

function getExperienceHighlightCategoryPriority(result: ExperienceBulletHighlightResult): number {
  return result.highlightCategory
    ? EXPERIENCE_HIGHLIGHT_CATEGORY_PRIORITY[result.highlightCategory]
    : Number.MAX_SAFE_INTEGER
}

function shouldTraceExperienceHighlightSurfacing(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false
  }

  /**
   * This selector is reached from ResumeComparisonView, a Client Component that Next.js App Router
   * may prerender on the server during the initial page load and run again on the client after hydration.
   * The debug flag is therefore runtime-local: set it in the current non-production runtime where you
   * want the trace (Node/test or browser). It is not a supported browser-to-SSR control switch.
   */
  if (typeof globalThis === "undefined") {
    return false
  }

  const debugGlobal = globalThis as typeof globalThis & {
    [EXPERIENCE_HIGHLIGHT_SURFACING_DEBUG_FLAG]?: boolean
  }

  return debugGlobal[EXPERIENCE_HIGHLIGHT_SURFACING_DEBUG_FLAG] === true
}

function traceExperienceHighlightSurfacingDecision(
  bulletResults: ExperienceBulletHighlightResult[],
  selectedResults: ExperienceBulletHighlightResult[],
  maxVisibleHighlights: number,
): void {
  if (!shouldTraceExperienceHighlightSurfacing()) {
    return
  }

  const selectedBulletIndexes = new Set(selectedResults.map((result) => result.bulletIndex))
  const surfacingEligibleResults = bulletResults.filter((result) => result.eligible && hasRenderedExperienceHighlight(result))
  const suppressedBulletIndexes = surfacingEligibleResults
    .map((result) => result.bulletIndex)
    .filter((bulletIndex) => !selectedBulletIndexes.has(bulletIndex))

  console.debug("[optimized-preview-highlights] experience-entry surfacing", {
    maxVisibleHighlights,
    eligibleBulletIndexes: surfacingEligibleResults.map((result) => result.bulletIndex),
    selectedBulletIndexes: selectedResults.map((result) => result.bulletIndex),
    suppressedBulletIndexes,
    bullets: bulletResults.map((result) => {
      const surfacingEligible = result.eligible && hasRenderedExperienceHighlight(result)
      const selected = selectedBulletIndexes.has(result.bulletIndex)

      return {
        bulletIndex: result.bulletIndex,
        surfacingEligible,
        hasVisibleHighlightCandidate: result.hasVisibleHighlightCandidate,
        renderable: result.renderable,
        highlightTier: result.highlightTier,
        highlightCategory: result.highlightCategory,
        improvementScore: result.improvementScore,
        winnerScore: result.winnerScore,
        selected,
        suppressed: surfacingEligible && !selected,
      }
    }),
  })
}

/**
 * Layer 3 entry-level surfacing policy.
 * It consumes finalized bullet-level results plus an explicit per-entry cap because changing
 * that cap changes which bullets remain visible under editorial slot pressure.
 */
export function selectVisibleExperienceHighlightsForEntry(
  bulletResults: ExperienceBulletHighlightResult[],
  maxVisibleHighlights = MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY,
): ExperienceBulletHighlightResult[] {
  const selectedResults = bulletResults
    .filter((result) => result.eligible && hasRenderedExperienceHighlight(result))
    .sort((left, right) =>
      getExperienceHighlightTierPriority(left) - getExperienceHighlightTierPriority(right)
      || getExperienceHighlightCategoryPriority(left) - getExperienceHighlightCategoryPriority(right)
      || right.winnerScore - left.winnerScore
      || right.improvementScore - left.improvementScore
      || left.bulletIndex - right.bulletIndex,
    )
    .slice(0, maxVisibleHighlights)

  traceExperienceHighlightSurfacingDecision(bulletResults, selectedResults, maxVisibleHighlights)

  return selectedResults
}

function findMatchingExperienceEntry(
  originalExperience: ExperienceEntry[],
  optimizedEntry: ExperienceEntry,
): ExperienceEntry | undefined {
  const normalizedTitle = normalizeText(optimizedEntry.title)
  const normalizedCompany = normalizeText(optimizedEntry.company)

  return originalExperience.find((entry) =>
    normalizeText(entry.title) === normalizedTitle
    && normalizeText(entry.company) === normalizedCompany,
  )
}

export function buildOptimizedPreviewHighlights(
  originalCvState: CVState,
  optimizedCvState: CVState,
): OptimizedPreviewHighlights {
  return {
    summary: createNonHighlightedLine(normalizePreviewSummaryText(optimizedCvState.summary)),
    experience: optimizedCvState.experience.map((optimizedEntry) => {
      const originalEntry = findMatchingExperienceEntry(originalCvState.experience, optimizedEntry)
      const bulletResults = optimizedEntry.bullets.map((bullet, bulletIndex) =>
        buildBulletHighlight(originalEntry, bullet, bulletIndex),
      )
      const highlightedBulletIndexes = new Set(
        selectVisibleExperienceHighlightsForEntry(bulletResults)
          .map((entry) => entry.bulletIndex),
      )

      return {
        title: createNonHighlightedLine(optimizedEntry.title),
        bullets: bulletResults.map((entry, index) =>
          highlightedBulletIndexes.has(index)
            ? entry.line
            : createNonHighlightedLine(optimizedEntry.bullets[index] ?? ""),
        ),
      }
    }),
  }
}
