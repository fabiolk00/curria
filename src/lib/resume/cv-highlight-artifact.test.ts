// Full test gate for this module and its Phase 97 hardening:
//
// npx vitest run \
//   src/lib/agent/tools/detect-cv-highlights.test.ts \
//   src/lib/resume/cv-highlight-artifact.test.ts \
//   src/lib/agent/tools/pipeline.test.ts \
//   src/lib/routes/session-comparison/decision.test.ts \
//   src/components/resume/resume-comparison-view.test.tsx
//
// All five files must be included. Running a subset masks cross-file regressions.

import { describe, expect, it } from 'vitest'

import {
  buildPatternTrimLeftCandidate,
  buildSeparatorTrimLeftCandidate,
  buildTrimLeftCandidate,
  isEditoriallyAcceptableHighlightRange,
  normalizeHighlightSpanBoundaries,
  scoreHighlightCandidatePromotion,
  shouldPromoteHighlightCandidate,
  validateAndResolveHighlights,
  type CvHighlightRange,
  type CvHighlightReason,
} from './cv-highlight-artifact'

function buildRange(
  text: string,
  fragment: string,
  reason: CvHighlightReason,
): CvHighlightRange {
  const start = text.indexOf(fragment)
  if (start === -1) {
    throw new Error(`Fragment not found in text: ${fragment}`)
  }

  return {
    start,
    end: start + fragment.length,
    reason,
  }
}

describe('candidate scoring closure refinement', () => {
  it('prefers the metric closure instead of dying before the percentage', () => {
    const text = 'Reduced processing time by 40% for core batch workloads.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Reduced processing time', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Reduced processing time by 40%')
  })

  it('prefers the zero-downtime closure instead of stopping after the verb phrase', () => {
    const text = 'Delivered migrations with zero downtime during weekend cutovers.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Delivered migrations', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Delivered migrations with zero downtime')
  })

  it('absorbs quantified client closure when compact and semantically attached', () => {
    const text = 'Built data pipelines for 3 enterprise clients across finance.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Built data pipelines', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Built data pipelines for 3 enterprise clients')
  })

  it('does not absorb a broad long tail after a good metric closure', () => {
    const text = 'Reduced latency by 40% in batch pipelines across LATAM and shared support teams.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Reduced latency', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Reduced latency by 40%')
  })

  it('does not end on a weak prepositional tail when a better closure exists slightly later', () => {
    const text = 'Improved throughput with zero downtime for payroll processing.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Improved throughput', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Improved throughput with zero downtime')
  })

  it('keeps the current span when the continuation is broad and weak', () => {
    const text = 'Built reporting infrastructure for the operations team across all LATAM regions.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Built reporting infrastructure', 'action_result'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Built reporting infrastructure')
  })

  it('trim-left removes a weak generic lead when a stronger later metric nucleus exists', () => {
    const text = 'Otimizei pipelines com salting e repartitioning, reduzindo em ate 40% o tempo de processamento.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Otimizei pipelines com salting e repartitioning, reduzindo em ate 40%', 'metric_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('reduzindo em ate 40% o tempo de processamento')
  })

  it('keeps a full migration unit when it is already a complete high-value phrase', () => {
    const text = 'Liderei a migracao de mais de 30 aplicacoes Qlik Sense para Qlik Cloud.'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Liderei a migracao de mais de 30 aplicacoes Qlik Sense para Qlik Cloud', 'business_impact'),
    )

    expect(range).not.toBeNull()
    expect(text.slice(range!.start, range!.end)).toBe('Liderei a migracao de mais de 30 aplicacoes Qlik Sense para Qlik Cloud')
  })

  it('accepts a whole short measurable bullet when it is the natural semantic unit', () => {
    const text = 'Reduced costs by 40%.'
    const items = [{
      itemId: 'exp_short_metric',
      section: 'experience' as const,
      text,
    }]

    const resolved = validateAndResolveHighlights(items, [{
      itemId: 'exp_short_metric',
      ranges: [{
        start: 0,
        end: text.length,
        reason: 'metric_impact' as const,
      }],
    }])

    expect(resolved).toEqual([{
      itemId: 'exp_short_metric',
      section: 'experience',
      ranges: [{
        start: 0,
        end: text.length - 1,
        reason: 'metric_impact',
      }],
    }])
  })

  it('promotes a candidate that only closes a dangling metric without changing the lead', () => {
    const text = 'Reduced processing time by 40% for analytics workloads'
    const baseRange = buildRange(text, 'Reduced processing time', 'metric_impact')
    const candidateRange = buildRange(text, 'Reduced processing time by 40%', 'metric_impact')

    expect(scoreHighlightCandidatePromotion(text, baseRange, candidateRange)).toBeGreaterThanOrEqual(3)
    expect(shouldPromoteHighlightCandidate(text, baseRange, candidateRange)).toBe(true)
  })

  it('does not promote a candidate that is only more compact without improving editorial meaning', () => {
    const text = 'Designed dashboard automation for finance leadership'
    const baseRange = buildRange(text, 'Designed dashboard automation for finance leadership', 'action_result')
    const candidateRange = buildRange(text, 'dashboard automation for finance leadership', 'action_result')

    expect(scoreHighlightCandidatePromotion(text, baseRange, candidateRange)).toBeLessThan(3)
    expect(shouldPromoteHighlightCandidate(text, baseRange, candidateRange)).toBe(false)
  })

  it('prefers the stronger trim-left candidate over a candidate that only closes the dangling metric', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento'
    const baseRange = buildRange(text, 'Otimizei fluxos internos reduzindo em 40%', 'metric_impact')
    const danglingMetricCandidate = buildRange(text, 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento', 'metric_impact')
    const trimLeftCandidate = buildRange(text, 'reduzindo em 40% o tempo de processamento', 'metric_impact')

    expect(scoreHighlightCandidatePromotion(text, baseRange, trimLeftCandidate))
      .toBeGreaterThan(scoreHighlightCandidatePromotion(text, baseRange, danglingMetricCandidate))

    const normalizedRange = normalizeHighlightSpanBoundaries(text, baseRange)
    expect(normalizedRange).not.toBeNull()
    expect(text.slice(normalizedRange!.start, normalizedRange!.end)).toBe('reduzindo em 40% o tempo de processamento')
  })

  it('buildTrimLeftCandidate finds a stronger re-entry without punctuation separators', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento'
    const candidate = buildTrimLeftCandidate(
      text,
      buildRange(text, 'Otimizei fluxos internos reduzindo em 40%', 'metric_impact'),
    )

    expect(candidate).not.toBeNull()
    expect(text.slice(candidate!.start, candidate!.end)).toBe('reduzindo em 40%')
  })

  it('buildTrimLeftCandidate preserves the separator-based path when punctuation exists', () => {
    const text = 'Otimizei fluxos internos, reduzindo em 40% o tempo de processamento'
    const candidate = buildTrimLeftCandidate(
      text,
      buildRange(text, 'Otimizei fluxos internos, reduzindo em 40%', 'metric_impact'),
    )

    expect(candidate).not.toBeNull()
    expect(text.slice(candidate!.start, candidate!.end)).toBe('reduzindo em 40%')
  })

  it('buildTrimLeftCandidate returns null when there is no weak lead and no separator path to trim', () => {
    const text = 'Reduzi em 40% o tempo de processamento'
    const candidate = buildTrimLeftCandidate(
      text,
      buildRange(text, 'Reduzi em 40%', 'metric_impact'),
    )

    expect(candidate).toBeNull()
  })
})

