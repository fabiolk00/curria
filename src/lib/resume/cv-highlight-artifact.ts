import { z } from 'zod'

import type { CVState, ExperienceEntry } from '@/types/cv'

export const CV_HIGHLIGHT_ARTIFACT_VERSION = 2

const SUMMARY_MAX_HIGHLIGHT_COVERAGE = 0.4
const EXPERIENCE_MAX_HIGHLIGHT_COVERAGE = 0.55
const COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH = 90
const HIGHLIGHT_STACK_SEPARATOR_CHAR = '|'
const HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS = 96
const HIGHLIGHT_MAX_CONTINUATION_WORDS = 12
const HIGHLIGHT_MAX_CANDIDATE_ENDS = 12
const HIGHLIGHT_MAX_CANDIDATE_STARTS = 8

function adaptiveCoverageThreshold(textLength: number): number {
  if (textLength < 60) return 0.75
  if (textLength < 100) return 0.68
  return EXPERIENCE_MAX_HIGHLIGHT_COVERAGE
}

const HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS = new Set([
  ',',
  '.',
  ':',
  ';',
  '(',
  ')',
  '[',
  ']',
  '/',
  '\\',
  HIGHLIGHT_STACK_SEPARATOR_CHAR,
  '-',
  '–',
  '—',
])

const HIGHLIGHT_MERGEABLE_GAP_CHARS = new Set([
  ',',
  '(',
  ')',
  '[',
  ']',
  '/',
  '\\',
  '-',
  '–',
  '—',
])

const HIGHLIGHT_INLINE_COMPOSITE_CHARS = new Set([
  '/',
  '\\',
  '-',
  '–',
  '—',
])

const HIGHLIGHT_STRONG_CLAUSE_START_PATTERN =
  /^(?:and|but|while|however|whereas|mas|por(?:e|é)m|enquanto|because|porque)\b/i

const HIGHLIGHT_VERB_HINT_PATTERN =
  /\b(?:led|built|created|designed|developed|implemented|managed|reduced|increased|improved|optimized|automated|scaled|delivered|owned|migrated|supported|analyzed|organized|reinforced|maintained|provided|served|coordinated|generated|boosted|cut|saved|grew|elevated|expanded|accelerated|defined|projetei|atendi|atuei|organizei|reforcei|mantive|prestei|coordenei|garanti|contribui|suportei|aumentei|reduzi|melhorei|otimizei|automatizei|liderei|criei|desenvolvi|implementei|gerenciei|entreguei|migrei|apoiei|analisei|gerei|ampliei|acelerei|expandi|elevei|defini)\b/i

const HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN =
  /\b(?:focused|specialized|oriented|dedicated|responsible|experienced|especializado|focado|orientado|dedicado|responsavel|responsável|experiente)\b/i

const HIGHLIGHT_FALLBACK_ACTION_VERB_PATTERN =
  /\b(?:led|built|created|designed|developed|implemented|managed|reduced|increased|improved|optimized|automated|scaled|delivered|owned|migrated|supported|analyzed|organized|reinforced|maintained|provided|served|coordinated|generated|boosted|cut|saved|grew|elevated|expanded|accelerated|defined|projetei|atendi|atuei|organizei|reforcei|mantive|prestei|coordenei|garanti|contribui|suportei|aumentei|reduzi|melhorei|otimizei|automatizei|liderei|criei|desenvolvi|implementei|gerenciei|entreguei|migrei|apoiei|analisei|gerei|ampliei|acelerei|expandi|elevei|defini)\b/i

const HIGHLIGHT_SCALE_COMPLEXITY_PATTERN =
  /\b(?:large-scale|high-volume|scalable|scalability|grandes volumes|alto volume|escal[aá]vel|escala|processamento escal[aá]vel|data modeling|modelagem de dados|arquitetura|architecture|governan[cç]a|governance|performance|latency|throughput|reliability|stability|estabilidade|produção|producao)\b/i

const HIGHLIGHT_BUSINESS_IMPACT_PATTERN =
  /\b(?:reduced|increased|improved|optimized|saved|generated|boosted|cut|grew|reduzi|aumentei|melhorei|otimizei|gerei|economia|saving|savings|impact|resultado|outcome|eficiência|eficiencia)\b/i

