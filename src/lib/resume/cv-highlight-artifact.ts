import { z } from 'zod'

import type { CVState, ExperienceEntry } from '@/types/cv'

export const CV_HIGHLIGHT_ARTIFACT_VERSION = 2

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUMMARY_MAX_HIGHLIGHT_COVERAGE = 0.4
const EXPERIENCE_MAX_HIGHLIGHT_COVERAGE = 0.55
const COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH = 90
const HIGHLIGHT_STACK_SEPARATOR_CHAR = '|'
const HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS = 72
const HIGHLIGHT_MAX_CONTINUATION_WORDS = 10
const HIGHLIGHT_MAX_CANDIDATE_ENDS = 8

function adaptiveCoverageThreshold(textLength: number): number {
  if (textLength < 60) return 0.75
  if (textLength < 100) return 0.65
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

const HIGHLIGHT_BRIDGEABLE_BOUNDARY_CHARS = new Set([
  ',',
  ':',
  ';',
  '(',
  '[',
  '/',
  '\\',
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
  /\b(?:led|built|created|designed|developed|implemented|managed|reduced|increased|improved|optimized|automated|scaled|delivered|owned|migrated|supported|analyzed|organised|organized|reinforced|maintained|provided|served|coordinated|generated|boosted|cut|saved|grew|elevated|expanded|accelerated|atendi|atuei|organizei|reforcei|mantive|prestei|coordenei|garanti|contribui|suportei|aumentei|reduzi|melhorei|otimizei|automatizei|liderei|criei|desenvolvi|implementei|gerenciei|entreguei|migrei|apoiei|analisei|gerei|ampliei|acelerei|expandi|elevei)\b/i

const HIGHLIGHT_GERUND_CONTINUATION_PATTERN =
  /^(?:contributing|reinforcing|ensuring|supporting|maintaining|reducing|increasing|driving|improving|enabling|closing|strengthening|contribuindo|reforcando|reforçando|garantindo|apoiando|mantendo|reduzindo|aumentando|impulsionando|melhorando|viabilizando|fortalecendo)\b/i

const HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN =
  /^(?:and|e)\s+(?:with|for|in|on|during|com|para|em|no|na|nos|nas|ao|aos|a|à|support|supporting|apoio|apoiando|atendimento|rotinas|processo|processos|disponibilidade|estabilidade|satisfacao|satisfação)\b/i

const HIGHLIGHT_DIRECT_CLOSURE_PREPOSITION_PATTERN =
  /^(?:during|in|on|to|com|para|em|no|na|nos|nas|durante|ao|aos|a|à|as|às)\b/i

const HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN =
  /\b(?:focused|specialized|oriented|dedicated|responsible|experienced|especializado|focado|orientado|dedicado|responsavel|responsável|experiente)\b/i

const HIGHLIGHT_FALLBACK_ACTION_VERB_PATTERN =
  /\b(?:led|built|created|designed|developed|implemented|managed|reduced|increased|improved|optimized|automated|scaled|delivered|owned|migrated|supported|analyzed|organized|reinforced|maintained|provided|served|coordinated|generated|boosted|cut|saved|grew|elevated|expanded|accelerated|atendi|atuei|organizei|reforcei|mantive|prestei|coordenei|garanti|contribui|suportei|aumentei|reduzi|melhorei|otimizei|automatizei|liderei|criei|desenvolvi|implementei|gerenciei|entreguei|migrei|apoiei|analisei|gerei|ampliei|acelerei|expandi|elevei)\b/i

const HIGHLIGHT_WEAK_ENDING_PATTERN =
  /\b(?:for|with|by|via|through|across|in|on|to|during|com|para|em|no|na|nos|nas|ao|aos|a|à|as|às|and|e|the|a|an|o|os|a|as)\s*$/i

const HIGHLIGHT_METRIC_COMPLEMENT_START_PATTERN =
  /^(?:by|with|for|em|com|para)\b/i

const HIGHLIGHT_ZERO_METRIC_PATTERN =
  /\b(?:zero|0)\b/i

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ID / identity helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// CVState fingerprinting
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Flatten
// ---------------------------------------------------------------------------

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
      if (!itemId) {
        return
      }

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

// ---------------------------------------------------------------------------
// Raw detection parsing
// ---------------------------------------------------------------------------

function parseRawHighlightDetection(raw: unknown): CvHighlightDetectionResult {
  const objectResult = cvHighlightDetectionObjectSchema.safeParse(raw)
  if (objectResult.success) {
    return objectResult.data.items
  }

  const arrayResult = z.array(cvHighlightDetectionItemSchema).safeParse(raw)
  if (arrayResult.success) {
    return arrayResult.data
  }

  return []
}

// ---------------------------------------------------------------------------
// Range primitives
// ---------------------------------------------------------------------------

function isSafeNonOverlappingRange(
  range: CvHighlightRange,
  itemText: string,
  previousAcceptedRange?: CvHighlightRange,
): boolean {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    return false
  }

  if (range.start < 0 || range.end <= range.start || range.end > itemText.length) {
    return false
  }

  if (previousAcceptedRange && range.start < previousAcceptedRange.end) {
    return false
  }

  return true
}

function clampHighlightRange(
  textLength: number,
  range: CvHighlightRange,
): CvHighlightRange | null {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) {
    return null
  }

  const start = Math.max(0, Math.min(textLength, range.start))
  const end = Math.max(0, Math.min(textLength, range.end))
  if (end <= start) {
    return null
  }

  return { start, end, reason: range.reason }
}

// ---------------------------------------------------------------------------
// Character helpers
// ---------------------------------------------------------------------------

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

function isInlineDecimalOrAbbreviationBoundary(text: string, index: number): boolean {
  return (
    text[index] === '.'
    && isWordLikeChar(text[index - 1])
    && isWordLikeChar(text[index + 1])
  )
}

function trimTrailingSentencePunctuation(value: string): string {
  return value.replace(/[.,;:!?]\s*$/u, '').trimEnd()
}

function countBalancedPairDelta(value: string, openChar: string, closeChar: string): number {
  let delta = 0
  for (const char of value) {
    if (char === openChar) delta += 1
    if (char === closeChar) delta -= 1
  }
  return delta
}

// ---------------------------------------------------------------------------
// Continuation helpers
// ---------------------------------------------------------------------------

function normalizeLeadingContinuationText(value: string): string {
  let cursor = 0

  while (
    cursor < value.length
    && (isWhitespaceLike(value[cursor]) || HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(value[cursor]!))
  ) {
    cursor += 1
  }

  return value.slice(cursor).trim()
}

function startsWithAttachedContinuation(value: string): boolean {
  const trimmed = normalizeLeadingContinuationText(value)
  if (!trimmed) return false

  return (
    HIGHLIGHT_GERUND_CONTINUATION_PATTERN.test(trimmed)
    || HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN.test(trimmed)
  )
}

function isLikelyNounPhraseContinuation(value: string): boolean {
  const trimmed = normalizeLeadingContinuationText(value)
  if (!trimmed) return false

  return (
    countHighlightWords(trimmed) <= 4
    && !HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed)
    && !HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(trimmed)
  )
}

