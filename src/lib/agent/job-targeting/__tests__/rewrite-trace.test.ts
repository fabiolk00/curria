import { describe, expect, it } from 'vitest'

import {
  buildGeneratedClaimTraceFromSectionPlans,
  buildSectionRewritePlan,
} from '@/lib/agent/job-targeting/compatibility/rewrite-trace'
import type { JobCompatibilityClaimPolicy } from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

const originalCvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Original summary.',
  experience: [{
    title: 'Analyst',
    company: 'Acme',
    startDate: '2022',
    endDate: '2024',
    bullets: ['Maintained existing reports.'],
  }],
  skills: ['Supported signal'],
  education: [],
  certifications: [],
}

const claimPolicy: JobCompatibilityClaimPolicy = {
  allowedClaims: [{
    id: 'claim-allowed',
    signal: 'Supported signal',
    permission: 'allowed',
    evidenceBasis: [{ id: 'basis-allowed', text: 'Supported signal' }],
    allowedTerms: ['Supported signal'],
    prohibitedTerms: [],
    rationale: 'supported',
    requirementIds: ['req-supported'],
  }],
  cautiousClaims: [{
    id: 'claim-cautious',
    signal: 'Cautious target',
    permission: 'cautious',
    verbalizationTemplate: 'Context related to {allowedTerms}.',
    evidenceBasis: [{ id: 'basis-related', text: 'Related evidence' }],
    allowedTerms: ['Related evidence'],
    prohibitedTerms: ['Cautious target'],
    rationale: 'adjacent',
    requirementIds: ['req-cautious'],
  }],
  forbiddenClaims: [{
    id: 'claim-forbidden',
    signal: 'Forbidden signal',
    permission: 'forbidden',
    evidenceBasis: [],
    allowedTerms: [],
    prohibitedTerms: ['Forbidden signal'],
    rationale: 'unsupported',
    requirementIds: ['req-forbidden'],
  }],
}

