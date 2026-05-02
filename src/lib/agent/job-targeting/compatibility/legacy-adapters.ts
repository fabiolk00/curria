import { buildCanonicalSignal } from '@/lib/agent/job-targeting/semantic-normalization'
import type {
  JobCompatibilityAssessment,
  JobCompatibilityGap,
  RequirementEvidence,
} from '@/lib/agent/job-targeting/compatibility/types'
import type {
  BridgeClaimInstruction,
  CoreRequirement,
  CoreRequirementCoverage,
  EvidenceLevel,
  JobTargetingExplanation,
  JobTargetingScoreBreakdown,
  JobTargetingScoreBreakdownItem,
  LowFitWarningGate,
  RewritePermission,
  SafeTargetingEmphasis,
  TargetEvidence,
  TargetRecommendation,
  TargetRecommendationKind,
  TargetRecommendationPriority,
  TargetedRewritePermissions,
  TargetingPlan,
  TargetRolePositioning,
} from '@/types/agent'

type BuildTargetingPlanFromAssessmentOptions = {
  basePlan?: TargetingPlan
  focusKeywords?: string[]
  mustEmphasize?: string[]
  shouldDeemphasize?: string[]
  missingButCannotInvent?: string[]
  sectionStrategy?: TargetingPlan['sectionStrategy']
}

type AssessmentAdapterParts = {
  targetEvidence: TargetEvidence[]
  rewritePermissions: TargetedRewritePermissions
  safeTargetingEmphasis: SafeTargetingEmphasis
  coreRequirementCoverage: CoreRequirementCoverage
  targetRolePositioning: TargetRolePositioning
  lowFitWarningGate: LowFitWarningGate
}

type BuildJobTargetingExplanationFromAssessmentOptions = {
  generatedAt?: string
}

const SCORE_ITEMS: Array<{
  id: JobTargetingScoreBreakdownItem['id']
  label: JobTargetingScoreBreakdownItem['label']
}> = [
  { id: 'skills', label: 'Habilidades' },
  { id: 'experience', label: 'Experiência' },
  { id: 'education', label: 'Formação' },
]

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const canonical = buildCanonicalSignal(value)
      if (!canonical || seen.has(canonical)) {
        return false
      }

      seen.add(canonical)
      return true
    })
}

function firstSignal(requirement: RequirementEvidence): string {
  return requirement.extractedSignals[0]?.trim()
    || requirement.originalRequirement.trim()
    || requirement.id
}

function displaySignal(value: string): string {
  const cleaned = value.replace(/\s+/gu, ' ').trim()
  return cleaned ? `${cleaned.charAt(0).toLocaleUpperCase('pt-BR')}${cleaned.slice(1)}` : cleaned
}

function mapEvidenceLevel(requirement: RequirementEvidence): EvidenceLevel {
  switch (requirement.evidenceLevel) {
    case 'catalog_alias':
      return 'normalized_alias'
    case 'category_equivalent':
      return 'technical_equivalent'
    case 'explicit':
    case 'strong_contextual_inference':
    case 'semantic_bridge_only':
    case 'unsupported_gap':
      return requirement.evidenceLevel
  }
}

function mapRewritePermission(requirement: RequirementEvidence): RewritePermission {
  return requirement.rewritePermission
}

function validationSeverityFor(requirement: RequirementEvidence): TargetEvidence['validationSeverityIfViolated'] {
  switch (requirement.productGroup) {
    case 'supported':
      return 'none'
    case 'adjacent':
      return requirement.rewritePermission === 'can_mention_as_related_context' ? 'major' : 'warning'
    case 'unsupported':
      return 'critical'
  }
}

function claimsForRequirement(
  assessment: JobCompatibilityAssessment,
  requirement: RequirementEvidence,
) {
  return [
    ...assessment.claimPolicy.allowedClaims,
    ...assessment.claimPolicy.cautiousClaims,
    ...assessment.claimPolicy.forbiddenClaims,
  ].filter((claim) => claim.requirementIds.includes(requirement.id))
}

