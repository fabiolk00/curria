import { z } from 'zod'

import type { CVState, ExperienceEntry } from '@/types/cv'

export const CV_HIGHLIGHT_ARTIFACT_VERSION = 2

const SUMMARY_MAX_HIGHLIGHT_COVERAGE = 0.4
const EXPERIENCE_MAX_HIGHLIGHT_COVERAGE = 0.55
const COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH = 90
const HIGHLIGHT_STACK_SEPARATOR_CHAR = '|'
const HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS = 72
const HIGHLIGHT_MAX_CONTINUATION_WORDS = 10

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

const HIGHLIGHT_STRONG_CLAUSE_START_PATTERN = /^(?:and|but|while|however|whereas|mas|por(?:e|é)m|enquanto|because|porque)\b/i
const HIGHLIGHT_VERB_HINT_PATTERN = /\b(?:led|built|created|designed|developed|implemented|managed|reduced|increased|improved|optimized|automated|scaled|delivered|owned|migrated|supported|analyzed|organized|reinforced|maintained|provided|served|coordinated|atendi|atuei|organizei|reforcei|mantive|prestei|coordenei|garanti|contribui|suportei|aumentei|reduzi|melhorei|otimizei|automatizei|liderei|criei|desenvolvi|implementei|gerenciei|entreguei|migrei|apoiei|analisei)\b/i
const HIGHLIGHT_GERUND_CONTINUATION_PATTERN = /^(?:contributing|reinforcing|ensuring|supporting|maintaining|reducing|increasing|driving|improving|enabling|closing|strengthening|contribuindo|reforcando|reforçando|garantindo|apoiando|mantendo|reduzindo|aumentando|impulsionando|melhorando|viabilizando|fortalecendo)\b/i
const HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN = /^(?:and|e)\s+(?:with|for|in|on|during|com|para|em|no|na|nos|nas|ao|aos|a|à|support|supporting|apoio|apoiando|atendimento|rotinas|processo|processos|disponibilidade|estabilidade|satisfacao|satisfação)\b/i
const HIGHLIGHT_DIRECT_CLOSURE_PREPOSITION_PATTERN = /^(?:during|in|on|to|com|para|em|no|na|nos|nas|durante|ao|aos|a|à|as|às)\b/i
const HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN = /\b(?:focused|specialized|oriented|dedicated|responsible|experienced|especializado|focado|orientado|dedicado|responsavel|responsável|experiente)\b/i

const HIGHLIGHT_WEAK_LEAD_VERB_PATTERN = /^(?:realizei|desenvolvi|auxiliei|trabalhei|atuei|fiz|fui|participei|otimizei|built|developed|worked|acted|created|implemented)\b/i
const HIGHLIGHT_EDITORIAL_REENTRY_PATTERN = /^(?:reducing|reduced|increasing|increased|improving|improved|generating|generated|driving|delivering|delivered|reduzindo|aumentando|melhorando|gerando|conduzindo|mais de \d+|more than \d+|zero downtime|migracao de|migration of)\b/i
const HIGHLIGHT_EDITORIAL_REENTRY_SEARCH_PATTERN = /(?<!\p{L})(?<!\p{N})(?:reducing|reduced|increasing|increased|improving|improved|generating|generated|driving|delivering|delivered|reduzindo|aumentando|melhorando|gerando|conduzindo|mais de \d+|more than \d+|zero downtime|migracao de|migration of)(?!\p{L})(?!\p{N})/iu
const HIGHLIGHT_REENTRY_BOUNDARY_CHARS = new Set([',', ';', ':', '-', '–', '—'])

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

export type CvHighlightDetectionRange = {
  fragment?: string | null
  start?: number | null
  end?: number | null
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
  highlightSource: 'ats_enhancement' | 'job_targeting'
  highlightGeneratedAt: string
  generatedAt: string
}

export type CvHighlightDetectionResult = Array<{
  itemId: string
  ranges: CvHighlightDetectionRange[]
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

const cvHighlightDetectionRangeSchema = z.object({
  fragment: z.string().min(1).optional().nullable(),
  start: z.number().int().optional().nullable(),
  end: z.number().int().optional().nullable(),
  reason: cvHighlightReasonSchema,
}).superRefine((value, context) => {
  const hasFragment = typeof value.fragment === 'string' && value.fragment.trim().length > 0
  const hasStart = typeof value.start === 'number'
  const hasEnd = typeof value.end === 'number'
  const hasNullOffsets = value.start === null && value.end === null

  if (!hasFragment && !(hasStart && hasEnd)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Each detection range needs a fragment or numeric offsets.',
    })
  }

  if (
    !hasNullOffsets
    && (
      hasStart !== hasEnd
      || value.start === null
      || value.end === null
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start and end must be provided together.',
    })
  }
})