describe('HIGHLIGHT_EDITORIAL_REENTRY_SEARCH_PATTERN — boundary guards', () => {
  it('finds reentry at the start of a gerund verb in continuous text', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento'
    const range = buildRange(text, 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento', 'metric_impact')
    const candidate = buildPatternTrimLeftCandidate(text, {
      start: 0,
      end: range.end,
      reason: 'metric_impact',
    })

    expect(candidate).not.toBeNull()
    expect(text.slice(candidate!.start, candidate!.end)).toMatch(/^reduzindo/)
  })

  it('does not match a reentry verb preceded immediately by an accented letter', () => {
    const text = 'Atuei nos processos çreduzindo desperdício operacional'
    const candidate = buildPatternTrimLeftCandidate(
      text,
      { start: 0, end: text.length, reason: 'metric_impact' },
    )

    if (candidate !== null) {
      const prevChar = candidate.start > 0 ? text[candidate.start - 1] : undefined
      expect(prevChar).not.toMatch(/\p{L}/u)
    }
  })

  it('returns null without scanning when the span has no weak lead', () => {
    const text = 'Reduced processing time by 40% across all pipelines'
    const candidate = buildPatternTrimLeftCandidate(
      text,
      { start: 0, end: text.length, reason: 'metric_impact' },
    )

    expect(candidate).toBeNull()
  })

  it('uses separator path when separator is present even if pattern also matches', () => {
    const text = 'Otimizei fluxos internos, reduzindo em 40% o tempo de processamento'
    const candidateSeparator = buildSeparatorTrimLeftCandidate(
      text,
      { start: 0, end: text.length, reason: 'metric_impact' },
    )
    const candidatePattern = buildPatternTrimLeftCandidate(
      text,
      { start: 0, end: text.length, reason: 'metric_impact' },
    )
    const finalCandidate = buildTrimLeftCandidate(
      text,
      { start: 0, end: text.length, reason: 'metric_impact' },
    )

    expect(finalCandidate).not.toBeNull()
    expect(text.slice(finalCandidate!.start, finalCandidate!.end)).toMatch(/^reduzindo/)
    expect(candidateSeparator).not.toBeNull()
    expect(candidatePattern).not.toBeNull()
  })
})

