import { describe, expect, it } from 'vitest'

import { buildJobCompatibilityClaimPolicy } from '@/lib/agent/job-targeting/compatibility/claim-policy'
import type { RequirementEvidence } from '@/lib/agent/job-targeting/compatibility/types'

function requirement(
  overrides: Partial<RequirementEvidence> & Pick<RequirementEvidence, 'id' | 'productGroup' | 'extractedSignals'>,
): RequirementEvidence {
  return {
    originalRequirement: overrides.extractedSignals[0],
    normalizedRequirement: overrides.extractedSignals[0].toLowerCase(),
    kind: 'skill',
    importance: 'core',
    evidenceLevel: 'explicit',
    rewritePermission: 'can_claim_directly',
    matchedResumeTerms: [],
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

describe('job compatibility claim policy', () => {
  it('turns supported, adjacent, and unsupported evidence into enforceable claim groups', () => {
    const policy = buildJobCompatibilityClaimPolicy([
      requirement({
        id: 'req-supported',
        productGroup: 'supported',
        extractedSignals: ['Supported signal'],
        matchedResumeTerms: ['Supported evidence'],
        supportingResumeSpans: [{ id: 'span-supported', text: 'Supported evidence' }],
      }),
      requirement({
        id: 'req-adjacent',
        productGroup: 'adjacent',
        extractedSignals: ['Adjacent target signal'],
        matchedResumeTerms: ['Related resume signal'],
        supportingResumeSpans: [{ id: 'span-adjacent', text: 'Related resume signal' }],
      }),
      requirement({
        id: 'req-unsupported',
        productGroup: 'unsupported',
        extractedSignals: ['Unsupported signal'],
        prohibitedTerms: ['Unsupported signal'],
      }),
    ])

    expect(policy.allowedClaims).toEqual([
      expect.objectContaining({
        id: 'claim-allowed-req-supported',
        signal: 'Supported signal',
        permission: 'allowed',
        allowedTerms: ['Supported signal', 'Supported evidence'],
        prohibitedTerms: [],
        requirementIds: ['req-supported'],
      }),
    ])
    expect(policy.cautiousClaims).toEqual([
      expect.objectContaining({
        id: 'claim-cautious-req-adjacent',
        signal: 'Adjacent target signal',
        permission: 'cautious',
        allowedTerms: ['Related resume signal'],
        prohibitedTerms: ['Adjacent target signal'],
        verbalizationTemplate: expect.stringContaining('{allowedTerms}'),
        requirementIds: ['req-adjacent'],
      }),
    ])
    expect(policy.forbiddenClaims).toEqual([
      expect.objectContaining({
        id: 'claim-forbidden-req-unsupported',
        signal: 'Unsupported signal',
        permission: 'forbidden',
        allowedTerms: [],
        prohibitedTerms: ['Unsupported signal'],
        requirementIds: ['req-unsupported'],
      }),
    ])
    expect(policy.warnings).toBeUndefined()
    expect(policy.allowedClaims).toHaveLength(1)
    expect(policy.cautiousClaims).toHaveLength(1)
  })

  it('deduplicates claim terms by the same canonical signal used by validation', () => {
    const policy = buildJobCompatibilityClaimPolicy([
      requirement({
        id: 'req-supported',
        productGroup: 'supported',
        extractedSignals: ['Supported signal', 'supported   signal'],
        matchedResumeTerms: ['Supported Signal'],
        supportingResumeSpans: [{ id: 'span-supported', text: 'Supported signal' }],
      }),
    ])

    expect(policy.allowedClaims[0]?.allowedTerms).toEqual(['Supported signal'])
  })
})
