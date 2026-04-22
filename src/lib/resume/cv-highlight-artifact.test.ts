import { describe, expect, it } from 'vitest'

import {
  buildExperienceBulletHighlightItemIds,
  CV_HIGHLIGHT_ARTIFACT_VERSION,
  createExperienceBulletHighlightItemId,
  createSummaryHighlightItemId,
  flattenCvStateForHighlight,
  getHighlightRangesForItem,
  isEditoriallyAcceptableHighlightRange,
  normalizeCvHighlightState,
  segmentTextByHighlightRanges,
  validateAndResolveHighlights,
} from './cv-highlight-artifact'
import type { CVState } from '@/types/cv'

function buildCvState(overrides: Partial<CVState> = {}): CVState {
  return {
    fullName: 'Fabio Silva',
    email: 'fabio@example.com',
    phone: '11999999999',
    summary: 'Senior data engineer focused on BI modernization.',
    experience: [
      {
        title: 'Senior BI Engineer',
        company: 'ACME',
        startDate: '2022',
        endDate: 'present',
        bullets: [
          'Led Azure Databricks pipelines that reduced processing time by 40%.',
          '',
          'Built executive dashboards for regional stakeholders.',
        ],
      },
    ],
    skills: ['SQL', 'Python'],
    education: [],
    ...overrides,
  }
}

