import { describe, expect, it } from 'vitest'

import { calculateJobCompatibilityScore } from '@/lib/agent/job-targeting/compatibility/score'
import type { RequirementEvidence } from '@/lib/agent/job-targeting/compatibility/types'

function requirement(
  overrides: Partial<RequirementEvidence> & Pick<RequirementEvidence, 'id' | 'kind' | 'productGroup'>,
): RequirementEvidence {
  return {
    originalRequirement: overrides.id,
    normalizedRequirement: overrides.id,
    extractedSignals: [overrides.id],
    importance: 'core',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
    matchedResumeTerms: [overrides.id],
    supportingResumeSpans: [],
    confidence: 1,
    rationale: 'test',
    source: 'exact',
    catalogTermIds: [],
    catalogCategoryIds: [],
    prohibitedTerms: [],
    audit: {
      matcherVersion: 'test',
      precedence: ['exact'],
      catalogIds: [],
      catalogVersions: {},
      catalogTermIds: [],
      catalogCategoryIds: [],
    },
    ...overrides,
  }
}

describe('job compatibility score', () => {
  it('uses the locked job-compat-score-v1 weights and adjacent discount', () => {
    const score = calculateJobCompatibilityScore([
      requirement({ id: 'skill-supported', kind: 'skill', productGroup: 'supported' }),
      requirement({ id: 'skill-adjacent', kind: 'skill', productGroup: 'adjacent' }),
      requirement({ id: 'skill-unsupported', kind: 'skill', productGroup: 'unsupported' }),
      requirement({ id: 'experience-supported', kind: 'responsibility', productGroup: 'supported' }),
      requirement({ id: 'education-unsupported', kind: 'education', productGroup: 'unsupported' }),
    ])

    expect(score.version).toBe('job-compat-score-v1')
    expect(score.total).toBe(63)
    expect(score.maxTotal).toBe(100)
    expect(score.scoreBreakdown.adjacentDiscount).toBe(0.5)
    expect(score.scoreBreakdown.weights).toEqual({
      skills: 0.34,
      experience: 0.46,
      education: 0.2,
    })
    expect(score.scoreBreakdown.dimensions.skills).toMatchObject({
      requirementCount: 3,
      supportedCount: 1,
      adjacentCount: 1,
      unsupportedCount: 1,
      rawScore: 0.5,
      weightedScore: 0.17,
    })
    expect(score.scoreBreakdown.dimensions.experience).toMatchObject({
      requirementCount: 1,
      supportedCount: 1,
      adjacentCount: 0,
      unsupportedCount: 0,
      rawScore: 1,
      weightedScore: 0.46,
    })
    expect(score.scoreBreakdown.dimensions.education).toMatchObject({
      requirementCount: 1,
      supportedCount: 0,
      adjacentCount: 0,
      unsupportedCount: 1,
      rawScore: 0,
      weightedScore: 0,
    })
  })

  it('keeps empty dimensions neutral while preserving audit counts', () => {
    const score = calculateJobCompatibilityScore([
      requirement({ id: 'skill-supported', kind: 'skill', productGroup: 'supported' }),
    ])

    expect(score.total).toBe(67)
    expect(score.scoreBreakdown.counts).toEqual({
      total: 1,
      supported: 1,
      adjacent: 0,
      unsupported: 0,
    })
    expect(score.scoreBreakdown.dimensions.experience).toMatchObject({
      requirementCount: 0,
      rawScore: 0.5,
      weightedScore: 0.23,
    })
    expect(score.scoreBreakdown.dimensions.education).toMatchObject({
      requirementCount: 0,
      rawScore: 0.5,
      weightedScore: 0.1,
    })
  })
})
