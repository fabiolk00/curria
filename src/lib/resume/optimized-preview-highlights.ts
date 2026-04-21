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
  if (!optimized.trim()) {
    return createNonHighlightedLine(optimized)
  }

  if (!original.trim() || isMinorFormattingOnlyChange(original, optimized)) {
    return createNonHighlightedLine(optimized)
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
): HighlightedLine {
  const originalBullets = originalEntry?.bullets ?? []
  const closestOriginalBullet = findClosestOriginalBullet(originalBullets, optimizedBullet) ?? ""

  return buildRelevantHighlightLine(closestOriginalBullet, optimizedBullet, "experience")
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
    summary: buildRelevantHighlightLine(originalCvState.summary, optimizedCvState.summary, "summary"),
    experience: optimizedCvState.experience.map((optimizedEntry) => {
      const originalEntry = findMatchingExperienceEntry(originalCvState.experience, optimizedEntry)

      return {
        title: buildRelevantHighlightLine(originalEntry?.title ?? "", optimizedEntry.title, "inline"),
        bullets: optimizedEntry.bullets.map((bullet) => buildBulletHighlight(originalEntry, bullet)),
      }
    }),
  }
}