const HIGHLIGHT_METRIC_PATTERN =
  /\b(?:\d+(?:[.,]\d+)?%|\$\s?\d|\d+\s?(?:x|k|m|b|mil|milh(?:ão|ao|ões|oes))|\bzero downtime\b|\b0 downtime\b|\bmais de \d+\b|\bmore than \d+\b)\b/i

const HIGHLIGHT_TOOL_CONTEXT_PATTERN =
  /\b(?:azure databricks|databricks|pyspark|spark|python|sql|power bi|qlik|bigquery|gcp|etl|api|apis|sharepoint|dynamics crm|rest)\b/i

const HIGHLIGHT_WEAK_GENERIC_LEAD_PATTERN =
  /^(?:led|built|created|developed|implemented|desenvolvi|liderei|criei|implementei|atuei)\b/i

export type CvHighlightInputItem = {
  itemId: string
  section: 'summary' | 'experience'
  text: string
  experienceIndex?: number
  bulletIndex?: number
}

export type CvHighlightReason =
  | 'metric_impact'
  | 'business_impact'
  | 'action_result'
  | 'ats_strength'
  | 'tool_context'

export type CvHighlightRange = {
  start: number
  end: number
  reason: CvHighlightReason
}

export type CvResolvedHighlight = {
  itemId: string
  section: 'summary' | 'experience'
  ranges: CvHighlightRange[]
}

export type CvHighlightState = {
  source: 'rewritten_cv_state'
  version: typeof CV_HIGHLIGHT_ARTIFACT_VERSION
  resolvedHighlights: CvResolvedHighlight[]
  generatedAt: string
  cvStateFingerprint?: string
}

export type CvHighlightDetectionResult = Array<{
  itemId: string
  ranges: Array<{
    start: number
    end: number
    reason: CvHighlightReason
  }>
}>

export type CvHighlightTextSegment = {
  text: string
  highlighted: boolean
  reason?: CvHighlightReason
}

const cvHighlightReasonSchema = z.enum([
  'metric_impact',
  'business_impact',
  'action_result',
  'ats_strength',
  'tool_context',
])

const cvHighlightRangeSchema = z.object({
  start: z.number().int(),
  end: z.number().int(),
  reason: cvHighlightReasonSchema,
})

const cvHighlightDetectionItemSchema = z.object({
  itemId: z.string().min(1),
  ranges: z.array(cvHighlightRangeSchema),
})

const cvHighlightDetectionObjectSchema = z.object({
  items: z.array(cvHighlightDetectionItemSchema),
})

const cvResolvedHighlightSchema = z.object({
  itemId: z.string().min(1),
  section: z.enum(['summary', 'experience']),
  ranges: z.array(cvHighlightRangeSchema),
})

const cvHighlightStateSchema = z.object({
  source: z.literal('rewritten_cv_state'),
  version: z.literal(CV_HIGHLIGHT_ARTIFACT_VERSION),
  resolvedHighlights: z.array(cvResolvedHighlightSchema),
  generatedAt: z.string().min(1),
  cvStateFingerprint: z.string().optional(),
})

export function createSummaryHighlightItemId(): string {
  return 'summary_0'
}

export function canonicalizeHighlightIdentityText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function hashHighlightIdentity(value: string): string {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(36).padStart(7, '0')
}

function buildExperienceBulletIdentitySeed(
  experience: ExperienceEntry,
  bullet: string,
): string {
  return [
    canonicalizeHighlightIdentityText(experience.title),
    canonicalizeHighlightIdentityText(experience.company),
    canonicalizeHighlightIdentityText(experience.startDate),
    canonicalizeHighlightIdentityText(experience.endDate),
    canonicalizeHighlightIdentityText(bullet),
  ].join('::')
}

export function createExperienceBulletHighlightItemId(
  experience: ExperienceEntry,
  bullet: string,
  occurrenceIndex = 0,
): string {
  return `exp_${hashHighlightIdentity(`${buildExperienceBulletIdentitySeed(experience, bullet)}::${occurrenceIndex}`)}`
}