const cvHighlightDetectionItemSchema = z.object({
  itemId: z.string().min(1),
  ranges: z.array(cvHighlightDetectionRangeSchema),
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
  highlightSource: z.enum(['ats_enhancement', 'job_targeting']).optional(),
  highlightGeneratedAt: z.string().min(1).optional(),
  generatedAt: z.string().min(1),
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

function parseRawHighlightDetection(
  raw: unknown,
): CvHighlightDetectionResult {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function findExactFragmentMatchOffsets(
  text: string,
  fragment: string,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = []
  let cursor = 0

  while (cursor <= text.length - fragment.length) {
    const start = text.indexOf(fragment, cursor)
    if (start === -1) {
      break
    }

    matches.push({
      start,
      end: start + fragment.length,
    })
    cursor = start + 1
  }

  return matches
}

function findWhitespaceNormalizedFragmentMatchOffsets(
  text: string,
  fragment: string,
): Array<{ start: number; end: number }> {
  const tokens = fragment.trim().split(/\s+/u).filter(Boolean)
  if (tokens.length === 0) {
    return []
  }

  const pattern = new RegExp(tokens.map((token) => escapeRegExp(token)).join('\\s+'), 'gu')
  const normalizedFragment = tokens.join(' ')
  const matches: Array<{ start: number; end: number }> = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    const matchedText = match[0]
    if (matchedText.trim().replace(/\s+/gu, ' ') !== normalizedFragment) {
      continue
    }

    matches.push({
      start: match.index,
      end: match.index + matchedText.length,
    })

    if (matchedText.length === 0) {
      pattern.lastIndex += 1
    }
  }

  return matches
}

function resolveTextAnchoredHighlightRange(
  text: string,
  candidate: CvHighlightDetectionRange,
): CvHighlightRange | null {
  const fragment = candidate.fragment?.trim()

  if (fragment) {
    const exactMatches = findExactFragmentMatchOffsets(text, fragment)
    if (exactMatches.length === 1) {
      return {
        start: exactMatches[0].start,
        end: exactMatches[0].end,
        reason: candidate.reason,
      }
    }

    const normalizedMatches = findWhitespaceNormalizedFragmentMatchOffsets(text, fragment)
    if (normalizedMatches.length === 1) {
      return {
        start: normalizedMatches[0].start,
        end: normalizedMatches[0].end,
        reason: candidate.reason,
      }
    }
  }

  const fallbackStart = candidate.start
  const fallbackEnd = candidate.end
  if (Number.isInteger(fallbackStart) && Number.isInteger(fallbackEnd)) {
    const resolvedStart = fallbackStart as number
    const resolvedEnd = fallbackEnd as number
    return {
      start: resolvedStart,
      end: resolvedEnd,
      reason: candidate.reason,
    }
  }

  return null
}

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

  return {
    start,
    end,
    reason: range.reason,
  }
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

function isInlineDecimalOrAbbreviationBoundary(
  text: string,
  index: number,
): boolean {
  return text[index] === '.'
    && isWordLikeChar(text[index - 1])
    && isWordLikeChar(text[index + 1])
}

function startsWithAttachedContinuation(value: string): boolean {
  const trimmed = normalizeLeadingContinuationText(value)
  if (!trimmed) {
    return false
  }

  return HIGHLIGHT_GERUND_CONTINUATION_PATTERN.test(trimmed)
    || HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN.test(trimmed)
}

function isLikelyNounPhraseContinuation(value: string): boolean {
  const trimmed = normalizeLeadingContinuationText(value)
  if (!trimmed) {
    return false
  }

  return countHighlightWords(trimmed) <= 4
    && !HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed)
    && !HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(trimmed)
}

function normalizeLeadingContinuationText(value: string): string {
  let cursor = 0

  while (
    cursor < value.length
    && (
      isWhitespaceLike(value[cursor])
      || HIGHLIGHT_IGNORABLE_BOUNDARY_CHARS.has(value[cursor]!)
    )
  ) {
    cursor += 1
  }

  return value.slice(cursor).trim()
}

function startsWithWeakLeadVerb(value: string): boolean {
  return HIGHLIGHT_WEAK_LEAD_VERB_PATTERN.test(value.trim())
}

function startsWithPrepositionOrConjunction(value: string): boolean {
  return /^(?:and|or|but|e|ou|mas|para|com|de|do|da|dos|das|em|no|na|nos|nas|ao|aos|a|Ã )\b/i.test(value.trim())
}

function hasActionOrMetricLead(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  return HIGHLIGHT_VERB_HINT_PATTERN.test(trimmed) || /[$\d%]/u.test(trimmed)
}

function hasSemanticClosureLead(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  return hasActionOrMetricLead(trimmed) || HIGHLIGHT_SEMANTIC_DESCRIPTOR_HINT_PATTERN.test(trimmed)
}

function isLikelyTightPrepositionalClosure(value: string): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized || !HIGHLIGHT_DIRECT_CLOSURE_PREPOSITION_PATTERN.test(normalized)) {
    return false
  }

  if (countHighlightWords(normalized) > 5) {
    return false
  }

  const [, ...tailWords] = normalized.split(/\s+/u)
  const tail = tailWords.join(' ')
  if (!tail) {
    return false
  }

  return !/\b(?:with|for|by|via|through|across|toward|towards|between|among|com|para|durante|during|em|no|na|nos|nas)\b/i.test(tail)
}