function hasActionOrMetricLead(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  return HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed) || /[$\d%]/u.test(trimmed)
}

function hasSemanticClosureLead(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false

  return (
    hasActionOrMetricLead(trimmed)
    || HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN.test(trimmed)
  )
}

function isLikelyTightPrepositionalClosure(value: string): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized || !HIGHLIGHT_DIRECT_CLOSURE_PREPOSITION_PATTERN.test(normalized)) {
    return false
  }

  if (countHighlightWords(normalized) > 5) return false

  const [, ...tailWords] = normalized.split(/\s+/u)
  const tail = tailWords.join(' ')
  if (!tail) return false

  return !/\b(?:with|for|by|via|through|across|toward|towards|between|among|com|para|durante|during|em|no|na|nos|nas)\b/i.test(
    tail,
  )
}

function isLikelyTightSemanticComplementClosure(value: string): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized) return false

  if (countHighlightWords(normalized) > 6) return false
  if (HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(normalized)) return false
  if (HIGHLIGHT_VERB_HINT_PATTERN.test(normalized)) return false
  if (/^(?:for|with|by|via|through|across)\b/i.test(normalized)) return false

  return (
    /^(?:para|com|no|na|nos|nas|ao|aos|a|à|em|focused on|specialized in|oriented to|dedicated to|responsible for)\b/i.test(
      normalized,
    ) || isLikelyNounPhraseContinuation(normalized)
  )
}