export function buildExperienceBulletHighlightItemIds(
  experience: ExperienceEntry,
): Array<string | undefined> {
  const occurrenceBySeed = new Map<string, number>()

  return experience.bullets.map((bullet) => {
    if (!bullet.trim()) {
      return undefined
    }

    const seed = buildExperienceBulletIdentitySeed(experience, bullet)
    const occurrenceIndex = occurrenceBySeed.get(seed) ?? 0
    occurrenceBySeed.set(seed, occurrenceIndex + 1)

    return createExperienceBulletHighlightItemId(experience, bullet, occurrenceIndex)
  })
}

export function computeCvStateFingerprint(cvState: CVState): string {
  const seed = [
    canonicalizeHighlightIdentityText(cvState.summary),
    ...cvState.experience.flatMap((exp) => [
      canonicalizeHighlightIdentityText(exp.title),
      canonicalizeHighlightIdentityText(exp.company),
      canonicalizeHighlightIdentityText(exp.startDate),
      canonicalizeHighlightIdentityText(exp.endDate),
      ...exp.bullets.map((b) => canonicalizeHighlightIdentityText(b)),
    ]),
  ].join('|||')

  return hashHighlightIdentity(seed)
}

export function highlightStateMatchesCvState(
  highlightState: CvHighlightState,
  cvState: CVState,
): boolean {
  if (!highlightState.cvStateFingerprint) {
    return false
  }

  return highlightState.cvStateFingerprint === computeCvStateFingerprint(cvState)
}

export function flattenCvStateForHighlight(cvState: CVState): CvHighlightInputItem[] {
  const items: CvHighlightInputItem[] = []

  if (cvState.summary.trim()) {
    items.push({
      itemId: createSummaryHighlightItemId(),
      section: 'summary',
      text: cvState.summary,
    })
  }

  cvState.experience.forEach((experience, experienceIndex) => {
    const itemIds = buildExperienceBulletHighlightItemIds(experience)

    experience.bullets.forEach((bullet, bulletIndex) => {
      const itemId = itemIds[bulletIndex]
      if (!itemId) return

      items.push({
        itemId,
        section: 'experience',
        experienceIndex,
        bulletIndex,
        text: bullet,
      })
    })
  })

  return items
}

function parseRawHighlightDetection(raw: unknown): CvHighlightDetectionResult {
  const objectResult = cvHighlightDetectionObjectSchema.safeParse(raw)
  if (objectResult.success) return objectResult.data.items

  const arrayResult = z.array(cvHighlightDetectionItemSchema).safeParse(raw)
  if (arrayResult.success) return arrayResult.data

  return []
}

function isSafeNonOverlappingRange(
  range: CvHighlightRange,
  itemText: string,
  previousAcceptedRange?: CvHighlightRange,
): boolean {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) return false
  if (range.start < 0 || range.end <= range.start || range.end > itemText.length) return false
  if (previousAcceptedRange && range.start < previousAcceptedRange.end) return false
  return true
}

function clampHighlightRange(
  textLength: number,
  range: CvHighlightRange,
): CvHighlightRange | null {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) return null

  const start = Math.max(0, Math.min(textLength, range.start))
  const end = Math.max(0, Math.min(textLength, range.end))
  if (end <= start) return null

  return { start, end, reason: range.reason }
}

function isWhitespaceLike(char: string | undefined): boolean {
  return typeof char === 'string' && /\s/u.test(char)
}

function isWordLikeChar(char: string | undefined): boolean {
  return typeof char === 'string' && /[\p{L}\p{N}]/u.test(char)
}

function countHighlightWords(value: string): number {
  return value.match(/[\p{L}\p{N}$%+#]+/gu)?.length ?? 0
}

function hasMeaningfulHighlightContent(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value) || /\$\s*\d/u.test(value)
}

function trimHighlightEdgeNoiseBounds(
  text: string,
  start: number,
  end: number,
): { start: number; end: number } | null {
  let nextStart = start
  let nextEnd = end

  while (
    nextStart < nextEnd
    && (
      isWhitespaceLike(text[nextStart])
      || HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(text[nextStart]!)
    )
  ) {
    nextStart += 1
  }

  while (
    nextEnd > nextStart
    && (
      isWhitespaceLike(text[nextEnd - 1])
      || HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(text[nextEnd - 1]!)
    )
  ) {
    nextEnd -= 1
  }

  if (nextEnd <= nextStart) return null
  return { start: nextStart, end: nextEnd }
}

function normalizeRangeToWordBoundaries(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let start = range.start
  let end = range.end

  while (
    start > 0
    && isWordLikeChar(text[start - 1])
    && (
      isWordLikeChar(text[start])
      || (HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[start]!) && isWordLikeChar(text[start + 1]))
    )
  ) {
    start -= 1
  }

  while (
    end < text.length
    && isWordLikeChar(text[end])
    && (isWordLikeChar(text[end - 1]) || HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[end - 1]!))
  ) {
    end += 1
  }

  return { start, end, reason: range.reason }
}

