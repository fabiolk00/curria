import { z } from 'zod'

import type { CVState, ExperienceEntry } from '@/types/cv'

export const CV_HIGHLIGHT_ARTIFACT_VERSION = 2

const SUMMARY_MAX_HIGHLIGHT_COVERAGE = 0.4
const EXPERIENCE_MAX_HIGHLIGHT_COVERAGE = 0.55
const COMPACT_EXPERIENCE_HIGHLIGHT_MAX_LENGTH = 90

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

export function normalizeHighlightRangesForSegmentation(
  textLength: number,
  ranges: CvHighlightRange[],
): CvHighlightRange[] {
  const sortedRanges = ranges
    .map((range) => clampHighlightRange(textLength, range))
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

  return range.start === 0
    && range.end === text.length
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
  const rangesByItemId = new Map<string, CvHighlightRange[]>()
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

    const normalizedRanges = normalizeHighlightRangesForSegmentation(item.text.length, candidateRanges)
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
  const normalizedRanges = normalizeHighlightRangesForSegmentation(text.length, ranges)
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

export function normalizeCvHighlightState(value: unknown): CvHighlightState | undefined {
  const result = cvHighlightStateSchema.safeParse(value)
  return result.success ? result.data : undefined
}