function isMetricComplement(value: string): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized) return false

  return (
    HIGHLIGHT_METRIC_COMPLEMENT_START_PATTERN.test(normalized)
    && (/\d|[$%]/u.test(normalized) || HIGHLIGHT_ZERO_METRIC_PATTERN.test(normalized))
  )
}

function isLongBroadTail(value: string): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized) return false

  return (
    countHighlightWords(normalized) > HIGHLIGHT_MAX_CONTINUATION_WORDS
    || normalized.length > HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS
  )
}

function endsWithWeakClosure(fragment: string): boolean {
  const trimmed = trimTrailingSentencePunctuation(fragment)
  if (!trimmed) return true

  if (HIGHLIGHT_WEAK_ENDING_PATTERN.test(trimmed)) return true
  if (/[(/[-–—]\s*$/u.test(trimmed)) return true
  if (/\b\d+\s*$/u.test(trimmed) && !/%\s*$/u.test(trimmed)) return true

  const parenDelta = countBalancedPairDelta(trimmed, '(', ')')
  const bracketDelta = countBalancedPairDelta(trimmed, '[', ']')
  if (parenDelta > 0 || bracketDelta > 0) return true

  return false
}

function computeSemanticClosureBonus(fragment: string): number {
  const trimmed = trimTrailingSentencePunctuation(fragment)
  if (!trimmed) return 0

  let score = 0

  if (HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed)) score += 4
  if (/[$\d%]/u.test(trimmed)) score += 3
  if (/\b(?:by|with|for|em|com|para)\b/i.test(trimmed) && /\d|[$%]/u.test(trimmed)) score += 3
  if (/\b(?:zero|downtime|clients|savings|latency|throughput|processing|cost|costs|tempo|clientes|economia|redução|reducao)\b/i.test(trimmed)) {
    score += 2
  }
  if (
    HIGHLIGHT_GERUND_CONTINUATION_PATTERN.test(normalizeLeadingContinuationText(trimmed))
    || HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN.test(normalizeLeadingContinuationText(trimmed))
  ) {
    score += 1
  }
  if (!endsWithWeakClosure(trimmed)) score += 3
  if (countBalancedPairDelta(trimmed, '(', ')') === 0 && countBalancedPairDelta(trimmed, '[', ']') === 0) {
    score += 1
  }

  return score
}

// ---------------------------------------------------------------------------
// Trim / normalize helpers
// ---------------------------------------------------------------------------

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
      || (
        HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(text[nextStart]!)
        && !(
          (text[nextStart] === '(' && text.slice(nextStart + 1, nextEnd).includes(')'))
          || (text[nextStart] === '[' && text.slice(nextStart + 1, nextEnd).includes(']'))
        )
      )
    )
  ) {
    nextStart += 1
  }

  while (
    nextEnd > nextStart
    && (
      isWhitespaceLike(text[nextEnd - 1])
      || (
        HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(text[nextEnd - 1]!)
        && !(
          (text[nextEnd - 1] === ')' && text.slice(nextStart, nextEnd - 1).includes('('))
          || (text[nextEnd - 1] === ']' && text.slice(nextStart, nextEnd - 1).includes('['))
        )
      )
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
    while (start > 0 && isWordLikeChar(text[start - 1])) {
      start -= 1
    }
  }

  while (
    end + 1 < text.length
    && HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[end]!)
    && isWordLikeChar(text[end - 1])
    && isWordLikeChar(text[end + 1])
  ) {
    end += 1
    while (end < text.length && isWordLikeChar(text[end])) {
      end += 1
    }
  }

  if (end < text.length && text[end] === '%' && isWordLikeChar(text[end - 1])) {
    end += 1
  }

  return { start, end, reason: range.reason }
}