function expandRangeLeftForCurrencyPrefix(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let start = range.start

  if (start > 0 && text[start - 1] === '$' && isWordLikeChar(text[start])) {
    start -= 1
  }

  return { start, end: range.end, reason: range.reason }
}

function expandRangeAcrossInlineCompositeTerms(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let start = range.start
  let end = range.end

  while (
    start > 1
    && HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[start - 1]!)
    && isWordLikeChar(text[start - 2])
    && isWordLikeChar(text[start])
  ) {
    start -= 1
    while (start > 0 && isWordLikeChar(text[start - 1])) start -= 1
  }

  while (
    end + 1 < text.length
    && HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[end]!)
    && isWordLikeChar(text[end - 1])
    && isWordLikeChar(text[end + 1])
  ) {
    end += 1
    while (end < text.length && isWordLikeChar(text[end])) end += 1
  }

  if (end < text.length && text[end] === '%' && isWordLikeChar(text[end - 1])) {
    end += 1
  }

  return { start, end, reason: range.reason }
}

function collectTokenStarts(text: string): number[] {
  const starts: number[] = []
  let inToken = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const wordLike = isWordLikeChar(char)
    if (wordLike && !inToken) {
      starts.push(index)
      inToken = true
    } else if (!wordLike) {
      inToken = false
    }
  }

  return starts
}

function collectTokenEnds(text: string): number[] {
  const ends: number[] = []
  let inToken = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const wordLike = isWordLikeChar(char)

    if (wordLike) {
      inToken = true
      continue
    }

    if (inToken) {
      ends.push(index)
      inToken = false
    }
  }

  if (inToken) ends.push(text.length)

  return ends
}

function scoreFragment(fragment: string, reason: CvHighlightReason): number {
  const trimmed = fragment.trim()
  if (!trimmed) return Number.NEGATIVE_INFINITY

  let score = 0

  if (HIGHLIGHT_METRIC_PATTERN.test(trimmed)) score += 40
  if (HIGHLIGHT_SCALE_COMPLEXITY_PATTERN.test(trimmed)) score += 28
  if (HIGHLIGHT_BUSINESS_IMPACT_PATTERN.test(trimmed)) score += 20
  if (HIGHLIGHT_TOOL_CONTEXT_PATTERN.test(trimmed)) score += 6
  if (HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed)) score += 8
  if (HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN.test(trimmed)) score += 6

  if (reason === 'metric_impact') score += 8
  if (reason === 'business_impact') score += 6

  if (HIGHLIGHT_WEAK_GENERIC_LEAD_PATTERN.test(trimmed)) score -= 10
  if (countHighlightWords(trimmed) <= 2) score -= 12
  if (countHighlightWords(trimmed) >= 18) score -= 12

  return score
}

function buildCandidateRanges(text: string, range: CvHighlightRange): CvHighlightRange[] {
  const tokenStarts = collectTokenStarts(text)
  const tokenEnds = collectTokenEnds(text)

  const candidateStarts = tokenStarts
    .filter((start) => start >= range.start && start <= Math.min(range.end + 40, text.length))
    .slice(0, HIGHLIGHT_MAX_CANDIDATE_STARTS)

  const candidateEnds = tokenEnds
    .filter((end) => end >= Math.max(range.end, range.start + 1) && end <= Math.min(range.end + HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS, text.length))
    .slice(0, HIGHLIGHT_MAX_CANDIDATE_ENDS)

  const candidates: CvHighlightRange[] = [range]

  for (const start of candidateStarts) {
    for (const end of candidateEnds) {
      if (end <= start) continue

      const trimmed = trimHighlightEdgeNoiseBounds(text, start, end)
      if (!trimmed) continue

      candidates.push({
        start: trimmed.start,
        end: trimmed.end,
        reason: range.reason,
      })
    }
  }

  return candidates
}