function buildAllowedRewriteForms(
  assessment: JobCompatibilityAssessment,
  requirement: RequirementEvidence,
): string[] {
  if (requirement.rewritePermission === 'must_not_claim') {
    return dedupe(requirement.matchedResumeTerms)
  }

  return dedupe([
    firstSignal(requirement),
    ...requirement.matchedResumeTerms,
    ...claimsForRequirement(assessment, requirement).flatMap((claim) => claim.allowedTerms),
  ])
}

function buildForbiddenRewriteForms(
  assessment: JobCompatibilityAssessment,
  requirement: RequirementEvidence,
): string[] {
  return dedupe([
    ...requirement.prohibitedTerms,
    ...claimsForRequirement(assessment, requirement).flatMap((claim) => claim.prohibitedTerms),
    ...(requirement.rewritePermission === 'must_not_claim' ? [firstSignal(requirement)] : []),
  ])
}

function buildBridgeInstruction(evidence: TargetEvidence): BridgeClaimInstruction {
  const anchors = dedupe([
    ...evidence.matchedResumeTerms,
    ...evidence.supportingResumeSpans,
  ]).slice(0, 3)
  const anchorText = anchors.length > 0 ? anchors.join(', ') : 'evidências reais do currículo'

  return {
    jobSignal: evidence.canonicalSignal,
    safeBridge: `Conecte ${evidence.canonicalSignal} apenas como contexto relacionado a partir de ${anchorText}.`,
    doNotSay: evidence.forbiddenRewriteForms,
  }
}

function isDirectClaimEvidence(evidence: TargetEvidence): boolean {
  return evidence.rewritePermission === 'can_claim_directly'
    || evidence.rewritePermission === 'can_claim_normalized'
}

function mapRequirementKind(requirement: RequirementEvidence): CoreRequirement['requirementKind'] {
  if (requirement.importance === 'differential') {
    return 'preferred'
  }

  if (requirement.kind === 'responsibility') {
    return 'responsibility'
  }

  return requirement.importance === 'core' ? 'required' : undefined
}

function toCoreRequirement(requirement: RequirementEvidence): CoreRequirement {
  return {
    signal: displaySignal(firstSignal(requirement)),
    importance: requirement.importance,
    requirementKind: mapRequirementKind(requirement),
    evidenceLevel: mapEvidenceLevel(requirement),
    rewritePermission: mapRewritePermission(requirement),
  }
}

function isSupportedCoreRequirement(requirement: RequirementEvidence): boolean {
  return requirement.importance === 'core'
    && requirement.productGroup === 'supported'
    && requirement.rewritePermission !== 'must_not_claim'
}

function buildUnsupportedDisplaySignals(assessment: JobCompatibilityAssessment): string[] {
  const criticalGapSignals = assessment.criticalGaps.map((gap) => displaySignal(gap.signal))
  const unsupportedCoreSignals = assessment.unsupportedRequirements
    .filter((requirement) => requirement.importance === 'core')
    .map((requirement) => displaySignal(firstSignal(requirement)))

  return dedupe([...criticalGapSignals, ...unsupportedCoreSignals]).slice(0, 16)
}

function buildPreferredSignals(assessment: JobCompatibilityAssessment): string[] {
  return dedupe(
    assessment.requirements
      .filter((requirement) => requirement.importance === 'differential')
      .map((requirement) => displaySignal(firstSignal(requirement))),
  ).slice(0, 8)
}

function lowFitReasonForAssessment(
  assessment: JobCompatibilityAssessment,
): LowFitWarningGate['reason'] {
  const reason = assessment.lowFit.reason ?? assessment.lowFit.reasons[0]

  if (reason === 'very_low_compatibility_score') {
    return 'very_low_match_score'
  }

  if (reason === 'too_many_unsupported_core_requirements') {
    return 'too_many_unsupported_core_requirements'
  }

  if (assessment.lowFit.triggered || assessment.lowFit.blocking) {
    return 'high_risk_off_target'
  }

  return undefined
}