// ---------------------------------------------------------------------------
// Candidate end collection
// ---------------------------------------------------------------------------

function readShortContinuationEnd(text: string, start: number): number | null {
  let cursor = start

  while (
    cursor < text.length
    && cursor - start <= HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS
  ) {
    const char = text[cursor]

    if (
      char === HIGHLIGHT_STACK_SEPARATOR_CHAR
      || (/[.!?]/u.test(char) && !isInlineDecimalOrAbbreviationBoundary(text, cursor))
    ) {
      break
    }

    if (char === '(' || char === '[') {
      const closeChar = char === '(' ? ')' : ']'
      const remainingWindow = text.slice(
        cursor + 1,
        cursor + 1 + HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS,
      )
      if (!remainingWindow.includes(closeChar)) {
        break
      }
      cursor += 1
      continue
    }

    if (
      cursor > start
      && (char === ',' || char === ':' || char === ';')
    ) {
      break
    }

    cursor += 1
  }

  while (cursor > start && isWhitespaceLike(text[cursor - 1])) {
    cursor -= 1
  }

  if (cursor <= start) return null

  return cursor
}

function readSentenceBoundaryEnd(text: string, start: number): number | null {
  let cursor = start
  const hardLimit = Math.min(text.length, start + HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS)

  while (cursor < hardLimit) {
    const char = text[cursor]

    if (
      char === HIGHLIGHT_STACK_SEPARATOR_CHAR
      || (/[.!?]/u.test(char) && !isInlineDecimalOrAbbreviationBoundary(text, cursor))
    ) {
      break
    }

    cursor += 1
  }

  while (cursor > start && isWhitespaceLike(text[cursor - 1])) {
    cursor -= 1
  }

  if (cursor <= start) return null
  return cursor
}

function collectCandidateContinuationEnds(
  text: string,
  start: number,
): number[] {
  const candidateEnds = new Set<number>()

  const shortEnd = readShortContinuationEnd(text, start)
  if (shortEnd !== null) {
    candidateEnds.add(shortEnd)
  }

  const sentenceEnd = readSentenceBoundaryEnd(text, start)
  if (sentenceEnd !== null) {
    candidateEnds.add(sentenceEnd)
  }

  const searchWindowEnd = Math.min(text.length, start + HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS)

  for (let index = start; index < searchWindowEnd; index += 1) {
    const char = text[index]

    if (
      char === ','
      || char === ';'
      || char === ':'
      || char === ')'
      || char === ']'
    ) {
      let candidateEnd = index
      while (candidateEnd > start && isWhitespaceLike(text[candidateEnd - 1])) {
        candidateEnd -= 1
      }
      if (candidateEnd > start) {
        candidateEnds.add(candidateEnd)
      }
    }

    if (
      /[.!?]/u.test(char)
      && !isInlineDecimalOrAbbreviationBoundary(text, index)
    ) {
      let candidateEnd = index
      while (candidateEnd > start && isWhitespaceLike(text[candidateEnd - 1])) {
        candidateEnd -= 1
      }
      if (candidateEnd > start) {
        candidateEnds.add(candidateEnd)
      }
      break
    }
  }

  return [...candidateEnds]
    .filter((end) => end > start)
    .sort((left, right) => left - right)
    .slice(0, HIGHLIGHT_MAX_CANDIDATE_ENDS)
}

// ---------------------------------------------------------------------------
// Candidate scoring
// ---------------------------------------------------------------------------