function preferCandidate(
  left: CvHighlightRange,
  right: CvHighlightRange,
  text: string,
): boolean {
  const leftFragment = text.slice(left.start, left.end)
  const rightFragment = text.slice(right.start, right.end)

  const leftScore = scoreFragment(leftFragment, left.reason)
  const rightScore = scoreFragment(rightFragment, right.reason)

  if (leftScore !== rightScore) return leftScore > rightScore

  const leftLength = left.end - left.start
  const rightLength = right.end - right.start

  if (leftLength !== rightLength) return leftLength < rightLength
  if (left.start !== right.start) return left.start > right.start

  return left.end < right.end
}

function chooseBestSemanticCandidate(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  const candidates = buildCandidateRanges(text, range)
    .map((candidate) => normalizeRangeToWordBoundaries(text, candidate))
    .map((candidate) => expandRangeLeftForCurrencyPrefix(text, candidate))
    .map((candidate) => expandRangeAcrossInlineCompositeTerms(text, candidate))
    .filter((candidate) => candidate.end > candidate.start)
    .filter((candidate, index, list) => {
      return list.findIndex((other) =>
        other.start === candidate.start
        && other.end === candidate.end
        && other.reason === candidate.reason) === index
    })

  let best = range

  for (const candidate of candidates) {
    const fragment = text.slice(candidate.start, candidate.end)
    if (!hasMeaningfulHighlightContent(fragment)) continue

    if (preferCandidate(candidate, best, text)) {
      best = candidate
    }
  }

  return best
}

function isLikelyPipeStackText(text: string): boolean {
  const pipeCount = text.split(HIGHLIGHT_STACK_SEPARATOR_CHAR).length - 1
  if (pipeCount < 2) return false
  return !HIGHLIGHT_VERB_HINT_PATTERN.test(text)
}

function isWeakPipeSegment(itemText: string, fragment: string): boolean {
  if (!isLikelyPipeStackText(itemText)) return false
  if (/\d|\$|%/u.test(fragment) || HIGHLIGHT_VERB_HINT_PATTERN.test(fragment)) return false
  return countHighlightWords(fragment) <= 2
}

function constrainRangeToPipeSegment(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const fragment = text.slice(range.start, range.end)

  if (!fragment.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    if (isWeakPipeSegment(text, fragment.trim())) return null
    return range
  }

  const segments = fragment
    .split(HIGHLIGHT_STACK_SEPARATOR_CHAR)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length === 0) return null

  let bestSegment = segments[0]
  let bestScore = scoreFragment(bestSegment, range.reason)

  for (const segment of segments.slice(1)) {
    const score = scoreFragment(segment, range.reason)
    if (score > bestScore) {
      bestSegment = segment
      bestScore = score
    }
  }

  const start = text.indexOf(bestSegment, range.start)
  if (start < 0) return null

  const constrained = {
    start,
    end: start + bestSegment.length,
    reason: range.reason,
  }

  if (isWeakPipeSegment(text, bestSegment)) return null
  return constrained
}

function shouldMergeAcrossIgnorableGap(
  text: string,
  previousRange: CvHighlightRange,
  nextRange: CvHighlightRange,
): boolean {
  if (previousRange.reason !== nextRange.reason) return false

  const gapText = text.slice(previousRange.end, nextRange.start)
  if (!gapText) return false

  if (
    [...gapText].some(
      (char) => !isWhitespaceLike(char) && !HIGHLIGHT_MERGEABLE_GAP_CHARS.has(char),
    )
  ) {
    return false
  }

  const mergedText = text.slice(previousRange.start, nextRange.end).trim()
  if (mergedText.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) return false

  return countHighlightWords(mergedText) <= HIGHLIGHT_MAX_CONTINUATION_WORDS + 4
}

