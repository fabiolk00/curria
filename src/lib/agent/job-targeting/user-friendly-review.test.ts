import { describe, expect, it } from 'vitest'

import { buildCompatibilityAssessmentFixture } from '@/lib/agent/job-targeting/__tests__/assessment-fixture'
import {
  buildUserFriendlyJobReviewFromAssessment,
  buildUserFriendlyJobReviewFromTargetingEvidence,
} from '@/lib/agent/job-targeting/user-friendly-review'

describe('user friendly job review', () => {
  it('translates assessment evidence into user-facing requirement cards', () => {
    const review = buildUserFriendlyJobReviewFromAssessment(buildCompatibilityAssessmentFixture())

    expect(review.title).toBe('Essa vaga parece um pouco distante do seu currículo atual')
    expect(review.fitLevel).toBe('low')
    expect(review.canGenerateConservativeVersion).toBe(true)
    expect(review.requirements).toEqual([
      expect.objectContaining({
        label: 'Unsupported signal',
        status: 'needs_evidence',
        explanation: 'A vaga pede Unsupported signal, mas não encontramos essa experiência no seu currículo.',
        canAddEvidence: true,
      }),
      expect.objectContaining({
        label: 'Adjacent target signal',
        status: 'related',
        foundEvidence: ['Related resume signal'],
        canAddEvidence: true,
      }),
      expect.objectContaining({
        label: 'Supported signal',
        status: 'proven',
        foundEvidence: ['Resume Supported signal'],
        canAddEvidence: false,
      }),
    ])
  })

  it('does not leak technical policy terms into user-facing copy', () => {
    const review = buildUserFriendlyJobReviewFromAssessment(buildCompatibilityAssessmentFixture())
    const text = JSON.stringify(review)

    expect(text).not.toMatch(/forbidden_term|claim_policy|unsupported_claim|must_not_claim|validation_blocked|override|low fit/i)
  })

  it('builds the same friendly review from targeting-plan evidence for pre-generation blocks', () => {
    const review = buildUserFriendlyJobReviewFromTargetingEvidence({
      lowFitWarningGate: {
        triggered: true,
        matchScore: 32,
      },
      targetEvidence: [
        {
          jobSignal: 'SAP FI',
          evidenceLevel: 'unsupported_gap',
          rewritePermission: 'must_not_claim',
        },
        {
          jobSignal: 'Forecast',
          evidenceLevel: 'semantic_bridge_only',
          rewritePermission: 'can_mention_as_related_context',
          supportingResumeSpans: ['Análise de indicadores e projeções de desempenho.'],
        },
      ],
    })

    expect(review).toEqual(expect.objectContaining({
      title: 'Essa vaga parece um pouco distante do seu currículo atual',
      fitLevel: 'low',
      canGenerateConservativeVersion: true,
    }))
    expect(review?.requirements).toEqual([
      expect.objectContaining({
        label: 'SAP FI',
        status: 'needs_evidence',
      }),
      expect.objectContaining({
        label: 'Forecast',
        status: 'related',
        foundEvidence: ['Análise de indicadores e projeções de desempenho.'],
      }),
    ])
  })
})