function buildSafeRolePositioning(targetEvidence: TargetEvidence[]): string {
  const directSignals = dedupe(
    targetEvidence
      .filter(isDirectClaimEvidence)
      .flatMap((evidence) => [
        evidence.canonicalSignal,
        ...evidence.matchedResumeTerms,
      ]),
  ).slice(0, 4)

  return directSignals.length > 0
    ? `Profissional com experiência comprovada em ${directSignals.join(', ')}.`
    : 'Profissional com histórico comprovado no currículo original.'
}

function buildFallbackSectionStrategy(assessment: JobCompatibilityAssessment): TargetingPlan['sectionStrategy'] {
  const directSignals = dedupe(
    assessment.supportedRequirements.flatMap((requirement) => [
      firstSignal(requirement),
      ...requirement.matchedResumeTerms,
    ]),
  ).slice(0, 6)
  const unsupportedSignals = buildUnsupportedDisplaySignals(assessment).slice(0, 4)

  return {
    summary: [
      assessment.targetRoleConfidence !== 'low'
        ? `Posicione o candidato para ${assessment.targetRole} sem alegar experiência não comprovada.`
        : 'Use os requisitos da vaga como contexto sem forçar um cargo-alvo não confiável.',
      directSignals.length > 0
        ? `Priorize sinais comprovados como ${directSignals.join(', ')}.`
        : 'Priorize evidências já presentes no currículo.',
      unsupportedSignals.length > 0
        ? `Não esconda lacunas como ${unsupportedSignals.join(', ')}.`
        : 'Evite parecer um encaixe perfeito quando houver lacunas reais.',
    ],
    experience: [
      'Reordene a narrativa para destacar evidências reais mais próximas da vaga.',
      'Mantenha empresas, cargos, datas e escopo factual intactos.',
    ],
    skills: [
      'Ordene habilidades pela aderência comprovada aos requisitos.',
      'Não adicione habilidades ausentes do currículo original.',
    ],
    education: [
      'Mantenha formação totalmente factual.',
      'Apenas padronize formato e leitura ATS.',
    ],
    certifications: [
      'Destaque certificações próximas da vaga quando existirem no currículo.',
      'Não crie alinhamento artificial com certificações inexistentes.',
    ],
  }
}

function buildAdapterParts(assessment: JobCompatibilityAssessment): AssessmentAdapterParts {
  const targetEvidence = buildTargetEvidenceFromAssessment(assessment)
  const rewritePermissions = buildRewritePermissionsFromAssessment(assessment, targetEvidence)
  const safeTargetingEmphasis = buildSafeTargetingEmphasisFromAssessment(assessment, {
    targetEvidence,
    rewritePermissions,
  })
  const coreRequirementCoverage = buildCoreRequirementCoverageFromAssessment(assessment)
  const targetRolePositioning = buildTargetRolePositioningFromAssessment(assessment, {
    targetEvidence,
    coreRequirementCoverage,
  })
  const lowFitWarningGate = buildLowFitWarningGateFromAssessment(assessment, {
    targetEvidence,
    coreRequirementCoverage,
  })

  return {
    targetEvidence,
    rewritePermissions,
    safeTargetingEmphasis,
    coreRequirementCoverage,
    targetRolePositioning,
    lowFitWarningGate,
  }
}

function priorityForGap(gap: JobCompatibilityGap): TargetRecommendationPriority {
  if (gap.severity === 'critical' || gap.importance === 'core') {
    return 'high'
  }

  return gap.importance === 'differential' ? 'low' : 'medium'
}

function recommendationKindForGap(gap: JobCompatibilityGap): TargetRecommendationKind {
  switch (gap.kind) {
    case 'platform':
    case 'tool':
      return 'missing_tooling_detail'
    case 'methodology':
      return 'missing_methodology'
    case 'industry':
    case 'business_domain':
      return 'missing_business_domain'
    case 'responsibility':
    case 'seniority':
      return 'missing_context'
    default:
      return 'missing_explicit_skill'
  }
}