function isCandidateEditoriallyPlausible(
  text: string,
  baseRange: CvHighlightRange,
  candidateEnd: number,
): boolean {
  if (candidateEnd <= baseRange.end) return false

  const addition = text.slice(baseRange.end, candidateEnd).trim()
  const normalizedAddition = normalizeLeadingContinuationText(addition)
  const currentFragment = text.slice(baseRange.start, baseRange.end).trim()

  if (!addition || !hasMeaningfulHighlightContent(addition)) return false
  if (isLongBroadTail(addition)) return false
  if (HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(normalizedAddition || addition)) return false

  const attachedContinuation = startsWithAttachedContinuation(normalizedAddition)
  const nounPhraseClosure =
    isLikelyNounPhraseContinuation(normalizedAddition)
    && (/[$\d%]/u.test(currentFragment) || hasSemanticClosureLead(currentFragment))

  const prepositionalClosure =
    isLikelyTightPrepositionalClosure(normalizedAddition)
    && hasSemanticClosureLead(currentFragment)

  const semanticComplementClosure =
    isLikelyTightSemanticComplementClosure(normalizedAddition)
    && hasSemanticClosureLead(currentFragment)

  const metricPrepositionClosure =
    isMetricComplement(normalizedAddition)
    && hasSemanticClosureLead(currentFragment)

  return (
    attachedContinuation
    || nounPhraseClosure
    || prepositionalClosure
    || semanticComplementClosure
    || metricPrepositionClosure
  )
}

function scoreHighlightCandidate(
  text: string,
  candidate: CvHighlightRange,
  baseRange: CvHighlightRange,
): number {
  const fragment = text.slice(candidate.start, candidate.end).trim()
  const addition = text.slice(baseRange.end, candidate.end).trim()

  let score = 0

  score += computeSemanticClosureBonus(fragment) * 10

  if (isMetricComplement(addition)) score += 30
  if (startsWithAttachedContinuation(addition)) score += 16
  if (isLikelyTightPrepositionalClosure(addition)) score += 10
  if (isLikelyTightSemanticComplementClosure(addition)) score += 10

  if (endsWithWeakClosure(fragment)) score -= 35

  const extraLength = Math.max(0, fragment.length - text.slice(baseRange.start, baseRange.end).trim().length)
  score -= Math.floor(extraLength / 8)

  const extraWords = Math.max(
    0,
    countHighlightWords(fragment) - countHighlightWords(text.slice(baseRange.start, baseRange.end)),
  )
  score -= extraWords > 8 ? (extraWords - 8) * 4 : 0

  if (fragment.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) score -= 40

  return score
}

function selectBestCandidateRange(
  text: string,
  baseRange: CvHighlightRange,
): CvHighlightRange {
  const continuationStart = (() => {
    let cursor = baseRange.end
    while (cursor < text.length && isWhitespaceLike(text[cursor])) {
      cursor += 1
    }
    return cursor
  })()

  if (continuationStart >= text.length) {
    return baseRange
  }

  const candidateEnds = collectCandidateContinuationEnds(text, continuationStart)

  let bestRange = baseRange
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidateEnd of candidateEnds) {
    if (!isCandidateEditoriallyPlausible(text, baseRange, candidateEnd)) {
      continue
    }

    const candidateRange: CvHighlightRange = {
      start: baseRange.start,
      end: candidateEnd,
      reason: baseRange.reason,
    }

    const score = scoreHighlightCandidate(text, candidateRange, baseRange)

    const shouldReplace =
      score > bestScore
      || (
        score === bestScore
        && (
          candidateRange.end > bestRange.end
          || (
            candidateRange.end === bestRange.end
            && candidateRange.start < bestRange.start
          )
        )
      )

    if (shouldReplace) {
      bestRange = candidateRange
      bestScore = score
    }
  }

  return bestRange
}

