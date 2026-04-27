import { repairUtf8Mojibake } from '@/lib/text/repair-utf8-mojibake'
import type {
  LowFitWarningGate,
  RewriteValidationResult,
  TargetEvidence,
  TargetRolePositioning,
  ValidationIssue,
} from '@/types/agent'

const PROMOTABLE_LOW_FIT_ISSUE_TYPES = new Set<NonNullable<ValidationIssue['issueType']>>([
  'target_role_overclaim',
  'summary_skill_without_evidence',
  'unsupported_claim',
  'seniority_inflation',
])

function buildSyntheticLowFitIssue(params: {
  targetRole?: string
  targetRolePositioning?: TargetRolePositioning
  lowFitWarningGate: LowFitWarningGate
}): ValidationIssue {
  const unsupportedSignals = params.lowFitWarningGate.coreRequirementCoverage.topUnsupportedSignalsForDisplay
    ?? params.lowFitWarningGate.coreRequirementCoverage.unsupportedSignals.slice(0, 6)
  const targetRole = params.targetRole?.trim()

  return {
    severity: 'high',
    section: 'summary',
    issueType: 'low_fit_target_role',
    message: repairUtf8Mojibake(targetRole
      ? `A vaga de ${targetRole} ficou distante demais do histórico comprovado no currículo original para geração automática segura.`
      : 'A vaga ficou distante demais do histórico comprovado no currículo original para geração automática segura.'),
    offendingSignal: targetRole,
    suggestedReplacement: params.targetRolePositioning?.safeRolePositioning,
    userFacingTitle: repairUtf8Mojibake('Esta vaga parece muito distante do seu currículo atual'),
    userFacingExplanation: repairUtf8Mojibake(
      unsupportedSignals.length > 0
        ? `Encontramos poucos pontos comprovados para requisitos centrais como ${unsupportedSignals.join(', ')}.`
        : 'Encontramos poucos pontos comprovados para os requisitos principais desta vaga.',
    ),
  }
}

export function buildLowFitWarningGate(params: {
  matchScore?: number
  careerFitEvaluation?: {
    riskLevel: 'low' | 'medium' | 'high'
    signals: {
      matchScore?: number
      missingSkillsCount?: number
      familyDistance?: 'same' | 'adjacent' | 'distant' | 'unknown'
    }
  }
  targetEvidence: TargetEvidence[]
  targetRolePositioning?: TargetRolePositioning
  coreRequirementCoverage: {
    total: number
    supported: number
    unsupported: number
    unsupportedSignals: string[]
    topUnsupportedSignalsForDisplay: string[]
  }
}): LowFitWarningGate {
  const explicitEvidenceCount = params.targetEvidence.filter((evidence) => evidence.evidenceLevel === 'explicit').length
  const supportedClaimEvidenceCount = params.targetEvidence.filter((evidence) => (
    evidence.evidenceLevel === 'explicit'
    || evidence.evidenceLevel === 'normalized_alias'
    || evidence.evidenceLevel === 'technical_equivalent'
  )).length
  const unsupportedGapCount = params.targetEvidence.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length
  const totalEvidence = params.targetEvidence.length
  const unsupportedGapRatio = totalEvidence > 0 ? unsupportedGapCount / totalEvidence : 0
  const explicitEvidenceRatio = totalEvidence > 0 ? explicitEvidenceCount / totalEvidence : 0
  const supportedClaimEvidenceRatio = totalEvidence > 0 ? supportedClaimEvidenceCount / totalEvidence : 0
  const matchScore = params.careerFitEvaluation?.signals.matchScore ?? params.matchScore ?? 0
  const riskLevel = params.careerFitEvaluation?.riskLevel
  const familyDistance = params.careerFitEvaluation?.signals.familyDistance
  const missingSkillsCount = params.careerFitEvaluation?.signals.missingSkillsCount ?? 0
  const coreCoverage = params.coreRequirementCoverage
  const coreUnsupportedRatio = coreCoverage.total > 0
    ? coreCoverage.unsupported / coreCoverage.total
    : 0
  const lowCoreCoverage = coreCoverage.total >= 5
    && coreCoverage.supported / coreCoverage.total < 0.35

  let reason: LowFitWarningGate['reason']

  if (riskLevel === 'high' && matchScore < 45) {
    reason = 'very_low_match_score'
  } else if (coreCoverage.total >= 5 && coreUnsupportedRatio >= 0.7) {
    reason = 'too_many_unsupported_core_requirements'
  } else if (
    params.targetRolePositioning?.permission === 'must_not_claim_target_role'
    && supportedClaimEvidenceRatio <= 0.25
    && lowCoreCoverage
  ) {
    reason = 'target_role_not_supported'
  } else if (
    unsupportedGapRatio >= 0.7
    && supportedClaimEvidenceRatio <= 0.2
    && supportedClaimEvidenceCount <= 1
  ) {
    reason = 'explicit_evidence_too_low'
  } else if (
    (riskLevel === 'high' && lowCoreCoverage)
    || (missingSkillsCount >= 10 && unsupportedGapRatio >= 0.6)
  ) {
    reason = 'high_risk_off_target'
  }

  return {
    triggered: Boolean(
      reason
      || (riskLevel === 'high' && matchScore < 45)
      || (unsupportedGapRatio >= 0.7 && supportedClaimEvidenceRatio <= 0.2)
      || (missingSkillsCount >= 10 && unsupportedGapRatio >= 0.6)
      || (
        params.targetRolePositioning?.permission === 'must_not_claim_target_role'
        && supportedClaimEvidenceRatio <= 0.25
        && lowCoreCoverage
      )
      || (riskLevel === 'high' && lowCoreCoverage)
    ),
    reason,
    matchScore,
    riskLevel,
    familyDistance,
    explicitEvidenceCount,
    unsupportedGapCount,
    unsupportedGapRatio,
    explicitEvidenceRatio,
    coreRequirementCoverage: coreCoverage,
  }
}

