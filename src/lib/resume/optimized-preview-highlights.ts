import type { CVState, ExperienceEntry } from "@/types/cv"

export type HighlightSegment = {
  text: string
  highlighted: boolean
}

export type HighlightedLine = {
  segments: HighlightSegment[]
  highlightWholeLine: boolean
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

type ExperienceHighlightCandidate = HighlightMatch & {
  score: number
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
    if (previous && previous.highlighted === segment.highlighted) {
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

  const segments: HighlightSegment[] = []
  if (candidate.start > 0) {
    segments.push({ text: text.slice(0, candidate.start), highlighted: false })
  }
  segments.push({ text: text.slice(candidate.start, candidate.end), highlighted: true })
  if (candidate.end < text.length) {
    segments.push({ text: text.slice(candidate.end), highlighted: false })
  }

  return {
    segments: collapseSegments(segments),
    highlightWholeLine: false,
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
    const bestCandidate = collectExperienceHighlightCandidates(original, optimized)[0] ?? null
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
): {
  line: HighlightedLine
  score: number
} {
  const originalBullets = originalEntry?.bullets ?? []
  const closestOriginalBullet = findClosestOriginalBullet(originalBullets, optimizedBullet) ?? ""
  const bestCandidate = collectExperienceHighlightCandidates(closestOriginalBullet, optimizedBullet)[0] ?? null

  return {
    line: buildExperienceHighlightLine(optimizedBullet, bestCandidate),
    score: bestCandidate?.score ?? 0,
  }
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
      const scoredBullets = optimizedEntry.bullets.map((bullet) => buildBulletHighlight(originalEntry, bullet))
      const highlightedBulletIndexes = new Set(
        scoredBullets
          .map((entry, index) => ({ index, score: entry.score }))
          .filter((entry) => entry.score > 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, MAX_HIGHLIGHTED_BULLETS_PER_EXPERIENCE_ENTRY)
          .map((entry) => entry.index),
      )

      return {
        title: createNonHighlightedLine(optimizedEntry.title),
        bullets: scoredBullets.map((entry, index) =>
          highlightedBulletIndexes.has(index)
            ? entry.line
            : createNonHighlightedLine(optimizedEntry.bullets[index] ?? ""),
        ),
      }
    }),
  }
}