function isLikelyTightSemanticComplementClosure(
  value: string,
): boolean {
  const normalized = normalizeLeadingContinuationText(value)
  if (!normalized) {
    return false
  }

  if (countHighlightWords(normalized) > 6) {
    return false
  }

  if (HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(normalized)) {
    return false
  }

  if (HIGHLIGHT_VERB_HINT_PATTERN.test(normalized)) {
    return false
  }

  if (/^(?:for|with|by|via|through|across)\b/i.test(normalized)) {
    return false
  }

  return /^(?:para|com|no|na|nos|nas|ao|aos|a|à|em|focused on|specialized in|oriented to|dedicated to|responsible for)\b/i.test(normalized)
    || isLikelyNounPhraseContinuation(normalized)
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

  if (nextEnd <= nextStart) {
    return null
  }

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
      || (
        HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[start]!)
        && isWordLikeChar(text[start + 1])
      )
    )
  ) {
    start -= 1
  }

  while (
    end < text.length
    && isWordLikeChar(text[end])
    && (
      isWordLikeChar(text[end - 1])
      || HIGHLIGHT_INLINE_COMPOSITE_CHARS.has(text[end - 1]!)
    )
  ) {
    end += 1
  }

  return {
    start,
    end,
    reason: range.reason,
  }
}

function expandRangeLeftForCurrencyPrefix(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let start = range.start

  if (
    start > 0
    && text[start - 1] === '$'
    && isWordLikeChar(text[start])
  ) {
    start -= 1
  }

  return {
    start,
    end: range.end,
    reason: range.reason,
  }
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

  if (
    end < text.length
    && text[end] === '%'
    && isWordLikeChar(text[end - 1])
  ) {
    end += 1
  }

  return {
    start,
    end,
    reason: range.reason,
  }
}

function readShortContinuationEnd(
  text: string,
  start: number,
): number | null {
  let cursor = start

  while (
    cursor < text.length
    && cursor - start <= HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS
  ) {
    const char = text[cursor]
    if (
      char === HIGHLIGHT_STACK_SEPARATOR_CHAR
      || (
        /[.!?]/u.test(char)
        && !isInlineDecimalOrAbbreviationBoundary(text, cursor)
      )
    ) {
      break
    }

    if (
      cursor > start
      && (
        char === ','
        || char === ':'
        || char === ';'
        || char === '('
        || char === '['
      )
    ) {
      break
    }

    cursor += 1
  }

  while (cursor > start && isWhitespaceLike(text[cursor - 1])) {
    cursor -= 1
  }

  if (cursor <= start) {
    return null
  }

  return cursor
}

