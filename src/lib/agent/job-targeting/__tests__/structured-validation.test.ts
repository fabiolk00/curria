import { describe, expect, it } from 'vitest'

import {
  buildGeneratedClaimTracesFromCvState,
  validateGeneratedClaims,
} from '@/lib/agent/job-targeting/compatibility/structured-validation'
import type {
  GeneratedClaimTrace,
  JobCompatibilityClaimPolicy,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { CVState } from '@/types/cv'

const policy: JobCompatibilityClaimPolicy = {
  allowedClaims: [
    {
      id: 'claim-allowed-supported',
      signal: 'Supported signal',
      permission: 'allowed',
      evidenceBasis: [{ id: 'span-supported', text: 'Supported signal' }],
      allowedTerms: ['Supported signal'],
      prohibitedTerms: [],
      rationale: 'Supported by resume evidence.',
      requirementIds: ['req-supported'],
    },
  ],
  cautiousClaims: [
    {
      id: 'claim-cautious-adjacent',
      signal: 'Adjacent target signal',
      permission: 'cautious',
      verbalizationTemplate: 'Use related evidence: {allowedTerms}.',
      evidenceBasis: [{ id: 'span-related', text: 'Related resume signal' }],
      allowedTerms: ['Related resume signal'],
      prohibitedTerms: ['Adjacent target signal'],
      rationale: 'Only related evidence exists.',
      requirementIds: ['req-adjacent'],
    },
  ],
  forbiddenClaims: [
    {
      id: 'claim-forbidden-unsupported',
      signal: 'Unsupported signal',
      permission: 'forbidden',
      evidenceBasis: [],
      allowedTerms: [],
      prohibitedTerms: [
        'Unsupported signal',
        'Unsupported certification',
        'Unsupported education',
      ],
      rationale: 'No supporting evidence exists.',
      requirementIds: ['req-unsupported'],
    },
  ],
}

const generatedCvState: CVState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Target Role with direct ownership of Adjacent target signal.',
  experience: [{
    title: 'Analyst',
    company: 'Acme',
    startDate: '2022',
    endDate: '2024',
    bullets: ['Delivered reports with Supported signal.'],
  }],
  skills: ['Supported signal', 'Unsupported signal'],
  education: [{
    degree: 'Unsupported education',
    institution: 'Example University',
    year: '2020',
  }],
  certifications: [{
    name: 'Unsupported certification',
    issuer: 'Example issuer',
    year: '2024',
  }],
}

