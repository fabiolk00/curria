import { isHighValueMetricBullet, scoreMetricImpactBulletPriority } from "@/lib/agent/tools/metric-impact-guard"
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

export function buildRelevantHighlightLine(original: string, optimized: string): HighlightedLine {
  if (!optimized.trim()) {
    return { segments: [{ text: optimized, highlighted: false }], highlightWholeLine: false }
  }

  if (!original.trim() || isMinorFormattingOnlyChange(original, optimized)) {
    return { segments: [{ text: optimized, highlighted: false }], highlightWholeLine: false }
  }

  const originalCounts = buildTokenCounts(original)
  const optimizedTokens = tokenizePreservingWhitespace(optimized)
  const relevantAddedCount = optimizedTokens.reduce((count, token) => {
    if (!isWordToken(token)) {
      return count
    }

    const normalized = normalizeToken(token)
    if (!normalized) {
      return count
    }

    const remaining = originalCounts.get(normalized) ?? 0
    if (remaining > 0) {
      originalCounts.set(normalized, remaining - 1)
      return count
    }

    return isRelevantAddedToken(token) ? count + 1 : count
  }, 0)

  if (relevantAddedCount === 0) {
    return { segments: [{ text: optimized, highlighted: false }], highlightWholeLine: false }
  }

  const freshCounts = buildTokenCounts(original)
  const segments = optimizedTokens.map((token) => {
    if (!isWordToken(token)) {
      return { text: token, highlighted: false }
    }

    const normalized = normalizeToken(token)
    if (!normalized) {
      return { text: token, highlighted: false }
    }

    const remaining = freshCounts.get(normalized) ?? 0
    if (remaining > 0) {
      freshCounts.set(normalized, remaining - 1)
      return { text: token, highlighted: false }
    }

    return {
      text: token,
      highlighted: isRelevantAddedToken(token),
    }
  })

  return {
    segments: collapseSegments(segments),
    highlightWholeLine: false,
  }
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
  const relevanceScore = scoreMetricImpactBulletPriority(optimizedBullet)
  const substantialChange = calculateTextSimilarity(closestOriginalBullet, optimizedBullet) < 0.72

  if ((isHighValueMetricBullet(optimizedBullet) || relevanceScore >= 5) && substantialChange) {
    return {
      segments: [{ text: optimizedBullet, highlighted: true }],
      highlightWholeLine: true,
    }
  }

  return buildRelevantHighlightLine(closestOriginalBullet, optimizedBullet)
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
    summary: buildRelevantHighlightLine(originalCvState.summary, optimizedCvState.summary),
    experience: optimizedCvState.experience.map((optimizedEntry) => {
      const originalEntry = findMatchingExperienceEntry(originalCvState.experience, optimizedEntry)

      return {
        title: buildRelevantHighlightLine(originalEntry?.title ?? "", optimizedEntry.title),
        bullets: optimizedEntry.bullets.map((bullet) => buildBulletHighlight(originalEntry, bullet)),
      }
    }),
  }
}