export function buildTargetEvidenceFromAssessment(assessment: JobCompatibilityAssessment): TargetEvidence[] {
  return assessment.requirements.map((requirement) => {
    const signal = firstSignal(requirement)

    return {
      jobSignal: signal,
      canonicalSignal: displaySignal(signal),
      evidenceLevel: mapEvidenceLevel(requirement),
      rewritePermission: mapRewritePermission(requirement),
      matchedResumeTerms: dedupe(requirement.matchedResumeTerms),
      supportingResumeSpans: dedupe(requirement.supportingResumeSpans.map((span) => span.text)),
      rationale: requirement.rationale,
      confidence: Math.max(0, Math.min(1, requirement.confidence)),
      allowedRewriteForms: buildAllowedRewriteForms(assessment, requirement),
      forbiddenRewriteForms: buildForbiddenRewriteForms(assessment, requirement),
      validationSeverityIfViolated: validationSeverityFor(requirement),
    }
  })
}

export function buildRewritePermissionsFromAssessment(
  assessment: JobCompatibilityAssessment,
  targetEvidence = buildTargetEvidenceFromAssessment(assessment),
): TargetedRewritePermissions {
  return {
    directClaimsAllowed: dedupe(
      targetEvidence
        .filter((evidence) => evidence.rewritePermission === 'can_claim_directly')
        .map((evidence) => evidence.canonicalSignal),
    ),
    normalizedClaimsAllowed: dedupe(
      targetEvidence
        .filter((evidence) => evidence.rewritePermission === 'can_claim_normalized')
        .map((evidence) => evidence.canonicalSignal),
    ),
    bridgeClaimsAllowed: targetEvidence
      .filter((evidence) =>
        evidence.rewritePermission === 'can_bridge_carefully'
        || evidence.rewritePermission === 'can_mention_as_related_context')
      .map(buildBridgeInstruction),
    relatedButNotClaimable: dedupe(
      targetEvidence
        .filter((evidence) => evidence.rewritePermission === 'can_mention_as_related_context')
        .map((evidence) => evidence.canonicalSignal),
    ),
    forbiddenClaims: dedupe(
      targetEvidence
        .filter((evidence) => evidence.rewritePermission === 'must_not_claim')
        .flatMap((evidence) => [
          evidence.canonicalSignal,
          ...evidence.forbiddenRewriteForms,
        ]),
    ),
    skillsSurfaceAllowed: dedupe(
      targetEvidence
        .filter((evidence) => (
          evidence.rewritePermission === 'can_claim_directly'
          || evidence.rewritePermission === 'can_claim_normalized'
        ))
        .map((evidence) => evidence.canonicalSignal),
    ),
  }
}

export function buildSafeTargetingEmphasisFromAssessment(
  assessment: JobCompatibilityAssessment,
  options: {
    targetEvidence?: TargetEvidence[]
    rewritePermissions?: TargetedRewritePermissions
  } = {},
): SafeTargetingEmphasis {
  const targetEvidence = options.targetEvidence ?? buildTargetEvidenceFromAssessment(assessment)
  const rewritePermissions = options.rewritePermissions
    ?? buildRewritePermissionsFromAssessment(assessment, targetEvidence)

  return {
    safeDirectEmphasis: dedupe([
      ...rewritePermissions.directClaimsAllowed,
      ...rewritePermissions.normalizedClaimsAllowed,
      ...targetEvidence
        .filter(isDirectClaimEvidence)
        .flatMap((evidence) => [
          evidence.canonicalSignal,
          ...evidence.matchedResumeTerms,
          ...evidence.allowedRewriteForms,
        ]),
    ]).slice(0, 16),
    cautiousBridgeEmphasis: targetEvidence
      .filter((evidence) =>
        evidence.rewritePermission === 'can_bridge_carefully'
        || evidence.rewritePermission === 'can_mention_as_related_context')
      .map((evidence) => ({
        jobSignal: evidence.canonicalSignal,
        safeWording: buildBridgeInstruction(evidence).safeBridge,
        supportingTerms: dedupe([
          ...evidence.matchedResumeTerms,
          ...evidence.supportingResumeSpans,
        ]).slice(0, 3),
        forbiddenWording: dedupe([
          evidence.canonicalSignal,
          ...evidence.forbiddenRewriteForms,
        ]),
      }))
      .slice(0, 10),
    forbiddenDirectClaims: dedupe([
      ...rewritePermissions.forbiddenClaims,
      ...targetEvidence
        .filter((evidence) => !isDirectClaimEvidence(evidence))
        .flatMap((evidence) => [
          evidence.canonicalSignal,
          ...evidence.forbiddenRewriteForms,
        ]),
    ]),
  }
}