describe('trim-left proximity guard', () => {
  it('does not trim when the metric immediately follows the weak verb', () => {
    const text = 'Reduzi 40% do custo operacional em LATAM.'
    const result = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'Reduzi 40% do custo operacional em LATAM', 'metric_impact'),
    )

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toMatch(/^Reduzi/)
  })

  it('trims when the strong nucleus is more than 2 words after the weak verb', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento.'
    const result = normalizeHighlightSpanBoundaries(
      text,
      buildRange(
        text,
        'Otimizei fluxos internos reduzindo em 40% o tempo de processamento',
        'metric_impact',
      ),
    )

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toMatch(/^reduzindo/)
  })

  it('does not trim a bullet where the verb is weak-pattern but the nucleus is immediate', () => {
    const text = 'Desenvolvi 12 processos criticos de reconciliacao financeira.'
    const result = normalizeHighlightSpanBoundaries(
      text,
      buildRange(
        text,
        'Desenvolvi 12 processos criticos de reconciliacao financeira',
        'metric_impact',
      ),
    )

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toMatch(/^Desenvolvi/)
  })
})

describe('choosePreferredHighlightCandidate — interaction with prior expansions', () => {
  it('does not trim a correctly expanded comma continuation when the lead verb is weak', () => {
    const text = 'Built BI dashboards, executive reporting.'
    const inputRange = buildRange(text, 'Built BI dashboards', 'business_impact')
    const result = normalizeHighlightSpanBoundaries(text, inputRange)

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toContain('BI dashboards')
    expect(text.slice(result!.start, result!.end)).toContain('executive reporting')
  })

  it('applies trim-left when the nucleus follows the weak verb in continuous text before any expansion', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40% o tempo de processamento.'
    const inputRange = buildRange(
      text,
      'Otimizei fluxos internos reduzindo em 40% o tempo de processamento',
      'metric_impact',
    )
    const result = normalizeHighlightSpanBoundaries(text, inputRange)

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toMatch(/^reduzindo/)
  })

  it('leaves a gerund-continuation expansion untouched when it is already editorially correct', () => {
    const text = 'Led data pipelines, reducing processing time by 40% for enterprise clients.'
    const inputRange = buildRange(
      text,
      'Led data pipelines, reducing processing time by 40%',
      'metric_impact',
    )
    const result = normalizeHighlightSpanBoundaries(text, inputRange)

    expect(result).not.toBeNull()
    const resultText = text.slice(result!.start, result!.end)
    expect(resultText).toContain('Led data pipelines')
    expect(resultText).toContain('reducing processing time by 40%')
  })

  it('does not replace a complete metric span with a compact closure fragment', () => {
    const text = 'Reduced processing time by 40% across all batch pipelines.'
    const inputRange = buildRange(text, 'Reduced processing time by 40%', 'metric_impact')
    const result = normalizeHighlightSpanBoundaries(text, inputRange)

    expect(result).not.toBeNull()
    expect(text.slice(result!.start, result!.end)).toContain('Reduced processing time')
  })

  it('applies trim-left over an already-expanded range when the lead is weak and the nucleus is far enough', () => {
    const text = 'Desenvolvi fluxos de dados internos, reduzindo em 40% o tempo de resposta.'
    const inputRange = buildRange(
      text,
      'Desenvolvi fluxos de dados internos',
      'metric_impact',
    )
    const result = normalizeHighlightSpanBoundaries(text, inputRange)

    expect(result).not.toBeNull()

    const resultText = text.slice(result!.start, result!.end)

    expect(resultText).toMatch(/^reduzindo/)
    expect(result!.start).toBeGreaterThan(0)
    expect(resultText).toContain('40%')
    expect(resultText).toContain('tempo de resposta')
  })
})