// ---------------------------------------------------------------------------
// Pipe / stack helpers
// ---------------------------------------------------------------------------

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

  let bestBounds: { start: number; end: number } | null = null
  let cursor = range.start

  while (cursor < range.end) {
    while (
      cursor < range.end
      && (text[cursor] === HIGHLIGHT_STACK_SEPARATOR_CHAR || isWhitespaceLike(text[cursor]))
    ) {
      cursor += 1
    }

    if (cursor >= range.end) break

    let segmentEnd = cursor
    while (segmentEnd < range.end && text[segmentEnd] !== HIGHLIGHT_STACK_SEPARATOR_CHAR) {
      segmentEnd += 1
    }

    const trimmedBounds = trimHighlightEdgeNoiseBounds(text, cursor, segmentEnd)
    if (
      trimmedBounds
      && (!bestBounds || trimmedBounds.end - trimmedBounds.start > bestBounds.end - bestBounds.start)
    ) {
      bestBounds = trimmedBounds
    }

    cursor = segmentEnd + 1
  }

  if (!bestBounds) return null

  const bestFragment = text.slice(bestBounds.start, bestBounds.end).trim()
  if (!bestFragment || isWeakPipeSegment(text, bestFragment)) return null

  return { start: bestBounds.start, end: bestBounds.end, reason: range.reason }
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

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

  return (
    countHighlightWords(mergedText) <= HIGHLIGHT_MAX_CONTINUATION_WORDS + 3
    && mergedText.length <= HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS * 2
  )
}

// ---------------------------------------------------------------------------
// Boundary normalization
// ---------------------------------------------------------------------------

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

  const bestCandidateRange = selectBestCandidateRange(text, normalizedRange)
  normalizedRange = normalizeRangeToWordBoundaries(text, bestCandidateRange)
  normalizedRange = expandRangeLeftForCurrencyPrefix(text, normalizedRange)
  normalizedRange = expandRangeAcrossInlineCompositeTerms(text, normalizedRange)

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

// ---------------------------------------------------------------------------
// Segmentation normalization
// ---------------------------------------------------------------------------

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
      previousRange.end = Math.max(previousRange.end, range.end)
      return acc
    }

    if (shouldMergeAcrossIgnorableGap(text, previousRange, range)) {
      previousRange.end = range.end
      return acc
    }

    acc.push(range)
    return acc
  }, [])
}

// ---------------------------------------------------------------------------
// Editorial acceptance
// ---------------------------------------------------------------------------

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

  if (section === 'summary') {
    return coverage <= SUMMARY_MAX_HIGHLIGHT_COVERAGE
  }

  const fragment = text.slice(range.start, range.end)

  const semanticOverride =
    computeSemanticClosureBonus(fragment) >= 10
    && coverage <= Math.max(adaptiveCoverageThreshold(textLength), 0.82)

  if (semanticOverride) return true

  const ceiling = adaptiveCoverageThreshold(textLength)
  if (coverage <= ceiling) return true

  return (
    range.start === 0
    && range.end === text.length
    && isCompactMeasurableExperienceHighlight(text)
  )
}

// ---------------------------------------------------------------------------
// Local fallback
// ---------------------------------------------------------------------------

function buildFallbackHighlightRange(
  text: string,
): CvHighlightRange | null {
  const verbMatch = HIGHLIGHT_FALLBACK_ACTION_VERB_PATTERN.exec(text)
  if (!verbMatch) return null

  const metricMatch = /\d/.exec(text)
  if (!metricMatch) return null

  const spanStart = verbMatch.index
  const seedRange: CvHighlightRange = {
    start: spanStart,
    end: Math.max(metricMatch.index + 1, spanStart + 1),
    reason: 'metric_impact',
  }

  return normalizeHighlightSpanBoundaries(text, seedRange)
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
    if (!isCompactMeasurableExperienceHighlight(item.text)) continue

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

// ---------------------------------------------------------------------------
// Main validation + resolution entry point
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Accessors / renderers
// ---------------------------------------------------------------------------

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

    segments.push({ text: text.slice(range.start, range.end), highlighted: true, reason: range.reason })
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