function shouldExpandAcrossBoundary(
  separatorChar: string,
  continuationText: string,
): boolean {
  const trimmed = continuationText.trim()
  const normalized = normalizeLeadingContinuationText(continuationText)
  const attachedContinuation = startsWithAttachedContinuation(normalized)
  if (!trimmed || !hasMeaningfulHighlightContent(trimmed)) {
    return false
  }

  if (trimmed.length > HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS) {
    return false
  }

  if (
    countHighlightWords(normalized || trimmed)
    > (attachedContinuation ? HIGHLIGHT_MAX_CONTINUATION_WORDS + 4 : HIGHLIGHT_MAX_CONTINUATION_WORDS)
  ) {
    return false
  }

  if (HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(normalized || trimmed)) {
    return false
  }

  if (separatorChar === ':' || separatorChar === ';') {
    return /^[$\d\p{Lu}]/u.test(normalized || trimmed)
  }

  if (separatorChar === ',') {
    return attachedContinuation
      || isLikelyNounPhraseContinuation(normalized)
      || /^[$\d]/u.test(normalized || trimmed)
  }

  return true
}

function shouldPreferPhraseClosure(
  text: string,
  range: CvHighlightRange,
  candidateEnd: number,
): boolean {
  if (candidateEnd <= range.end) {
    return false
  }

  const addition = text.slice(range.end, candidateEnd).trim()
  const normalizedAddition = normalizeLeadingContinuationText(addition)
  const currentFragment = text.slice(range.start, range.end).trim()
  if (!addition || !hasMeaningfulHighlightContent(addition)) {
    return false
  }

  if (addition.length > HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS) {
    return false
  }

  if (
    countHighlightWords(normalizedAddition || addition)
    > (startsWithAttachedContinuation(normalizedAddition) ? HIGHLIGHT_MAX_CONTINUATION_WORDS + 2 : HIGHLIGHT_MAX_CONTINUATION_WORDS)
  ) {
    return false
  }

  if (HIGHLIGHT_STRONG_CLAUSE_START_PATTERN.test(normalizedAddition || addition)) {
    return false
  }

  if (/^(?:for|with|by|via|through|across)\b/i.test(normalizedAddition)) {
    return false
  }

  const attachedContinuation = HIGHLIGHT_GERUND_CONTINUATION_PATTERN.test(normalizedAddition)
    || HIGHLIGHT_COORDINATED_CONTINUATION_PATTERN.test(normalizedAddition)

  const nounPhraseClosure = isLikelyNounPhraseContinuation(normalizedAddition)
    && (
      /[$\d%]/u.test(currentFragment)
      || hasSemanticClosureLead(currentFragment)
    )

  const prepositionalClosure = isLikelyTightPrepositionalClosure(normalizedAddition)
    && hasSemanticClosureLead(currentFragment)

  const semanticComplementClosure = isLikelyTightSemanticComplementClosure(normalizedAddition)
    && hasSemanticClosureLead(currentFragment)

  if (!attachedContinuation && !nounPhraseClosure && !prepositionalClosure && !semanticComplementClosure) {
    return false
  }

  const mergedText = text.slice(range.start, candidateEnd).trim()
  if (mergedText.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    return false
  }

  return mergedText.length <= HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS * 2
    && countHighlightWords(mergedText) <= HIGHLIGHT_MAX_CONTINUATION_WORDS + 5
}

function expandRangeRightAcrossSeparator(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let separatorIndex = range.end
  while (separatorIndex < text.length && isWhitespaceLike(text[separatorIndex])) {
    separatorIndex += 1
  }

  const separatorChar = text[separatorIndex]
  if (!separatorChar || !HIGHLIGHT_BRIDGEABLE_BOUNDARY_CHARS.has(separatorChar)) {
    return range
  }

  let continuationStart = separatorIndex + 1
  while (continuationStart < text.length && isWhitespaceLike(text[continuationStart])) {
    continuationStart += 1
  }

  const continuationEnd = readShortContinuationEnd(text, continuationStart)
  if (continuationEnd === null) {
    return range
  }

  const continuationText = text.slice(continuationStart, continuationEnd)
  if (!shouldExpandAcrossBoundary(separatorChar, continuationText)) {
    return range
  }

  return {
    start: range.start,
    end: continuationEnd,
    reason: range.reason,
  }
}