export function normalizeHighlightSpanBoundaries(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  let normalizedRange = clampHighlightRange(text.length, range)
  if (!normalizedRange) return null

  const trimmedInitialBounds = trimHighlightEdgeNoiseBounds(
    text,
    normalizedRange.start,
    normalizedRange.end,
  )
  if (!trimmedInitialBounds) return null

  normalizedRange = {
    start: trimmedInitialBounds.start,
    end: trimmedInitialBounds.end,
    reason: range.reason,
  }

  normalizedRange = normalizeRangeToWordBoundaries(text, normalizedRange)
  normalizedRange = expandRangeLeftForCurrencyPrefix(text, normalizedRange)
  normalizedRange = expandRangeAcrossInlineCompositeTerms(text, normalizedRange)

  normalizedRange = chooseBestSemanticCandidate(text, normalizedRange)

  if (text.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    const constrainedRange = constrainRangeToPipeSegment(text, normalizedRange)
    if (!constrainedRange) return null
    normalizedRange = constrainedRange
  }

  const trimmedFinalBounds = trimHighlightEdgeNoiseBounds(
    text,
    normalizedRange.start,
    normalizedRange.end,
  )
  if (!trimmedFinalBounds) return null

  const finalRange: CvHighlightRange = {
    start: trimmedFinalBounds.start,
    end: trimmedFinalBounds.end,
    reason: normalizedRange.reason,
  }

  if (!hasMeaningfulHighlightContent(text.slice(finalRange.start, finalRange.end))) {
    return null
  }

  return finalRange
}

export function normalizeHighlightRangesForSegmentation(
  text: string,
  ranges: CvHighlightRange[],
): CvHighlightRange[] {
  const textLength = text.length
  const sortedRanges = ranges
    .map((range) => clampHighlightRange(textLength, range))
    .filter((range): range is CvHighlightRange => range !== null)
    .map((range) => normalizeHighlightSpanBoundaries(text, range))
    .filter((range): range is CvHighlightRange => range !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end)

  return sortedRanges.reduce<CvHighlightRange[]>((acc, range) => {
    const previousRange = acc[acc.length - 1]

    if (!previousRange) {
      acc.push(range)
      return acc
    }

    if (
      previousRange.start === range.start
      && previousRange.end === range.end
      && previousRange.reason === range.reason
    ) {
      return acc
    }

    if (range.start < previousRange.end) {
      if (preferCandidate(range, previousRange, text)) {
        acc[acc.length - 1] = range
      }
      return acc
    }

    if (shouldMergeAcrossIgnorableGap(text, previousRange, range)) {
      const merged: CvHighlightRange = {
        start: previousRange.start,
        end: range.end,
        reason: previousRange.reason,
      }

      acc[acc.length - 1] = preferCandidate(merged, previousRange, text) ? merged : previousRange
      return acc
    }

    acc.push(range)
    return acc
  }, [])
}

function isCompactMeasurableExperienceHighlight(text: string): boolean {
  if (text.trim().length > COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH) return false

  return (
    /\d/.test(text)
    && /\b(reduced|increased|improved|grew|cut|saved|boosted|generated|delivered|optimized|accelerated|elevated|expanded|aumentei|reduzi|elevei|melhorei|otimizei|ampliei|gerei|entreguei|acelerei|expandi)\b/i.test(
      text,
    )
  )
}

export function isEditoriallyAcceptableHighlightRange(
  text: string,
  range: CvHighlightRange,
  section: 'summary' | 'experience',
): boolean {
  const textLength = Math.max(text.trim().length, 1)
  const coverage = (range.end - range.start) / textLength
  const fragment = text.slice(range.start, range.end)

  if (section === 'summary') {
    return coverage <= SUMMARY_MAX_HIGHLIGHT_COVERAGE
  }

  const ceiling = adaptiveCoverageThreshold(textLength)

  if (scoreFragment(fragment, range.reason) >= 36) {
    return coverage <= Math.max(ceiling, 0.82)
  }

  if (coverage <= ceiling) return true

  return (
    range.start === 0
    && range.end === text.length
    && isCompactMeasurableExperienceHighlight(text)
  )
}