export function buildCoreRequirementCoverageFromAssessment(
  assessment: JobCompatibilityAssessment,
): CoreRequirementCoverage {
  const requirements = assessment.requirements.map(toCoreRequirement)
  const coreAssessmentRequirements = assessment.requirements.filter((requirement) => requirement.importance === 'core')
  const supported = assessment.requirements.filter(isSupportedCoreRequirement).length
  const unsupportedSignals = dedupe(
    coreAssessmentRequirements
      .filter((requirement) => !isSupportedCoreRequirement(requirement))
      .map((requirement) => displaySignal(firstSignal(requirement))),
  )

  return {
    requirements,
    total: coreAssessmentRequirements.length,
    supported,
    unsupported: unsupportedSignals.length,
    unsupportedSignals,
    topUnsupportedSignalsForDisplay: buildUnsupportedDisplaySignals(assessment),
    preferredSignalsForDisplay: buildPreferredSignals(assessment),
  }
}

export function buildLowFitWarningGateFromAssessment(
  assessment: JobCompatibilityAssessment,
  options: {
    targetEvidence?: TargetEvidence[]
    coreRequirementCoverage?: CoreRequirementCoverage
  } = {},
): LowFitWarningGate {
  const targetEvidence = options.targetEvidence ?? buildTargetEvidenceFromAssessment(assessment)
  const coreRequirementCoverage = options.coreRequirementCoverage
    ?? buildCoreRequirementCoverageFromAssessment(assessment)
  const explicitEvidenceCount = targetEvidence.filter((evidence) => evidence.evidenceLevel === 'explicit').length
  const unsupportedGapCount = targetEvidence.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length
  const totalEvidence = targetEvidence.length

  return {
    triggered: assessment.lowFit.triggered || assessment.lowFit.blocking,
    reason: lowFitReasonForAssessment(assessment),
    matchScore: assessment.scoreBreakdown.total,
    riskLevel: assessment.lowFit.riskLevel,
    explicitEvidenceCount,
    unsupportedGapCount,
    unsupportedGapRatio: totalEvidence > 0 ? unsupportedGapCount / totalEvidence : 0,
    explicitEvidenceRatio: totalEvidence > 0 ? explicitEvidenceCount / totalEvidence : 0,
    coreRequirementCoverage,
  }
}

export function buildTargetRolePositioningFromAssessment(
  assessment: JobCompatibilityAssessment,
  options: {
    targetEvidence?: TargetEvidence[]
    coreRequirementCoverage?: CoreRequirementCoverage
  } = {},
): TargetRolePositioning {
  const targetEvidence = options.targetEvidence ?? buildTargetEvidenceFromAssessment(assessment)
  const coreRequirementCoverage = options.coreRequirementCoverage
    ?? buildCoreRequirementCoverageFromAssessment(assessment)
  const unsupportedCoreRatio = coreRequirementCoverage.total > 0
    ? coreRequirementCoverage.unsupported / coreRequirementCoverage.total
    : 0
  const safeRolePositioning = buildSafeRolePositioning(targetEvidence)

  if (
    assessment.lowFit.blocking
    || assessment.targetRoleConfidence === 'low'
    || assessment.scoreBreakdown.total < 45
    || unsupportedCoreRatio >= 0.7
  ) {
    return {
      targetRole: assessment.targetRole,
      permission: 'must_not_claim_target_role',
      reason: assessment.lowFit.reason ?? 'assessment_low_fit_or_low_confidence',
      safeRolePositioning,
      forbiddenRoleClaims: dedupe([
        assessment.targetRole,
        `experiência direta como ${assessment.targetRole}`,
      ]),
    }
  }

  if (
    assessment.scoreBreakdown.total < 80
    || coreRequirementCoverage.unsupported > 0
  ) {
    return {
      targetRole: assessment.targetRole,
      permission: 'can_bridge_to_target_role',
      reason: 'assessment_partial_fit',
      safeRolePositioning,
      forbiddenRoleClaims: [assessment.targetRole],
    }
  }

  return {
    targetRole: assessment.targetRole,
    permission: 'can_claim_target_role',
    reason: 'assessment_supported_fit',
    safeRolePositioning,
    forbiddenRoleClaims: [],
  }
}