function expandRangeRightForPhraseClosure(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange {
  let continuationStart = range.end
  while (continuationStart < text.length && isWhitespaceLike(text[continuationStart])) {
    continuationStart += 1
  }

  if (continuationStart >= text.length) {
    return range
  }

  const continuationEnd = readShortContinuationEnd(text, continuationStart)
  if (continuationEnd === null) {
    return range
  }

  if (!shouldPreferPhraseClosure(text, range, continuationEnd)) {
    return range
  }

  return {
    start: range.start,
    end: continuationEnd,
    reason: range.reason,
  }
}

function isLikelyPipeStackText(text: string): boolean {
  const pipeCount = text.split(HIGHLIGHT_STACK_SEPARATOR_CHAR).length - 1
  if (pipeCount < 2) {
    return false
  }

  return !HIGHLIGHT_VERB_HINT_PATTERN.test(text)
}

function isWeakPipeSegment(
  itemText: string,
  fragment: string,
): boolean {
  if (!isLikelyPipeStackText(itemText)) {
    return false
  }

  if (/\d|\$|%/u.test(fragment) || HIGHLIGHT_VERB_HINT_PATTERN.test(fragment)) {
    return false
  }

  return countHighlightWords(fragment) <= 2
}

function constrainRangeToPipeSegment(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const fragment = text.slice(range.start, range.end)
  if (!fragment.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    if (isWeakPipeSegment(text, fragment.trim())) {
      return null
    }

    return range
  }

  let bestBounds: { start: number; end: number } | null = null
  let cursor = range.start

  while (cursor < range.end) {
    while (
      cursor < range.end
      && (
        text[cursor] === HIGHLIGHT_STACK_SEPARATOR_CHAR
        || isWhitespaceLike(text[cursor])
      )
    ) {
      cursor += 1
    }

    if (cursor >= range.end) {
      break
    }

    let segmentEnd = cursor
    while (
      segmentEnd < range.end
      && text[segmentEnd] !== HIGHLIGHT_STACK_SEPARATOR_CHAR
    ) {
      segmentEnd += 1
    }

    const trimmedBounds = trimHighlightEdgeNoiseBounds(text, cursor, segmentEnd)
    if (trimmedBounds) {
      if (
        !bestBounds
        || trimmedBounds.end - trimmedBounds.start > bestBounds.end - bestBounds.start
      ) {
        bestBounds = trimmedBounds
      }
    }

    cursor = segmentEnd + 1
  }

  if (!bestBounds) {
    return null
  }

  const bestFragment = text.slice(bestBounds.start, bestBounds.end).trim()
  if (!bestFragment || isWeakPipeSegment(text, bestFragment)) {
    return null
  }

  return {
    start: bestBounds.start,
    end: bestBounds.end,
    reason: range.reason,
  }
}

function shouldMergeAcrossIgnorableGap(
  text: string,
  previousRange: CvHighlightRange,
  nextRange: CvHighlightRange,
): boolean {
  if (previousRange.reason !== nextRange.reason) {
    return false
  }

  const gapText = text.slice(previousRange.end, nextRange.start)
  if (!gapText) {
    return false
  }

  if ([...gapText].some((char) => (
    !isWhitespaceLike(char)
    && !HIGHLIGHT_MERGEABLE_GAP_CHARS.has(char)
  ))) {
    return false
  }

  const mergedText = text.slice(previousRange.start, nextRange.end).trim()
  if (mergedText.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    return false
  }

  return countHighlightWords(mergedText) <= HIGHLIGHT_MAX_CONTINUATION_WORDS + 3
    && mergedText.length <= HIGHLIGHT_MAX_BOUNDARY_REFINEMENT_CHARS * 2
}

function hasMetricWithContext(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  return /\bby\s+\d+(?:[.,]\d+)?%/iu.test(trimmed)
    || /\bem\s+ate\s+\d+(?:[.,]\d+)?%/iu.test(trimmed)
    || /\d+(?:[.,]\d+)?%\s+\S+/u.test(trimmed)
    || /\b(?:mais de|more than)\s+\d+\s+\S+/i.test(trimmed)
}

function endsWithDanglingMetric(value: string): boolean {
  return /\d+(?:[.,]\d+)?%?\.?$/u.test(value.trim())
}

function buildCompactClosureCandidate(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  let continuationStart = range.end
  while (continuationStart < text.length && isWhitespaceLike(text[continuationStart])) {
    continuationStart += 1
  }

  if (continuationStart >= text.length) {
    return null
  }

  const continuationText = text.slice(continuationStart)
  const compactClosureMatch = continuationText.match(
    /^(?:by\s+\d+(?:[.,]\d+)?%|with\s+zero downtime|for\s+\d+\s+\p{L}+(?:\s+\p{L}+){0,1})/iu,
  )
  if (!compactClosureMatch) {
    return null
  }

  return {
    start: range.start,
    end: continuationStart + compactClosureMatch[0].length,
    reason: range.reason,
  }
}

export function buildSeparatorTrimLeftCandidate(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const fragment = text.slice(range.start, range.end)
  if (!startsWithWeakLeadVerb(fragment)) {
    return null
  }

  for (let cursor = range.start + 1; cursor < range.end; cursor += 1) {
    if (isWordLikeChar(text[cursor - 1]) || !isWordLikeChar(text[cursor])) {
      continue
    }

    let boundaryCursor = cursor - 1
    while (boundaryCursor >= range.start && isWhitespaceLike(text[boundaryCursor])) {
      boundaryCursor -= 1
    }

    if (boundaryCursor < range.start || !HIGHLIGHT_REENTRY_BOUNDARY_CHARS.has(text[boundaryCursor]!)) {
      continue
    }

    const candidateText = text.slice(cursor, range.end).trim()
    if (
      candidateText.length < 15
      || startsWithPrepositionOrConjunction(candidateText)
      || !HIGHLIGHT_EDITORIAL_REENTRY_PATTERN.test(candidateText)
    ) {
      continue
    }

    const wordsBeforeReentry = countHighlightWords(text.slice(range.start, cursor))
    if (wordsBeforeReentry <= 2) {
      return null
    }

    return {
      start: cursor,
      end: range.end,
      reason: range.reason,
    }
  }

  return null
}

export function buildPatternTrimLeftCandidate(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const fragment = text.slice(range.start, range.end)
  if (!startsWithWeakLeadVerb(fragment)) {
    return null
  }

  const searchOffset = fragment.slice(1).search(HIGHLIGHT_EDITORIAL_REENTRY_SEARCH_PATTERN)
  if (searchOffset === -1) {
    return null
  }

  const candidateStart = range.start + 1 + searchOffset
  if (candidateStart <= range.start || candidateStart >= range.end) {
    return null
  }

  // Guard: belt-and-suspenders for Unicode boundary. The pattern already uses
  // Unicode-aware lookbehind/lookahead, but this check catches any edge case where
  // the regex engine and the isWordLikeChar definition diverge.
  const prevChar = candidateStart > 0 ? text[candidateStart - 1] : undefined
  if (prevChar !== undefined && isWordLikeChar(prevChar)) {
    return null
  }

  const wordsBeforeReentry = countHighlightWords(text.slice(range.start, candidateStart))
  if (wordsBeforeReentry <= 2) {
    return null
  }

  const candidateText = text.slice(candidateStart, range.end).trim()
  if (
    candidateText.length >= fragment.trim().length
    || !hasMeaningfulHighlightContent(candidateText)
  ) {
    return null
  }

  return {
    start: candidateStart,
    end: range.end,
    reason: range.reason,
  }
}

export function buildTrimLeftCandidate(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const fragment = text.slice(range.start, range.end)
  if (!startsWithWeakLeadVerb(fragment)) {
    return null
  }

  const separatorCandidate = buildSeparatorTrimLeftCandidate(text, range)
  if (separatorCandidate) {
    return separatorCandidate
  }

  return buildPatternTrimLeftCandidate(text, range)
}

function refineCandidateRange(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  let nextRange = normalizeRangeToWordBoundaries(text, range)
  nextRange = expandRangeRightForPhraseClosure(text, nextRange)
  nextRange = normalizeRangeToWordBoundaries(text, nextRange)

  const trimmedBounds = trimHighlightEdgeNoiseBounds(text, nextRange.start, nextRange.end)
  if (!trimmedBounds) {
    return null
  }

  return {
    start: trimmedBounds.start,
    end: trimmedBounds.end,
    reason: nextRange.reason,
  }
}

function normalizeCandidateBoundsOnly(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  const nextRange = normalizeRangeToWordBoundaries(text, range)
  const trimmedBounds = trimHighlightEdgeNoiseBounds(text, nextRange.start, nextRange.end)
  if (!trimmedBounds) {
    return null
  }

  return {
    start: trimmedBounds.start,
    end: trimmedBounds.end,
    reason: nextRange.reason,
  }
}

export function scoreHighlightCandidatePromotion(
  text: string,
  currentRange: CvHighlightRange,
  candidateRange: CvHighlightRange,
): number {
  const currentText = text.slice(currentRange.start, currentRange.end).trim()
  const candidateText = text.slice(candidateRange.start, candidateRange.end).trim()
  if (!candidateText || candidateText === currentText) {
    return 0
  }

  let score = 0

  if (startsWithWeakLeadVerb(currentText) && !startsWithWeakLeadVerb(candidateText)) {
    score += 2
  }

  if (!hasMetricWithContext(currentText) && hasMetricWithContext(candidateText)) {
    score += 3
  }

  if (endsWithDanglingMetric(currentText) && !endsWithDanglingMetric(candidateText)) {
    score += 3
  }

  if (candidateText.length < currentText.length) {
    score += 1
  }

  if (isEditoriallyAcceptableHighlightRange(text, candidateRange, 'experience')) {
    score += 1
  }

  return score
}

export function shouldPromoteHighlightCandidate(
  text: string,
  currentRange: CvHighlightRange,
  candidateRange: CvHighlightRange,
): boolean {
  return scoreHighlightCandidatePromotion(text, currentRange, candidateRange) >= 3
}

function choosePreferredHighlightCandidate(
  text: string,
  baseRange: CvHighlightRange,
): CvHighlightRange {
  let preferredRange = baseRange

  const compactClosureCandidate = buildCompactClosureCandidate(text, baseRange)
  if (compactClosureCandidate) {
    const refinedClosureCandidate = normalizeCandidateBoundsOnly(text, compactClosureCandidate)
    if (
      refinedClosureCandidate
      && !hasMetricWithContext(text.slice(preferredRange.start, preferredRange.end))
      && (
        hasMetricWithContext(text.slice(refinedClosureCandidate.start, refinedClosureCandidate.end))
        || text.slice(refinedClosureCandidate.start, refinedClosureCandidate.end).includes('zero downtime')
        || /\bfor\s+\d+\b/i.test(text.slice(refinedClosureCandidate.start, refinedClosureCandidate.end))
      )
    ) {
      preferredRange = refinedClosureCandidate
    }
  }

  const trimLeftCandidate = buildTrimLeftCandidate(text, baseRange)
  if (trimLeftCandidate) {
    const refinedTrimCandidate = refineCandidateRange(text, trimLeftCandidate)
    if (refinedTrimCandidate && shouldPromoteHighlightCandidate(text, preferredRange, refinedTrimCandidate)) {
      preferredRange = refinedTrimCandidate
    }
  }

  return preferredRange
}

export function normalizeHighlightSpanBoundaries(
  text: string,
  range: CvHighlightRange,
): CvHighlightRange | null {
  let normalizedRange = clampHighlightRange(text.length, range)
  if (!normalizedRange) {
    return null
  }

  const trimmedInitialBounds = trimHighlightEdgeNoiseBounds(
    text,
    normalizedRange.start,
    normalizedRange.end,
  )
  if (!trimmedInitialBounds) {
    return null
  }

  normalizedRange = {
    start: trimmedInitialBounds.start,
    end: trimmedInitialBounds.end,
    reason: range.reason,
  }

  normalizedRange = normalizeRangeToWordBoundaries(text, normalizedRange)
  normalizedRange = expandRangeLeftForCurrencyPrefix(text, normalizedRange)
  normalizedRange = expandRangeAcrossInlineCompositeTerms(text, normalizedRange)
  normalizedRange = expandRangeRightAcrossSeparator(text, normalizedRange)
  normalizedRange = expandRangeRightForPhraseClosure(text, normalizedRange)
  normalizedRange = normalizeRangeToWordBoundaries(text, normalizedRange)
  normalizedRange = expandRangeLeftForCurrencyPrefix(text, normalizedRange)
  normalizedRange = expandRangeAcrossInlineCompositeTerms(text, normalizedRange)
  normalizedRange = choosePreferredHighlightCandidate(text, normalizedRange)

  if (text.includes(HIGHLIGHT_STACK_SEPARATOR_CHAR)) {
    const constrainedRange = constrainRangeToPipeSegment(text, normalizedRange)
    if (!constrainedRange) {
      return null
    }

    normalizedRange = constrainedRange
  }

  const trimmedFinalBounds = trimHighlightEdgeNoiseBounds(
    text,
    normalizedRange.start,
    normalizedRange.end,
  )
  if (!trimmedFinalBounds) {
    return null
  }

  const finalRange = {
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

function isCompactMeasurableExperienceHighlight(text: string): boolean {
  if (text.trim().length > COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH) {
    return false
  }

  return /\d/.test(text) && /\b(reduced|increased|improved|grew|cut|saved|boosted|generated|delivered|optimized|accelerated|elevated|expanded|aumentei|reduzi|elevei|melhorei|otimizei|ampliei|gerei|entreguei|acelerei|expandi)\b/i.test(text)
}

function matchesWholeBulletIntent(
  text: string,
  range: CvHighlightRange,
): boolean {
  const trimmedBounds = trimHighlightEdgeNoiseBounds(text, 0, text.length)
  if (!trimmedBounds) {
    return false
  }

  return range.start === trimmedBounds.start && range.end === trimmedBounds.end
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

  if (coverage <= EXPERIENCE_MAX_HIGHLIGHT_COVERAGE) {
    return true
  }

  return matchesWholeBulletIntent(text, range)
    && isCompactMeasurableExperienceHighlight(text)
}

export function validateAndResolveHighlights(
  items: CvHighlightInputItem[],
  raw: unknown,
): CvResolvedHighlight[] {
  if (items.length === 0) {
    return []
  }

  const itemMap = new Map(items.map((item) => [item.itemId, item]))
  const detectionItems = parseRawHighlightDetection(raw)
  const rangesByItemId = new Map<string, CvHighlightDetectionRange[]>()
  const resolved: CvResolvedHighlight[] = []

  detectionItems.forEach((candidate) => {
    if (!itemMap.has(candidate.itemId) || !Array.isArray(candidate.ranges)) {
      return
    }

    const existingRanges = rangesByItemId.get(candidate.itemId) ?? []
    existingRanges.push(...candidate.ranges)
    rangesByItemId.set(candidate.itemId, existingRanges)
  })

  rangesByItemId.forEach((candidateRanges, itemId) => {
    const item = itemMap.get(itemId)
    if (!item) {
      return
    }

    const resolvedCandidateRanges = candidateRanges
      .map((candidateRange) => resolveTextAnchoredHighlightRange(item.text, candidateRange))
      .filter((range): range is CvHighlightRange => range !== null)

    const normalizedRanges = normalizeHighlightRangesForSegmentation(item.text, resolvedCandidateRanges)
    const validRanges = normalizedRanges.reduce<CvHighlightRange[]>((acc, range) => {
      const previousRange = acc[acc.length - 1]

      if (!isSafeNonOverlappingRange(range, item.text, previousRange)) {
        return acc
      }

      if (!isEditoriallyAcceptableHighlightRange(item.text, range, item.section)) {
        return acc
      }

      acc.push({
        start: range.start,
        end: range.end,
        reason: range.reason,
      })

      return acc
    }, [])

    if (validRanges.length === 0) {
      return
    }

    resolved.push({
      itemId,
      section: item.section,
      ranges: validRanges,
    })
  })

  return resolved
}

export function getHighlightRangesForItem(
  resolvedHighlights: CvResolvedHighlight[] | undefined,
  itemId: string,
): CvHighlightRange[] {
  if (!resolvedHighlights) {
    return []
  }

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
      segments.push({
        text: text.slice(cursor, range.start),
        highlighted: false,
      })
    }

    segments.push({
      text: text.slice(range.start, range.end),
      highlighted: true,
      reason: range.reason,
    })
    cursor = range.end
  })

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      highlighted: false,
    })
  }

  return segments
}

function resolveLegacyHighlightSource(params: {
  workflowMode?: unknown
  lastRewriteMode?: unknown
}): CvHighlightState['highlightSource'] {
  const preferredMode = params.lastRewriteMode ?? params.workflowMode
  return preferredMode === 'job_targeting' ? 'job_targeting' : 'ats_enhancement'
}

export function normalizeCvHighlightState(
  value: unknown,
  fallback?: {
    workflowMode?: unknown
    lastRewriteMode?: unknown
  },
): CvHighlightState | undefined {
  const result = cvHighlightStateSchema.safeParse(value)
  if (!result.success) {
    return undefined
  }

  return {
    ...result.data,
    highlightSource: result.data.highlightSource ?? resolveLegacyHighlightSource({
      workflowMode: fallback?.workflowMode,
      lastRewriteMode: fallback?.lastRewriteMode,
    }),
    highlightGeneratedAt: result.data.highlightGeneratedAt ?? result.data.generatedAt,
  }
}
