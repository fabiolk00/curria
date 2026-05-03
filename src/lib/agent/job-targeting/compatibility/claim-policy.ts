import type {
  ClaimPolicyItem,
  JobCompatibilityClaimPolicy,
  RequirementEvidence,
  RequirementEvidenceSpan,
} from '@/lib/agent/job-targeting/compatibility/types'
import { uniqueByCanonicalClaimSignal } from '@/lib/agent/job-targeting/compatibility/claim-signal'

export const JOB_COMPATIBILITY_CLAIM_POLICY_VERSION = 'job-compat-claim-policy-v1'

export function buildJobCompatibilityClaimPolicy(
  requirements: RequirementEvidence[],
): JobCompatibilityClaimPolicy {
  const supportedRequirements = requirements.filter((requirement) => requirement.productGroup === 'supported')
  const adjacentRequirements = requirements.filter((requirement) => requirement.productGroup === 'adjacent')
  const unsupportedRequirements = requirements.filter((requirement) => requirement.productGroup === 'unsupported')
  const allowedClaims = supportedRequirements.map((requirement) => toAllowedClaim(requirement))
  const cautiousClaims = adjacentRequirements.map((requirement) => toCautiousClaim(requirement))
  const forbiddenClaims = unsupportedRequirements.map((requirement) => toForbiddenClaim(requirement))
  const warnings = [
    ...(supportedRequirements.length > 0 && allowedClaims.length === 0
      ? ['claim_policy_missing_supported_claim']
      : []),
    ...(adjacentRequirements.length > 0 && cautiousClaims.length === 0
      ? ['claim_policy_missing_cautious_claim']
      : []),
  ]

  return {
    allowedClaims,
    cautiousClaims,
    forbiddenClaims,
    ...(warnings.length === 0 ? {} : { warnings }),
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
  return uniqueByCanonicalClaimSignal(items)
}