describe('normalizeHighlightSpanBoundaries — regression fixtures', () => {
  it('pipe-stack bullet is not expanded by candidate arbitration', () => {
    const text = 'Python | SQL | dbt | Airflow'
    const range = normalizeHighlightSpanBoundaries(
      text,
      buildRange(text, 'SQL', 'tool_context'),
    )

    expect(range).toBeNull()
  })

  it('long bullet with gerund continuation is rejected by editorial coverage without widening the normalized range', () => {
    const text = 'Led Azure Databricks pipelines that improved governance, stakeholder reporting, data quality routines, support rotations, and operational reviews across all business units in LATAM.'
    const rawRange = buildRange(
      text,
      'Led Azure Databricks pipelines that improved governance, stakeholder reporting, data quality routines, support rotations',
      'action_result',
    )
    const normalizedRange = normalizeHighlightSpanBoundaries(text, rawRange)

    expect(normalizedRange).not.toBeNull()
    expect(normalizedRange).toEqual(rawRange)
    expect(isEditoriallyAcceptableHighlightRange(text, normalizedRange!, 'experience')).toBe(false)
    expect(validateAndResolveHighlights([{
      itemId: 'exp_long_coverage',
      section: 'experience',
      text,
    }], [{
      itemId: 'exp_long_coverage',
      ranges: [rawRange],
    }])).toEqual([])
  })

  it('short measurable bullet with trailing punctuation is accepted as whole-bullet', () => {
    const text = 'Reduced costs by 40%.'
    const range = buildRange(text, 'Reduced costs by 40%', 'metric_impact')

    expect(isEditoriallyAcceptableHighlightRange(text, range, 'experience')).toBe(true)
  })

  it('long bullet is not accepted as whole-bullet even with metric', () => {
    const text = 'Led Azure Databricks pipelines that reduced processing time by 40% with full governance, CI/CD orchestration, and stakeholder reporting across all business units.'
    const range: CvHighlightRange = {
      start: 0,
      end: text.length,
      reason: 'metric_impact',
    }

    expect(isEditoriallyAcceptableHighlightRange(text, range, 'experience')).toBe(false)
  })

  it('candidate arbitration does not change a range that was already correct', () => {
    const text = 'Led Azure Databricks pipelines, reducing processing time by 40%'
    const range = buildRange(text, 'Led Azure Databricks pipelines, reducing processing time by 40%', 'metric_impact')
    const normalizedRange = normalizeHighlightSpanBoundaries(text, range)

    expect(normalizedRange).toEqual(range)
  })

  it('trailing punctuation is ignored when deciding whole-bullet intent', () => {
    const bullet = 'Reduced costs by 40%.'

    expect(isEditoriallyAcceptableHighlightRange(
      bullet,
      { start: 0, end: bullet.length - 1, reason: 'metric_impact' },
      'experience',
    )).toBe(true)
  })

  it('whole-bullet acceptance does not extend to long non-compact bullets', () => {
    const longBullet = 'Led Azure Databricks pipelines that reduced processing time by 40% with full governance, CI/CD orchestration, and stakeholder reporting across all business units.'

    expect(isEditoriallyAcceptableHighlightRange(
      longBullet,
      { start: 0, end: longBullet.length, reason: 'metric_impact' },
      'experience',
    )).toBe(false)
  })
})

describe('validateAndResolveHighlights — editorial correction fixtures', () => {
  it('extends a range that dies before the metric unit when the context follows immediately', () => {
    const text = 'Reduced costs by 40%.'
    const items = [{ itemId: 'exp_item', section: 'experience' as const, text }]
    const rawModelOutput = [{
      itemId: 'exp_item',
      ranges: [{
        start: 0,
        end: 'Reduced costs'.length,
        reason: 'metric_impact' as const,
      }],
    }]

    const resolved = validateAndResolveHighlights(items, rawModelOutput)
    const ranges = resolved.find((entry) => entry.itemId === 'exp_item')?.ranges ?? []

    expect(ranges.length).toBeGreaterThan(0)
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toContain('%')
  })

  it('trims a range that starts at a weak generic verb when a stronger nucleus follows', () => {
    const text = 'Otimizei fluxos internos reduzindo em 40%.'
    const items = [{ itemId: 'exp_item', section: 'experience' as const, text }]
    const rawModelOutput = [{
      itemId: 'exp_item',
      ranges: [{
        start: 0,
        end: text.length - 1,
        reason: 'metric_impact' as const,
      }],
    }]

    const resolved = validateAndResolveHighlights(items, rawModelOutput)
    const ranges = resolved.find((entry) => entry.itemId === 'exp_item')?.ranges ?? []

    expect(ranges.length).toBeGreaterThan(0)
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toMatch(/^reduzindo/)
    expect(ranges[0]!.start).toBeGreaterThan(0)
  })

  it('does not alter a range that is already editorially correct', () => {
    const text = 'Reduced costs by 40%.'
    const items = [{ itemId: 'exp_item', section: 'experience' as const, text }]
    const correctFragment = 'Reduced costs by 40%'
    const rawModelOutput = [{
      itemId: 'exp_item',
      ranges: [buildRange(text, correctFragment, 'metric_impact')],
    }]

    const resolved = validateAndResolveHighlights(items, rawModelOutput)
    const ranges = resolved.find((entry) => entry.itemId === 'exp_item')?.ranges ?? []

    expect(ranges.length).toBeGreaterThan(0)
    expect(text.slice(ranges[0]!.start, ranges[0]!.end)).toBe(correctFragment)
  })
})