export function buildDisplayScoreFromAssessment(
  assessment: JobCompatibilityAssessment,
): JobTargetingScoreBreakdown {
  return {
    total: assessment.scoreBreakdown.total,
    maxTotal: assessment.scoreBreakdown.maxTotal,
    items: SCORE_ITEMS.map((item) => ({
      ...item,
      score: assessment.scoreBreakdown.dimensions[item.id],
      max: 100,
    })),
    criticalGaps: dedupe(assessment.criticalGaps.map((gap) => displaySignal(gap.signal))).slice(0, 3),
  }
}

export function buildTargetRecommendationsFromAssessment(
  assessment: JobCompatibilityAssessment,
): TargetRecommendation[] {
  return assessment.criticalGaps.map((gap) => ({
    id: `assessment-${gap.id}`,
    kind: recommendationKindForGap(gap),
    priority: priorityForGap(gap),
    jobRequirement: displaySignal(gap.signal),
    currentEvidence: [],
    suggestedUserAction: `Adicione evidência real de ${displaySignal(gap.signal)} apenas se isso fizer parte da sua experiência.`,
    safeExample: `Mencione ${displaySignal(gap.signal)} somente com fatos comprováveis do seu histórico.`,
    mustNotInvent: true,
    relatedEvidenceLevel: 'unsupported_gap',
  })).slice(0, 6)
}

export function buildTargetingPlanFromAssessment(
  assessment: JobCompatibilityAssessment,
  options: BuildTargetingPlanFromAssessmentOptions = {},
): TargetingPlan {
  const adapterParts = buildAdapterParts(assessment)
  const basePlan = options.basePlan
  const sectionStrategy = options.sectionStrategy
    ?? basePlan?.sectionStrategy
    ?? buildFallbackSectionStrategy(assessment)

  return {
    ...(basePlan ?? {}),
    targetRole: assessment.targetRole,
    targetRoleConfidence: assessment.targetRoleConfidence,
    targetRoleSource: assessment.targetRoleSource,
    focusKeywords: options.focusKeywords ?? basePlan?.focusKeywords ?? dedupe(
      assessment.requirements.flatMap((requirement) => requirement.extractedSignals),
    ).slice(0, 16),
    mustEmphasize: options.mustEmphasize ?? basePlan?.mustEmphasize ?? adapterParts.safeTargetingEmphasis.safeDirectEmphasis,
    shouldDeemphasize: options.shouldDeemphasize ?? basePlan?.shouldDeemphasize ?? [],
    missingButCannotInvent: options.missingButCannotInvent ?? basePlan?.missingButCannotInvent ?? dedupe(
      assessment.criticalGaps.map((gap) => displaySignal(gap.signal)),
    ),
    sectionStrategy,
    ...adapterParts,
  }
}

export function buildJobTargetingExplanationFromAssessment(
  assessment: JobCompatibilityAssessment,
  options: BuildJobTargetingExplanationFromAssessmentOptions = {},
): JobTargetingExplanation {
  return {
    targetRole: assessment.targetRole,
    targetRoleConfidence: assessment.targetRoleConfidence,
    scoreBreakdown: buildDisplayScoreFromAssessment(assessment),
    targetRecommendations: buildTargetRecommendationsFromAssessment(assessment),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    source: 'job_targeting',
    version: 1,
  }
}
