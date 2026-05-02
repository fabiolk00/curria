import type {
  ClaimPolicyItem,
  JobCompatibilityClaimPolicy,
  RequirementEvidence,
  RequirementEvidenceSpan,
} from '@/lib/agent/job-targeting/compatibility/types'

export const JOB_COMPATIBILITY_CLAIM_POLICY_VERSION = 'job-compat-claim-policy-v1'

export function buildJobCompatibilityClaimPolicy(
  requirements: RequirementEvidence[],
): JobCompatibilityClaimPolicy {
  return {
    allowedClaims: requirements
      .filter((requirement) => requirement.productGroup === 'supported')
      .map((requirement) => toAllowedClaim(requirement)),
    cautiousClaims: requirements
      .filter((requirement) => requirement.productGroup === 'adjacent')
      .map((requirement) => toCautiousClaim(requirement)),
    forbiddenClaims: requirements
      .filter((requirement) => requirement.productGroup === 'unsupported')
      .map((requirement) => toForbiddenClaim(requirement)),
  }
}

function toAllowedClaim(requirement: RequirementEvidence): ClaimPolicyItem {
  const signal = claimSignal(requirement)

  return {
    id: `claim-allowed-${requirement.id}`,
    signal,
    permission: 'allowed',
    evidenceBasis: requirement.supportingResumeSpans,
    allowedTerms: unique([...requirement.extractedSignals, ...requirement.matchedResumeTerms]),
    prohibitedTerms: [],
    rationale: requirement.rationale,
    requirementIds: [requirement.id],
  }
}

function toCautiousClaim(requirement: RequirementEvidence): ClaimPolicyItem {
  const signal = claimSignal(requirement)
  const allowedTerms = unique([
    ...requirement.matchedResumeTerms,
    ...spanTexts(requirement.supportingResumeSpans),
  ])

  return {
    id: `claim-cautious-${requirement.id}`,
    signal,
    permission: 'cautious',
    verbalizationTemplate: 'Use resume-backed related evidence: {allowedTerms}. Do not claim {signal} directly.',
    evidenceBasis: requirement.supportingResumeSpans,
    allowedTerms,
    prohibitedTerms: unique([...requirement.prohibitedTerms, ...requirement.extractedSignals]),
    rationale: requirement.rationale,
    requirementIds: [requirement.id],
  }
}

function toForbiddenClaim(requirement: RequirementEvidence): ClaimPolicyItem {
  const signal = claimSignal(requirement)

  return {
    id: `claim-forbidden-${requirement.id}`,
    signal,
    permission: 'forbidden',
    evidenceBasis: [],
    allowedTerms: [],
    prohibitedTerms: unique([
      ...requirement.prohibitedTerms,
      ...requirement.extractedSignals,
      signal,
    ]),
    rationale: requirement.rationale,
    requirementIds: [requirement.id],
  }
}

function claimSignal(requirement: RequirementEvidence): string {
  return requirement.extractedSignals[0] ?? requirement.originalRequirement
}

function spanTexts(spans: RequirementEvidenceSpan[]): string[] {
  return spans.map((span) => span.text)
}

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))]
}