describe('structured compatibility validation', () => {
  it('blocks forbidden terms from unsupported requirements', () => {
    const result = validateGeneratedClaims({
      generatedText: 'The resume claims Unsupported signal as a proven capability.',
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'forbidden_term',
        severity: 'error',
        term: 'Unsupported signal',
        claimPolicyItemId: 'claim-forbidden-unsupported',
        requirementIds: ['req-unsupported'],
      }),
    ])
  })

  it('blocks unsafe direct claims for cautious requirements', () => {
    const result = validateGeneratedClaims({
      generatedText: 'The resume directly claims Adjacent target signal.',
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'unsafe_direct_claim',
        severity: 'error',
        term: 'Adjacent target signal',
        claimPolicyItemId: 'claim-cautious-adjacent',
        requirementIds: ['req-adjacent'],
      }),
    ])
  })

  it('allows generated text that stays inside allowed evidence terms', () => {
    const result = validateGeneratedClaims({
      generatedText: 'The resume emphasizes Supported signal and Related resume signal.',
      claimPolicy: policy,
    })

    expect(result).toMatchObject({
      valid: true,
      blocked: false,
      issues: [],
      validationVersion: 'job-compat-structured-validation-v1',
    })
  })

  it('builds deterministic traces for generated CV sections', () => {
    const traces = buildGeneratedClaimTracesFromCvState(generatedCvState)

    expect(traces).toEqual(expect.arrayContaining([
      expect.objectContaining({
        section: 'summary',
        generatedText: generatedCvState.summary,
      }),
      expect.objectContaining({
        section: 'skills',
        generatedText: 'Unsupported signal',
      }),
      expect.objectContaining({
        section: 'education',
        generatedText: 'Unsupported education Example University 2020',
      }),
      expect.objectContaining({
        section: 'certifications',
        generatedText: 'Unsupported certification Example issuer 2024',
      }),
    ]))
  })

  it('classifies forbidden and cautious boundary violations by generated CV section', () => {
    const traces: GeneratedClaimTrace[] = buildGeneratedClaimTracesFromCvState(generatedCvState)
    const result = validateGeneratedClaims({
      generatedClaimTraces: traces,
      claimPolicy: policy,
      targetRole: {
        value: 'Target Role',
        permission: 'must_not_claim_target_role',
      },
    })

    expect(result.blocked).toBe(true)
    expect(result.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining([
      'unsupported_skill_added',
      'unsupported_certification',
      'unsupported_education_claim',
      'target_role_asserted_without_permission',
      'unsafe_direct_claim',
    ]))
  })

  it('allows cautious target signals when they are verbalized with related evidence', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'summary',
        itemPath: 'summary',
        generatedText: 'Experience related to Adjacent target signal based on Related resume signal.',
        expressedSignals: ['Adjacent target signal'],
        usedClaimPolicyIds: ['claim-cautious-adjacent'],
        evidenceBasis: ['Related resume signal'],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'test',
      }],
      claimPolicy: policy,
    })

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('blocks generated CV content that is missing claim trace coverage', () => {
    const result = validateGeneratedClaims({
      generatedCvState,
      generatedClaimTraces: [],
      requireClaimTrace: true,
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'missing_claim_trace',
        section: 'summary',
        traceId: 'summary',
      }),
    ]))
  })

  it('blocks expressed signals not present in allowed or cautious claim policy', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'experience',
        itemPath: 'experience.0.bullets.0',
        generatedText: 'Delivered a new unsupported operating model.',
        expressedSignals: ['New unsupported operating model'],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'warning',
        rationale: 'new_text_without_claim_policy',
      }],
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'unsupported_expressed_signal',
        term: 'New unsupported operating model',
      }),
    ])
  })

  it('blocks unclassified generated text without treating the whole text as an expressed signal', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'experience',
        itemPath: 'experience.0.bullets.0',
        generatedText: 'Introduced a new unclassified operating rhythm.',
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'warning',
        rationale: 'new_text_without_claim_policy',
        unclassifiedText: 'Introduced a new unclassified operating rhythm.',
        classificationStatus: 'unclassified_new_text',
      }],
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'unclassified_generated_text',
        term: 'Introduced a new unclassified operating rhythm.',
      }),
    ])
  })

  it('allows formatting-only trace items without claim policy ids', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'experience',
        itemPath: 'experience.0.bullets.0',
        generatedText: 'Maintained and organized existing reports.',
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'formatting_only_without_new_claim',
        source: 'formatting_only',
        classificationStatus: 'formatting_only',
      }],
      claimPolicy: policy,
    })

    expect(result.valid).toBe(true)
    expect(result.blocked).toBe(false)
    expect(result.issues).toEqual([])
  })

  it('keeps forbidden terms blocked even when a trace claims formatting-only', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'skills',
        itemPath: 'skills.1',
        generatedText: 'Unsupported signal',
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: ['Unsupported signal'],
        validationStatus: 'invalid',
        rationale: 'formatting_only_without_new_claim',
        source: 'formatting_only',
        classificationStatus: 'formatting_only',
      }],
      claimPolicy: policy,
    })

    expect(result.blocked).toBe(true)
    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'unsupported_skill_added',
        term: 'Unsupported signal',
      }),
    ])
  })

  it('does not treat a preserved original title as a new target-role assertion', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'experience',
        itemPath: 'experience.0.title',
        generatedText: 'Target Role Acme',
        expressedSignals: [],
        usedClaimPolicyIds: [],
        evidenceBasis: [],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'original_preserved_without_new_claim',
        source: 'preserved_original',
        classificationStatus: 'original_preserved',
      }],
      claimPolicy: policy,
      targetRole: {
        value: 'Target Role',
        permission: 'must_not_claim_target_role',
      },
    })

    expect(result.valid).toBe(true)
    expect(result.issues).toEqual([])
  })

  it('matches allowed expressed signals with shared canonicalization', () => {
    const result = validateGeneratedClaims({
      generatedClaimTraces: [{
        section: 'experience',
        itemPath: 'experience.0.bullets.0',
        generatedText: 'Delivered reports with supported signal.',
        expressedSignals: ['supported   signal'],
        usedClaimPolicyIds: ['claim-allowed-supported'],
        evidenceBasis: ['supported signal'],
        prohibitedTermsFound: [],
        validationStatus: 'valid',
        rationale: 'claim_policy_matched',
        classificationStatus: 'claim_policy_matched',
      }],
      claimPolicy: policy,
    })

    expect(result.issues).toEqual([])
    expect(result.blocked).toBe(false)
  })
})