function buildFallbackHighlightRange(text: string): CvHighlightRange | null {
  const verbMatch = HIGHLIGHT_FALLBACK_ACTION_VERB_PATTERN.exec(text)
  if (!verbMatch) return null

  const metricMatch = HIGHLIGHT_METRIC_PATTERN.exec(text)
  const scaleMatch = HIGHLIGHT_SCALE_COMPLEXITY_PATTERN.exec(text)

  const anchor = metricMatch ?? scaleMatch ?? verbMatch
  const candidate: CvHighlightRange = {
    start: anchor.index,
    end: Math.min(text.length, anchor.index + anchor[0].length + 36),
    reason: metricMatch ? 'metric_impact' : 'ats_strength',
  }

  return normalizeHighlightSpanBoundaries(text, candidate)
}

function applyFallbackHighlightsForUnmarkedItems(
  items: CvHighlightInputItem[],
  resolvedHighlights: CvResolvedHighlight[],
): CvResolvedHighlight[] {
  const highlightedIds = new Set(resolvedHighlights.map((h) => h.itemId))
  const supplementary: CvResolvedHighlight[] = []

  for (const item of items) {
    if (item.section !== 'experience') continue
    if (highlightedIds.has(item.itemId)) continue

    const fallbackRange = buildFallbackHighlightRange(item.text)
    if (!fallbackRange) continue
    if (!isEditoriallyAcceptableHighlightRange(item.text, fallbackRange, 'experience')) continue

    supplementary.push({
      itemId: item.itemId,
      section: 'experience',
      ranges: [fallbackRange],
    })
  }

  return [...resolvedHighlights, ...supplementary]
}

export function validateAndResolveHighlights(
  items: CvHighlightInputItem[],
  raw: unknown,
): CvResolvedHighlight[] {
  if (items.length === 0) return []

  const itemMap = new Map(items.map((item) => [item.itemId, item]))
  const detectionItems = parseRawHighlightDetection(raw)
  const rangesByItemId = new Map<string, CvHighlightRange[]>()
  const resolved: CvResolvedHighlight[] = []

  detectionItems.forEach((candidate) => {
    if (!itemMap.has(candidate.itemId) || !Array.isArray(candidate.ranges)) return
    const existingRanges = rangesByItemId.get(candidate.itemId) ?? []
    existingRanges.push(...candidate.ranges)
    rangesByItemId.set(candidate.itemId, existingRanges)
  })

  rangesByItemId.forEach((candidateRanges, itemId) => {
    const item = itemMap.get(itemId)
    if (!item) return

    const normalizedRanges = normalizeHighlightRangesForSegmentation(item.text, candidateRanges)
    const validRanges = normalizedRanges.reduce<CvHighlightRange[]>((acc, range) => {
      const previousRange = acc[acc.length - 1]

      if (!isSafeNonOverlappingRange(range, item.text, previousRange)) return acc
      if (!isEditoriallyAcceptableHighlightRange(item.text, range, item.section)) return acc

      acc.push({ start: range.start, end: range.end, reason: range.reason })
      return acc
    }, [])

    if (validRanges.length === 0) return

    resolved.push({ itemId, section: item.section, ranges: validRanges })
  })

  return applyFallbackHighlightsForUnmarkedItems(items, resolved)
}

export function getHighlightRangesForItem(
  resolvedHighlights: CvResolvedHighlight[] | undefined,
  itemId: string,
): CvHighlightRange[] {
  if (!resolvedHighlights) return []

  return resolvedHighlights
    .filter((highlight) => highlight.itemId === itemId)
    .flatMap((highlight) => highlight.ranges)
    .sort((left, right) => left.start - right.start || left.end - right.end)
}

export function segmentTextByHighlightRanges(
  text: string,
  ranges: CvHighlightRange[],
): CvHighlightTextSegment[] {
  const normalizedRanges = normalizeHighlightRangesForSegmentation(text, ranges)

  if (normalizedRanges.length === 0) {
    return [{ text, highlighted: false }]
  }

  const segments: CvHighlightTextSegment[] = []
  let cursor = 0

  normalizedRanges.forEach((range) => {
    if (cursor < range.start) {
      segments.push({ text: text.slice(cursor, range.start), highlighted: false })
    }

    segments.push({
      text: text.slice(range.start, range.end),
      highlighted: true,
      reason: range.reason,
    })
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), highlighted: false })
  }

  return segments
}

export function normalizeCvHighlightState(value: unknown): CvHighlightState | undefined {
  const result = cvHighlightStateSchema.safeParse(value)
  return result.success ? result.data : undefined
}