export function shouldPreRewriteLowFitBlock(params: {
  lowFitWarningGate?: LowFitWarningGate
  skipPreRewriteLowFitBlock?: boolean
}): boolean {
  if (params.skipPreRewriteLowFitBlock) {
    return false
  }

  const gate = params.lowFitWarningGate
  if (!gate?.triggered) {
    return false
  }

  return (
    gate.unsupportedGapRatio >= 0.8
    && gate.explicitEvidenceRatio <= 0.15
    && gate.coreRequirementCoverage.supported === 0
    && gate.matchScore < 40
  )
}

export function applyLowFitWarningGateToValidation(params: {
  validation: RewriteValidationResult
  lowFitWarningGate?: LowFitWarningGate
  targetRole?: string
  targetRolePositioning?: TargetRolePositioning
  skipLowFitRecoverableBlocking?: boolean
}): RewriteValidationResult {
  if (params.skipLowFitRecoverableBlocking) {
    return params.validation
  }

  if (!params.lowFitWarningGate?.triggered) {
    return params.validation
  }

  const promotedWarnings = params.validation.softWarnings.filter((issue) =>
    issue.issueType !== undefined && PROMOTABLE_LOW_FIT_ISSUE_TYPES.has(issue.issueType))
  const remainingSoftWarnings = params.validation.softWarnings.filter((issue) => !promotedWarnings.includes(issue))
  const promotedHardIssues: ValidationIssue[] = promotedWarnings.map((issue) => ({
    ...issue,
    severity: 'high' as const,
  }))
  const promotionMetadata = promotedWarnings.map((issue) => ({
    from: 'soft' as const,
    to: 'recoverable_hard' as const,
    issueType: issue.issueType ?? 'unsupported_claim',
    reason: params.lowFitWarningGate?.reason ?? 'low_fit_gate_triggered',
  }))

  if (promotedHardIssues.length === 0 && params.validation.hardIssues.length === 0) {
    promotedHardIssues.push(buildSyntheticLowFitIssue({
      targetRole: params.targetRole,
      targetRolePositioning: params.targetRolePositioning,
      lowFitWarningGate: params.lowFitWarningGate,
    }))
    promotionMetadata.push({
      from: 'soft',
      to: 'recoverable_hard',
      issueType: promotedHardIssues[0]?.issueType ?? 'unsupported_claim',
      reason: params.lowFitWarningGate.reason ?? 'low_fit_gate_triggered',
    })
  }

  const hardIssues = [
    ...params.validation.hardIssues,
    ...promotedHardIssues,
  ]
  const issues = [
    ...hardIssues,
    ...remainingSoftWarnings,
  ]

  return {
    ...params.validation,
    blocked: hardIssues.length > 0,
    valid: issues.length === 0,
    recoverable: hardIssues.length > 0,
    hardIssues,
    softWarnings: remainingSoftWarnings,
    issues,
    promotedWarnings: promotionMetadata.length > 0
      ? promotionMetadata
      : params.validation.promotedWarnings,
  }
}