describe('rewrite claim trace builder', () => {
  it('builds section rewrite plans and generated claim traces from claim policy matches', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      skills: [
        'Supported signal',
        'Context related to Related evidence',
        'Forbidden signal',
      ],
    }

    const plan = buildSectionRewritePlan({
      section: 'skills',
      originalCvState,
      generatedCvState,
      claimPolicy,
    })
    const traces = buildGeneratedClaimTraceFromSectionPlans([plan])

    expect(plan.items).toEqual([
      expect.objectContaining({
        targetPath: 'skills.0',
        source: 'preserved_original',
        claimPolicyIds: ['claim-allowed'],
        permissionLevel: 'preserved_original',
      }),
      expect.objectContaining({
        targetPath: 'skills.1',
        source: 'new_generated_text',
        claimPolicyIds: ['claim-cautious'],
        permissionLevel: 'cautious',
      }),
      expect.objectContaining({
        targetPath: 'skills.2',
        claimPolicyIds: [],
        expressedSignals: [],
        unclassifiedText: 'Forbidden signal',
        classificationStatus: 'unclassified_new_text',
        prohibitedTermsAcknowledged: ['Forbidden signal'],
      }),
    ])
    expect(traces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        itemPath: 'skills.0',
        usedClaimPolicyIds: ['claim-allowed'],
        validationStatus: 'valid',
      }),
      expect.objectContaining({
        itemPath: 'skills.2',
        validationStatus: 'invalid',
        rationale: 'new_text_without_claim_policy',
        expressedSignals: [],
        unclassifiedText: 'Forbidden signal',
        classificationStatus: 'unclassified_new_text',
      }),
    ]))
  })

  it('does not use whole unclassified generated text as an expressed signal', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      experience: [{
        ...originalCvState.experience[0],
        bullets: [
          'Maintained existing reports.',
          'Introduced a new unclassified operating rhythm.',
        ],
      }],
    }

    const plan = buildSectionRewritePlan({
      section: 'experience',
      originalCvState,
      generatedCvState,
      claimPolicy,
    })
    const newItem = plan.items.find((item) => item.targetPath === 'experience.0.bullets.1')

    expect(newItem).toEqual(expect.objectContaining({
      source: 'new_generated_text',
      claimPolicyIds: [],
      expressedSignals: [],
      unclassifiedText: 'Introduced a new unclassified operating rhythm.',
      classificationStatus: 'unclassified_new_text',
    }))
  })

  it('classifies semantically equivalent rewrites as formatting only', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      experience: [{
        ...originalCvState.experience[0],
        bullets: ['Maintained and organized existing reports.'],
      }],
    }

    const plan = buildSectionRewritePlan({
      section: 'experience',
      originalCvState,
      generatedCvState,
      claimPolicy,
    })

    expect(plan.items[1]).toEqual(expect.objectContaining({
      targetPath: 'experience.0.bullets.0',
      source: 'formatting_only',
      permissionLevel: 'formatting_only',
      claimPolicyIds: [],
      expressedSignals: [],
      classificationStatus: 'formatting_only',
    }))
  })

  it('matches claim policy terms embedded inside longer evidence spans', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      experience: [{
        ...originalCvState.experience[0],
        bullets: ['Delivered reports using Related evidence and clear documentation.'],
      }],
    }

    const plan = buildSectionRewritePlan({
      section: 'experience',
      originalCvState,
      generatedCvState,
      claimPolicy: {
        ...claimPolicy,
        allowedClaims: [{
          id: 'claim-allowed-long-span',
          signal: 'Reporting delivery',
          permission: 'allowed',
          evidenceBasis: [{ id: 'basis-long', text: 'Professional background with Related evidence, documentation, and reporting routines' }],
          allowedTerms: [],
          prohibitedTerms: [],
          rationale: 'supported',
          requirementIds: ['req-long'],
        }],
        cautiousClaims: [],
      },
    })

    expect(plan.items[1]).toEqual(expect.objectContaining({
      targetPath: 'experience.0.bullets.0',
      source: 'new_generated_text',
      claimPolicyIds: ['claim-allowed-long-span'],
      expressedSignals: ['Reporting delivery'],
      permissionLevel: 'allowed',
      classificationStatus: 'claim_policy_matched',
    }))
  })

  it('uses model-selected claim trace ids without trusting invented expressed signals', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      summary: 'Improved wording with Supported signal.',
    }

    const plan = buildSectionRewritePlan({
      section: 'summary',
      originalCvState,
      generatedCvState,
      claimPolicy,
      modelClaimTraceItems: [{
        targetPath: 'summary',
        source: 'new_generated_text',
        usedClaimPolicyIds: ['claim-allowed'],
        expressedSignals: ['Invented signal'],
        evidenceBasis: ['Invented basis'],
        permissionLevel: 'allowed',
      }],
    })

    expect(plan.items[0]).toEqual(expect.objectContaining({
      claimPolicyIds: ['claim-allowed'],
      expressedSignals: ['Supported signal'],
      evidenceBasis: ['Supported signal'],
      classificationStatus: 'claim_policy_matched',
    }))
  })

  it('ignores model-selected claim ids that do not match the generated text', () => {
    const generatedCvState: CVState = {
      ...originalCvState,
      skills: ['Unrelated preserved skill'],
    }

    const plan = buildSectionRewritePlan({
      section: 'skills',
      originalCvState: {
        ...originalCvState,
        skills: ['Unrelated preserved skill'],
      },
      generatedCvState,
      claimPolicy,
      modelClaimTraceItems: [{
        targetPath: 'skills.0',
        source: 'new_generated_text',
        usedClaimPolicyIds: ['claim-allowed'],
        expressedSignals: ['Supported signal'],
        evidenceBasis: ['Supported signal'],
        permissionLevel: 'allowed',
      }],
    })

    expect(plan.items[0]).toEqual(expect.objectContaining({
      targetPath: 'skills.0',
      source: 'preserved_original',
      claimPolicyIds: [],
      expressedSignals: [],
      classificationStatus: 'original_preserved',
    }))
  })
})