describe('cv highlight artifact helpers', () => {
  it('emits summary_0 when summary is present', () => {
    const items = flattenCvStateForHighlight(buildCvState())

    expect(items[0]).toEqual({
      itemId: createSummaryHighlightItemId(),
      section: 'summary',
      text: 'Senior data engineer focused on BI modernization.',
    })
  })

  it('ignores empty summary values', () => {
    const items = flattenCvStateForHighlight(buildCvState({ summary: '   ' }))

    expect(items.some((item) => item.section === 'summary')).toBe(false)
  })

  it('emits stable experience bullet ids and ignores empty bullets', () => {
    const items = flattenCvStateForHighlight(buildCvState())
    const experience = buildCvState().experience[0]
    const bulletItemIds = buildExperienceBulletHighlightItemIds(experience)

    expect(items).toEqual([
      {
        itemId: 'summary_0',
        section: 'summary',
        text: 'Senior data engineer focused on BI modernization.',
      },
      {
        itemId: bulletItemIds[0],
        section: 'experience',
        experienceIndex: 0,
        bulletIndex: 0,
        text: 'Led Azure Databricks pipelines that reduced processing time by 40%.',
      },
      {
        itemId: bulletItemIds[2],
        section: 'experience',
        experienceIndex: 0,
        bulletIndex: 2,
        text: 'Built executive dashboards for regional stakeholders.',
      },
    ])
  })

  it('drops invalid highlight entries and ranges', () => {
    const items = flattenCvStateForHighlight(buildCvState())
    const result = validateAndResolveHighlights(items, [
      {
        itemId: 'missing_item',
        ranges: [{ start: 0, end: 5, reason: 'ats_strength' }],
      },
      {
        itemId: 'summary_0',
        ranges: [
          { start: -1, end: 5, reason: 'ats_strength' },
          { start: 0, end: 6, reason: 'ats_strength' },
          { start: 4, end: 10, reason: 'tool_context' },
          { start: 10, end: 1000, reason: 'ats_strength' },
        ],
      },
    ])

    expect(result).toEqual([
      {
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 10, reason: 'ats_strength' }],
      },
    ])
  })

  it('returns no highlight item when no valid ranges remain', () => {
    const items = flattenCvStateForHighlight(buildCvState())

    expect(validateAndResolveHighlights(items, [
      {
        itemId: 'summary_0',
        ranges: [{ start: -1, end: 0, reason: 'ats_strength' }],
      },
    ])).toEqual([])
  })

  it('merges duplicate detector entries for the same item id', () => {
    const items = flattenCvStateForHighlight(buildCvState())

    expect(validateAndResolveHighlights(items, [
      {
        itemId: 'summary_0',
        ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
      },
      {
        itemId: 'summary_0',
        ranges: [{ start: 7, end: 15, reason: 'business_impact' }],
      },
    ])).toEqual([{
      itemId: 'summary_0',
      section: 'summary',
      ranges: [
        { start: 0, end: 6, reason: 'ats_strength' },
        { start: 7, end: 15, reason: 'business_impact' },
      ],
    }])
  })

  it('segments text without mutating non-highlighted content', () => {
    const text = 'Reduced processing time by 40% with Azure Databricks.'
    const segments = segmentTextByHighlightRanges(text, [
      { start: 0, end: 27, reason: 'metric_impact' },
      { start: 33, end: 50, reason: 'tool_context' },
    ])

    expect(segments).toEqual([
      { text: 'Reduced processing time by ', highlighted: true, reason: 'metric_impact' },
      { text: '40% wi', highlighted: false },
      { text: 'th Azure Databric', highlighted: true, reason: 'tool_context' },
      { text: 'ks.', highlighted: false },
    ])
  })

  it('keeps adjacent ranges highlighted without creating an artificial plain gap', () => {
    const text = 'Improved latency 40%'
    const segments = segmentTextByHighlightRanges(text, [
      { start: 0, end: 8, reason: 'action_result' },
      { start: 8, end: text.length, reason: 'metric_impact' },
    ])

    expect(segments).toEqual([
      { text: 'Improved', highlighted: true, reason: 'action_result' },
      { text: ' latency 40%', highlighted: true, reason: 'metric_impact' },
    ])
    expect(segments.map((segment) => segment.text).join('')).toBe(text)
  })

  it('normalizes unsorted, duplicate, overlapping, and out-of-bounds ranges before segmentation', () => {
    const text = 'Reduced processing time by 40% with Azure Databricks.'
    const segments = segmentTextByHighlightRanges(text, [
      { start: 33, end: 1000, reason: 'tool_context' },
      { start: 0, end: 27, reason: 'metric_impact' },
      { start: 24, end: 40, reason: 'business_impact' },
      { start: 0, end: 27, reason: 'metric_impact' },
      { start: -5, end: 4, reason: 'ats_strength' },
    ])

    expect(segments.map((segment) => segment.text).join('')).toBe(text)
    expect(segments).toEqual([
      { text: 'Reduced processing time by 40% with Azure Databricks.', highlighted: true, reason: 'ats_strength' },
    ])
  })

  it('uses semantic bullet ids that remain stable across reorder and index shifts', () => {
    const experience = buildCvState().experience[0]
    const reorderedExperience = {
      ...experience,
      bullets: [
        experience.bullets[2],
        experience.bullets[0],
      ],
    }
    const shiftedExperience = {
      ...experience,
      bullets: [
        'Introduced a new bullet before the original ones.',
        experience.bullets[0],
        experience.bullets[2],
      ],
    }

    const baseId = createExperienceBulletHighlightItemId(experience, experience.bullets[0])
    const reorderedId = createExperienceBulletHighlightItemId(reorderedExperience, reorderedExperience.bullets[1])
    const shiftedId = createExperienceBulletHighlightItemId(shiftedExperience, shiftedExperience.bullets[1])

    expect(baseId).toBe(reorderedId)
    expect(baseId).toBe(shiftedId)
  })

  it('changes bullet ids when semantic ownership or bullet text changes', () => {
    const experience = buildCvState().experience[0]
    const changedBulletTextId = createExperienceBulletHighlightItemId(
      experience,
      'Led Azure Databricks pipelines that reduced processing time by 55%.',
    )
    const changedCompanyId = createExperienceBulletHighlightItemId(
      { ...experience, company: 'Different Co' },
      experience.bullets[0],
    )

    expect(createExperienceBulletHighlightItemId(experience, experience.bullets[0])).not.toBe(changedBulletTextId)
    expect(createExperienceBulletHighlightItemId(experience, experience.bullets[0])).not.toBe(changedCompanyId)
  })

  it('creates unique semantic ids for duplicate bullets within the same experience', () => {
    const experience = {
      ...buildCvState().experience[0],
      bullets: ['Reduced costs 40%.', 'Reduced costs 40%.'],
    }

    expect(buildExperienceBulletHighlightItemIds(experience)).toEqual([
      expect.any(String),
      expect.any(String),
    ])
    expect(buildExperienceBulletHighlightItemIds(experience)[0]).not.toBe(buildExperienceBulletHighlightItemIds(experience)[1])
  })

  it('rejects summary and long bullet ranges that exceed editorial coverage thresholds', () => {
    const summary = 'Senior data engineer focused on BI modernization and executive reporting across LATAM.'
    const longBullet = 'Led Azure Databricks pipelines that reduced processing time by 40% with governance, orchestration, and stakeholder reporting.'

    expect(isEditoriallyAcceptableHighlightRange(summary, {
      start: 0,
      end: Math.floor(summary.length * 0.75),
      reason: 'ats_strength',
    }, 'summary')).toBe(false)

    expect(isEditoriallyAcceptableHighlightRange(longBullet, {
      start: 0,
      end: longBullet.length,
      reason: 'metric_impact',
    }, 'experience')).toBe(false)
  })

  it('allows compact measurable full-bullet highlights only for short experience bullets', () => {
    const compactBullet = 'Reduced costs 40% in LATAM.'

    expect(isEditoriallyAcceptableHighlightRange(compactBullet, {
      start: 0,
      end: compactBullet.length,
      reason: 'metric_impact',
    }, 'experience')).toBe(true)
  })

  it('returns matching ranges for an item or an empty array', () => {
    const resolved = [
      {
        itemId: 'summary_0',
        section: 'summary' as const,
        ranges: [{ start: 0, end: 6, reason: 'ats_strength' as const }],
      },
    ]

    expect(getHighlightRangesForItem(resolved, 'summary_0')).toEqual([
      { start: 0, end: 6, reason: 'ats_strength' },
    ])
    expect(getHighlightRangesForItem(resolved, 'exp_0_bullet_0')).toEqual([])
  })

  it('normalizes valid persisted highlight state and rejects invalid shapes', () => {
    expect(normalizeCvHighlightState({
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
      }],
    })).toEqual({
      source: 'rewritten_cv_state',
      version: CV_HIGHLIGHT_ARTIFACT_VERSION,
      generatedAt: '2026-04-22T12:00:00.000Z',
      resolvedHighlights: [{
        itemId: 'summary_0',
        section: 'summary',
        ranges: [{ start: 0, end: 6, reason: 'ats_strength' }],
      }],
    })

    expect(normalizeCvHighlightState({
      source: 'rewritten_cv_state',
      version: 1,
      resolvedHighlights: [],
      generatedAt: '2026-04-22T12:00:00.000Z',
    })).toBeUndefined()
  })
})
