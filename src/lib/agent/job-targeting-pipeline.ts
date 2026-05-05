import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { buildOverrideReviewHighlightState } from '@/lib/agent/highlight/override-review-highlights'
import { buildTargetedRewritePlan } from '@/lib/agent/tools/build-targeting-plan'
import { evaluateJobCompatibility } from '@/lib/agent/job-targeting/compatibility/assessment'
import { getJobCompatibilityAssessmentMode } from '@/lib/agent/job-targeting/compatibility/feature-flags'
import {
  runJobCompatibilityLlmAssessment,
  runJobCompatibilityLlmShadow,
} from '@/lib/agent/job-targeting/compatibility/llm-shadow'
import { summarizeHighlightState } from '@/lib/agent/highlight-observability'
import { evaluateCareerFitRisk } from '@/lib/agent/profile-review'
import {
  generateCvHighlightState,
  type HighlightDetectionOutcome,
} from '@/lib/agent/tools/detect-cv-highlights'
import {
  buildConservativeSummaryFallback,
  buildSummaryRetryInstructions,
  sanitizeText,
  sanitizeValidationResultForLogging,
  buildUserFacingValidationBlockModal,
  createBlockedTargetedRewriteDraft,
  isRecoverableValidationBlock,
  isSummaryOnlyRecoverableValidation,
} from '@/lib/agent/job-targeting/recoverable-validation'
import {
  buildTargetRecommendations,
  buildTargetRecommendationsFromAssessment,
} from '@/lib/agent/job-targeting/target-recommendations'
import { buildJobTargetingScoreBreakdownFromPlan } from '@/lib/agent/job-targeting/score-breakdown'
import {
  buildUserFriendlyJobReviewFromAssessment,
  buildUserFriendlyJobReviewFromTargetingEvidence,
} from '@/lib/agent/job-targeting/user-friendly-review'
import {
  applyLowFitWarningGateToValidation,
  shouldPreRewriteLowFitBlock,
} from '@/lib/agent/job-targeting/low-fit-warning-gate'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { rewriteSection } from '@/lib/agent/tools/rewrite-section'
import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
import { createCvVersion } from '@/lib/db/cv-versions'
import { createJobCompatibilityShadowComparison } from '@/lib/db/job-compatibility-shadow-comparison'
import { updateSession } from '@/lib/db/sessions'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { executeWithStageRetry } from '@/lib/agent/job-targeting-retry'
import { createJobTargetingLogContext } from '@/lib/agent/job-targeting-observability'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type { CoreRequirement, JobTargetingExplanation, Session, TargetEvidence } from '@/types/agent'
import type {
  GeneratedClaimTrace,
  JobCompatibilityAssessment,
  RequirementEvidenceSource,
} from '@/lib/agent/job-targeting/compatibility/types'
import type { JobTargetingTrace } from '@/types/trace'

type JobTargetingTraceDraft = Pick<JobTargetingTrace, 'sessionId' | 'userId' | 'startedAt'>
  & Partial<Omit<JobTargetingTrace, 'sessionId' | 'userId' | 'startedAt' | 'status'>>

function buildWorkflowRun(
  session: Session,
  patch: Partial<NonNullable<Session['agentState']['atsWorkflowRun']>>,
): NonNullable<Session['agentState']['atsWorkflowRun']> {
  const current = session.agentState.atsWorkflowRun

  return {
    status: current?.status ?? 'idle',
    attemptCount: current?.attemptCount ?? 0,
    retriedSections: current?.retriedSections ?? [],
    compactedSections: current?.compactedSections ?? [],
    sectionAttempts: current?.sectionAttempts ?? {},
    updatedAt: new Date().toISOString(),
    ...current,
    ...patch,
  }
}

async function persistAgentState(
  session: Session,
  agentState: Session['agentState'],
  options?: {
    skipDatabase?: boolean
  },
): Promise<void> {
  if (!options?.skipDatabase) {
    await updateSession(session.id, {
      agentState,
    })
  }
  session.agentState = agentState
}

function cvStatesMatch(
  left?: Session['cvState'],
  right?: Session['cvState'],
): boolean {
  if (!left || !right) {
    return false
  }

  return JSON.stringify(left) === JSON.stringify(right)
}

function logHighlightStatePersistence(params: {
  session: Session
  highlightState: Session['agentState']['highlightState']
  highlightDetectionInvoked: boolean
  highlightStateGenerated: boolean
  highlightStatePersisted: boolean
  highlightStatePersistedReason: string
  highlightDetectionOutcome?: HighlightDetectionOutcome
}): void {
  const summary = summarizeHighlightState(params.highlightState)

  logInfo('agent.highlight_state.persisted', {
    workflowMode: 'job_targeting',
    sessionId: params.session.id,
    userId: params.session.userId,
    stage: 'highlight_persistence',
    highlightDetectionInvoked: params.highlightDetectionInvoked,
    highlightStateGenerated: params.highlightStateGenerated,
    highlightStatePersisted: params.highlightStatePersisted,
    highlightStatePersistedReason: params.highlightStatePersistedReason,
    highlightStateResultKind: params.highlightDetectionOutcome?.resultKind,
    highlightStateResolvedItemCount: summary.highlightStateResolvedItemCount,
    highlightStateResolvedRangeCount: summary.highlightStateResolvedRangeCount,
    rawModelItemCount: params.highlightDetectionOutcome?.rawModelItemCount,
    rawModelRangeCount: params.highlightDetectionOutcome?.rawModelRangeCount,
    validatedItemCount: params.highlightDetectionOutcome?.validatedItemCount,
    validatedRangeCount: params.highlightDetectionOutcome?.validatedRangeCount,
  })
}

function normalizeKeywords(values: string[]): string[] {
  const seen = new Set<string>()

  return values
    .map((value) => value.trim())
    .filter((value) => value.length >= 3)
    .filter((value) => {
      const normalized = value.toLocaleLowerCase()
      if (seen.has(normalized)) {
        return false
      }

      seen.add(normalized)
      return true
    })
    .slice(0, 20)
}

function extractReasonKeywords(reasons: string[]): string[] {
  return reasons
    .map((reason) => reason.split(':').slice(1).join(':').trim() || reason.trim())
    .filter((reason) => reason.split(/\s+/u).length <= 4)
}

function extractJobDescriptionKeywords(targetJobDescription?: string): string[] {
  if (!targetJobDescription?.trim()) {
    return []
  }

  return targetJobDescription
    .split(/[\n,;|]/u)
    .flatMap((part) => part.split(/\b(?:and|e|with|com)\b/iu))
    .map((part) => part.replace(/^(?:cargo|responsabilidades|requisitos)\s*:\s*/iu, '').trim())
    .filter((part) => part.length >= 2 && part.split(/\s+/u).length <= 4)
}

function getIssueTypeList(issues: { issueType?: string }[]): string[] {
  return Array.from(new Set(
    issues
      .map((issue) => issue.issueType)
      .filter((issueType): issueType is string => Boolean(issueType)),
  ))
}

function extractJobKeywords(params: {
  gapAnalysis?: Session['agentState']['gapAnalysis']
  targetingPlan?: Session['agentState']['targetingPlan']
  targetFitAssessment?: Session['agentState']['targetFitAssessment']
  targetJobDescription?: string
}): string[] {
  const excludedTargetRole = params.targetingPlan?.targetRoleConfidence === 'low'
    ? params.targetingPlan.targetRole.trim().toLocaleLowerCase()
    : null

  const preferredSources = [
    params.gapAnalysis?.result?.missingSkills ?? [],
    params.targetingPlan?.mustEmphasize ?? [],
    params.targetingPlan?.focusKeywords ?? [],
    extractReasonKeywords(params.targetFitAssessment?.reasons ?? []),
    extractJobDescriptionKeywords(params.targetJobDescription),
  ]

  const selectedSource = preferredSources.find((source) => source.length > 0) ?? []

  return normalizeKeywords(selectedSource.filter((keyword) => (
    !excludedTargetRole || keyword.trim().toLocaleLowerCase() !== excludedTargetRole
  )))
}

function classifyHighlightGenerationGate(params: {
  acceptedLowFitOverride: boolean
  validationBlocked: boolean
  lowFitRecoverableBlocked: boolean
  optimizedChanged: boolean
}): 'allowed' | 'blocked_low_fit' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state' | 'skipped_after_override' {
  if (params.acceptedLowFitOverride) {
    return 'skipped_after_override'
  }

  if (params.lowFitRecoverableBlocked) {
    return 'blocked_low_fit'
  }

  if (params.validationBlocked) {
    return 'blocked_validation_failed'
  }

  if (!params.optimizedChanged) {
    return 'blocked_unchanged_cv_state'
  }

  return 'allowed'
}

function logHighlightGenerationGate(params: {
  session: Session
  gate: 'allowed' | 'blocked_low_fit' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state' | 'skipped_after_override'
  jobKeywordsCount: number
  validationBlocked: boolean
  lowFitRecoverableBlocked: boolean
  optimizedChanged: boolean
  targetRoleConfidence?: NonNullable<Session['agentState']['targetingPlan']>['targetRoleConfidence']
  targetRoleSource?: NonNullable<Session['agentState']['targetingPlan']>['targetRoleSource']
}): void {
  logInfo('agent.highlight_state.generation_gate', {
    workflowMode: 'job_targeting',
    sessionId: params.session.id,
    userId: params.session.userId,
    stage: 'highlight_generation_gate',
    highlightGenerationDecision: params.gate,
    jobKeywordsCount: params.jobKeywordsCount,
    validationBlocked: params.validationBlocked,
    lowFitRecoverableBlocked: params.lowFitRecoverableBlocked,
    optimizedChanged: params.optimizedChanged,
    targetRoleConfidence: params.targetRoleConfidence,
    targetRoleSource: params.targetRoleSource,
  })
}

function finalizeJobTargetingTrace(
  trace: JobTargetingTraceDraft,
  status: JobTargetingTrace['status'],
  extra?: Partial<Pick<JobTargetingTrace, 'error'>>,
): JobTargetingTrace {
  return {
    ...trace,
    ...extra,
    completedAt: new Date().toISOString(),
    status,
  }
}

function logJobTargetingPipelineTrace(
  trace: JobTargetingTraceDraft,
  status: JobTargetingTrace['status'],
  extra?: Partial<Pick<JobTargetingTrace, 'error'>>,
): void {
  logInfo('agent.job_targeting.pipeline_trace', finalizeJobTargetingTrace(trace, status, extra))
}

function summarizeValidationIssues(
  issues: NonNullable<Session['agentState']['rewriteValidation']>['issues'],
): Array<{ section?: string; message: string }> {
  return issues.map((issue) => ({
    section: issue.section,
    message: issue.message,
  }))
}

function countEvidenceLevels(targetEvidence: NonNullable<Session['agentState']['targetingPlan']>['targetEvidence']): Partial<Record<NonNullable<NonNullable<Session['agentState']['targetingPlan']>['targetEvidence']>[number]['evidenceLevel'], number>> {
  return (targetEvidence ?? []).reduce<Partial<Record<NonNullable<NonNullable<Session['agentState']['targetingPlan']>['targetEvidence']>[number]['evidenceLevel'], number>>>((counts, evidence) => {
    counts[evidence.evidenceLevel] = (counts[evidence.evidenceLevel] ?? 0) + 1
    return counts
  }, {})
}

function splitCoreAndPreferredRequirements(
  requirements: CoreRequirement[] = [],
): {
  coreRequirements: CoreRequirement[]
  preferredRequirements: CoreRequirement[]
} {
  return {
    coreRequirements: requirements.filter((requirement) => requirement.importance === 'core'),
    preferredRequirements: requirements.filter((requirement) => (
      requirement.importance === 'differential'
      || requirement.requirementKind === 'preferred'
      || requirement.requirementKind === 'nice_to_have'
    )),
  }
}

function collectSupportedSignals(targetEvidence: TargetEvidence[] = []): string[] {
  return Array.from(new Set(
    targetEvidence
      .filter((evidence) =>
        evidence.rewritePermission === 'can_claim_directly'
        || evidence.rewritePermission === 'can_claim_normalized')
      .flatMap((evidence) => [
        evidence.canonicalSignal,
        ...evidence.matchedResumeTerms,
        ...evidence.allowedRewriteForms,
      ])
      .map((value) => value.trim())
      .filter(Boolean),
  ))
}

function collectAdjacentSignals(targetEvidence: TargetEvidence[] = []): string[] {
  return Array.from(new Set(
    targetEvidence
      .filter((evidence) =>
        evidence.rewritePermission === 'can_bridge_carefully'
        || evidence.rewritePermission === 'can_mention_as_related_context'
        || evidence.evidenceLevel === 'strong_contextual_inference'
        || evidence.evidenceLevel === 'semantic_bridge_only')
      .flatMap((evidence) => [
        ...evidence.matchedResumeTerms,
        ...evidence.supportingResumeSpans,
        evidence.canonicalSignal,
      ])
      .map((value) => value.includes(':') ? value.split(':').slice(1).join(':').trim() : value.trim())
      .filter(Boolean),
  ))
}

function countInferredEvidence(targetEvidence: TargetEvidence[] = []): number {
  return targetEvidence.filter((evidence) => (
    evidence.evidenceLevel === 'strong_contextual_inference'
    || evidence.evidenceLevel === 'semantic_bridge_only'
  )).length
}

function countAssessmentRequirementSources(
  assessment: JobCompatibilityAssessment,
): {
  deterministicCount: number
  catalogCount: number
  llmCount: number
  fallbackCount: number
} {
  const deterministicSources = new Set<RequirementEvidenceSource>(['exact', 'composite_decomposition'])
  const catalogSources = new Set<RequirementEvidenceSource>([
    'catalog_alias',
    'catalog_category',
    'catalog_anti_equivalence',
  ])

  return assessment.requirements.reduce((counts, requirement) => {
    if (deterministicSources.has(requirement.source)) {
      counts.deterministicCount += 1
    } else if (catalogSources.has(requirement.source)) {
      counts.catalogCount += 1
    } else if (requirement.source === 'llm_ambiguous' || requirement.source === 'llm_semantic') {
      counts.llmCount += 1
    } else {
      counts.fallbackCount += 1
    }

    return counts
  }, {
    deterministicCount: 0,
    catalogCount: 0,
    llmCount: 0,
    fallbackCount: 0,
  })
}

function buildCompatibilityLogPayload(
  session: Session,
  assessment: JobCompatibilityAssessment,
) {
  const sourceCounts = countAssessmentRequirementSources(assessment)

  return {
    workflowMode: 'job_targeting',
    sessionId: session.id,
    userId: session.userId,
    assessmentVersion: assessment.audit.assessmentVersion,
    requirementExtractionVersion: assessment.audit.requirementExtractionVersion,
    evidenceExtractionVersion: assessment.audit.evidenceExtractionVersion,
    matcherVersion: assessment.audit.matcherVersion,
    claimPolicyVersion: assessment.audit.claimPolicyVersion,
    scoreVersion: assessment.audit.scoreVersion,
    catalogIds: assessment.catalog.catalogIds,
    catalogVersions: assessment.catalog.catalogVersions,
    totalRequirements: assessment.requirements.length,
    supportedCount: assessment.supportedRequirements.length,
    adjacentCount: assessment.adjacentRequirements.length,
    unsupportedCount: assessment.unsupportedRequirements.length,
    criticalGapCount: assessment.criticalGaps.length,
    allowedClaimCount: assessment.claimPolicy.allowedClaims.length,
    cautiousClaimCount: assessment.claimPolicy.cautiousClaims.length,
    forbiddenClaimCount: assessment.claimPolicy.forbiddenClaims.length,
    lowFitTriggered: assessment.lowFit.triggered,
    lowFitBlocking: assessment.lowFit.blocking,
    ...sourceCounts,
  }
}

function logCompatibilityAssessmentLifecycle(
  session: Session,
  assessment: JobCompatibilityAssessment,
): void {
  const payload = buildCompatibilityLogPayload(session, assessment)

  logInfo('job_targeting.compatibility.catalog_loaded', payload)
  logInfo('job_targeting.compatibility.requirements_extracted', payload)
  logInfo('job_targeting.compatibility.evidence_classified', payload)
  logInfo('job_targeting.compatibility.claim_policy_built', payload)
  logInfo('job_targeting.compatibility.score_calculated', payload)
  logInfo('job_targeting.compatibility.completed', payload)
}

async function recordCompatibilityShadowComparison(params: {
  session: Session
  assessment: JobCompatibilityAssessment
  targetingPlan: NonNullable<Session['agentState']['targetingPlan']>
  gapAnalysisScore: number
}): Promise<void> {
  const legacyScore = params.targetingPlan.lowFitWarningGate?.matchScore ?? params.gapAnalysisScore
  const assessmentScore = params.assessment.scoreBreakdown.total
  const legacyCriticalGapsCount = params.targetingPlan.coreRequirementCoverage?.unsupported ?? 0
  const assessmentCriticalGapsCount = params.assessment.criticalGaps.length
  const legacyLowFitTriggered = params.targetingPlan.lowFitWarningGate?.triggered ?? false
  const assessmentLowFitTriggered = params.assessment.lowFit.triggered
  const legacyUnsupportedCount = params.targetingPlan.targetEvidence?.filter((item) => (
    item.evidenceLevel === 'unsupported_gap'
  )).length ?? 0

  logInfo('job_targeting.compatibility.shadow_comparison', {
    sessionId: params.session.id,
    userId: params.session.userId,
    legacyScore,
    assessmentScore,
    scoreDelta: assessmentScore - legacyScore,
    legacyCriticalGapsCount,
    assessmentCriticalGapsCount,
    criticalGapDelta: assessmentCriticalGapsCount - legacyCriticalGapsCount,
    legacyLowFitTriggered,
    assessmentLowFitTriggered,
    lowFitDelta: legacyLowFitTriggered !== assessmentLowFitTriggered,
    legacyUnsupportedCount,
    assessmentUnsupportedCount: params.assessment.unsupportedRequirements.length,
    assessmentSupportedCount: params.assessment.supportedRequirements.length,
    assessmentAdjacentCount: params.assessment.adjacentRequirements.length,
    assessmentForbiddenClaimCount: params.assessment.claimPolicy.forbiddenClaims.length,
    assessmentVersion: params.assessment.audit.assessmentVersion,
    scoreVersion: params.assessment.audit.scoreVersion,
    catalogVersion: Object.entries(params.assessment.catalog.catalogVersions)
      .map(([id, version]) => `${id}@${version}`)
      .join(','),
    generatedAt: new Date().toISOString(),
  })

  try {
    await createJobCompatibilityShadowComparison({
      userId: params.session.userId,
      sessionId: params.session.id,
      source: 'pipeline_shadow',
      legacy: {
        score: legacyScore,
        lowFitTriggered: legacyLowFitTriggered,
        unsupportedCount: legacyUnsupportedCount,
        criticalGaps: params.targetingPlan.coreRequirementCoverage?.topUnsupportedSignalsForDisplay
          ?? params.targetingPlan.coreRequirementCoverage?.unsupportedSignals
          ?? [],
      },
      assessment: params.assessment,
    })
  } catch (error) {
    logWarn('job_targeting.compatibility.shadow_comparison_persist_failed', {
      sessionId: params.session.id,
      userId: params.session.userId,
      error: serializeError(error),
    })
  }
}

function buildJobTargetingExplanation(params: {
  session: Session
  optimizedCvState: Session['cvState']
  targetingPlan: NonNullable<Session['agentState']['targetingPlan']>
}): JobTargetingExplanation {
  const assessment = params.session.agentState.jobCompatibilityAssessment
  const { coreRequirements, preferredRequirements } = splitCoreAndPreferredRequirements(
    params.targetingPlan.coreRequirementCoverage?.requirements ?? [],
  )
  const supportedSignals = collectSupportedSignals(params.targetingPlan.targetEvidence)
  const adjacentSignals = collectAdjacentSignals(params.targetingPlan.targetEvidence)

  return {
    targetRole: params.targetingPlan.targetRole,
    targetRoleConfidence: params.targetingPlan.targetRoleConfidence,
    scoreBreakdown: buildJobTargetingScoreBreakdownFromPlan({
      targetingPlan: params.targetingPlan,
      cvState: params.session.cvState,
      jobCompatibilityAssessment: assessment,
    }),
    userFriendlyReview: assessment
      ? buildUserFriendlyJobReviewFromAssessment(assessment)
      : undefined,
    targetRecommendations: assessment
      ? buildTargetRecommendationsFromAssessment(assessment)
      : buildTargetRecommendations({
        targetRole: params.targetingPlan.targetRole,
        coreRequirements,
        preferredRequirements,
        supportedSignals,
        adjacentSignals,
        resumeSkillSignals: params.session.cvState.skills,
      }),
    generatedAt: new Date().toISOString(),
    source: 'job_targeting',
    version: 1,
  }
}

function resolveEvidenceRatios(targetEvidence: NonNullable<Session['agentState']['targetingPlan']>['targetEvidence'] = []) {
  const total = targetEvidence.length
  const explicitEvidenceCount = targetEvidence.filter((evidence) => evidence.evidenceLevel === 'explicit').length
  const unsupportedGapCount = targetEvidence.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length

  return {
    explicitEvidenceCount,
    unsupportedGapCount,
    explicitEvidenceRatio: total > 0 ? explicitEvidenceCount / total : 0,
    unsupportedGapRatio: total > 0 ? unsupportedGapCount / total : 0,
  }
}

function replaceSummaryGeneratedClaimTrace(
  traces: GeneratedClaimTrace[] | undefined,
  summary: string,
): GeneratedClaimTrace[] | undefined {
  if (!traces) {
    return undefined
  }

  let replaced = false
  const nextTraces = traces.map((trace) => {
    if (trace.section !== 'summary') {
      return trace
    }

    replaced = true
    return {
      ...trace,
      itemPath: trace.itemPath || 'summary',
      generatedText: summary,
      expressedSignals: [],
      usedClaimPolicyIds: [],
      evidenceBasis: [],
      prohibitedTermsFound: [],
      validationStatus: 'valid' as const,
      source: 'formatting_only' as const,
      classificationStatus: 'formatting_only' as const,
      rationale: 'summary_rewritten_after_validation_retry',
      unclassifiedText: undefined,
    }
  })

  if (replaced) {
    return nextTraces
  }

  return [
    ...nextTraces,
    {
      section: 'summary',
      itemPath: 'summary',
      generatedText: summary,
      expressedSignals: [],
      usedClaimPolicyIds: [],
      evidenceBasis: [],
      prohibitedTermsFound: [],
      validationStatus: 'valid',
      source: 'formatting_only',
      classificationStatus: 'formatting_only',
      rationale: 'summary_rewritten_after_validation_retry',
    },
  ]
}

const ACCEPTED_LOW_FIT_AUDIT_ONLY_ISSUE_TYPES = new Set([
  'low_fit_target_role',
  'target_role_overclaim',
  'summary_skill_without_evidence',
  'unsupported_claim',
  'unsupported_skill',
  'unsupported_certification',
  'unsupported_education',
  'seniority_inflation',
  'ungrounded_bridge',
  'forbidden_claim',
] satisfies NonNullable<NonNullable<Session['agentState']['rewriteValidation']>['issues'][number]['issueType']>[])

const NON_OVERRIDABLE_STRUCTURED_CLAIM_POLICY_CODES = new Set([
  'forbidden_term',
  'unsafe_direct_claim',
  'unsupported_skill_added',
  'unsupported_certification',
  'unsupported_education_claim',
  'target_role_asserted_without_permission',
  'missing_claim_trace',
  'unsupported_expressed_signal',
])

type RewriteValidation = NonNullable<Session['agentState']['rewriteValidation']>
type RewriteValidationIssue = RewriteValidation['issues'][number]

function isNonOverridableStructuredIssue(issue: RewriteValidationIssue): boolean {
  return issue.code !== undefined && NON_OVERRIDABLE_STRUCTURED_CLAIM_POLICY_CODES.has(issue.code)
}

function isAcceptedLowFitAuditOnlyIssue(issue: RewriteValidationIssue): boolean {
  return Boolean(
    issue.issueType
    && ACCEPTED_LOW_FIT_AUDIT_ONLY_ISSUE_TYPES.has(issue.issueType)
    && !isNonOverridableStructuredIssue(issue),
  )
}

export function shouldBlockAfterAcceptedOverride(validation: NonNullable<Session['agentState']['rewriteValidation']>): boolean {
  return validation.hardIssues.some((issue) => !isAcceptedLowFitAuditOnlyIssue(issue))
}

export function relaxValidationForAcceptedLowFitOverride(
  validation: NonNullable<Session['agentState']['rewriteValidation']>,
): NonNullable<Session['agentState']['rewriteValidation']> {
  const remainingHardIssues = validation.hardIssues
    .filter((issue) => !isAcceptedLowFitAuditOnlyIssue(issue))
  const downgradedHardIssues = validation.hardIssues
    .filter(isAcceptedLowFitAuditOnlyIssue)
    .map((issue) => ({
      ...issue,
      severity: 'medium' as const,
    }))

  const remainingSoftWarnings = [
    ...validation.softWarnings,
    ...downgradedHardIssues,
  ]

  return {
    ...validation,
    blocked: remainingHardIssues.length > 0,
    recoverable: remainingHardIssues.length > 0 ? validation.recoverable : false,
    valid: remainingHardIssues.length === 0 && remainingSoftWarnings.length === 0,
    hardIssues: remainingHardIssues,
    softWarnings: remainingSoftWarnings,
    issues: [
      ...remainingHardIssues,
      ...remainingSoftWarnings,
    ],
  }
}

export function buildAcceptedLowFitFallbackCvState(params: {
  originalCvState: Session['cvState']
  targetingPlan: NonNullable<Session['agentState']['targetingPlan']>
}): Session['cvState'] {
  const directSignals = params.targetingPlan.safeTargetingEmphasis?.safeDirectEmphasis.slice(0, 4) ?? []
  const fallbackSummary = directSignals.length > 0
    ? `Profissional com experiência em ${directSignals.join(', ')}.`
    : params.originalCvState.summary

  return {
    ...structuredClone(params.originalCvState),
    summary: fallbackSummary,
  }
}

export async function runJobTargetingPipeline(
  session: Session,
  options?: {
    userAcceptedLowFit?: boolean
    overrideReason?: 'pre_rewrite_low_fit_block' | 'post_rewrite_validation_block'
    skipPreRewriteLowFitBlock?: boolean
    skipLowFitRecoverableBlocking?: boolean
    deferSessionPersistence?: boolean
  },
): Promise<{
  success: boolean
  optimizedCvState?: Session['agentState']['optimizedCvState']
  optimizationSummary?: Session['agentState']['optimizationSummary']
  jobTargetingExplanation?: Session['agentState']['jobTargetingExplanation']
  validation?: Session['agentState']['rewriteValidation']
  recoverableBlock?: Session['agentState']['recoverableValidationBlock']
  acceptedLowFitFallbackUsed?: boolean
  cvVersionId?: string
  error?: string
}> {
  const previousOptimizedCvState = session.agentState.optimizedCvState
    ? structuredClone(session.agentState.optimizedCvState)
    : undefined
  const previousHighlightState = session.agentState.highlightState
    ? structuredClone(session.agentState.highlightState)
    : undefined
  const previousOptimizedAt = session.agentState.optimizedAt
  const previousOptimizationSummary = session.agentState.optimizationSummary
    ? structuredClone(session.agentState.optimizationSummary)
    : undefined
  const previousJobTargetingExplanation = session.agentState.jobTargetingExplanation
    ? structuredClone(session.agentState.jobTargetingExplanation)
    : undefined

  const persistPipelineAgentState = (agentState: Session['agentState']): Promise<void> => (
    persistAgentState(session, agentState, {
      skipDatabase: options?.deferSessionPersistence === true,
    })
  )
  const previousLastRewriteMode = session.agentState.lastRewriteMode
  const trace: JobTargetingTraceDraft = {
    sessionId: session.id,
    userId: session.userId,
    startedAt: new Date().toISOString(),
  }
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  if (!targetJobDescription) {
    logJobTargetingPipelineTrace(trace, 'failed', {
      error: 'Target job description is required for job targeting.',
    })
    return {
      success: false,
      error: 'Target job description is required for job targeting.',
    }
  }

  await persistPipelineAgentState({
    ...session.agentState,
    workflowMode: 'job_targeting',
    rewriteStatus: 'running',
    atsWorkflowRun: buildWorkflowRun(session, {
      status: 'running',
      currentStage: 'gap_analysis',
      attemptCount: 0,
      retriedSections: [],
      compactedSections: [],
      sectionAttempts: {},
      lastFailureReason: undefined,
      lastFailureSection: undefined,
      lastFailureStage: undefined,
    }),
  })

  logInfo('agent.job_targeting.started', createJobTargetingLogContext(session, 'gap_analysis'))

  const gapAnalysisExecution = await executeWithStageRetry(
    async (attempt) => {
      session.agentState.atsWorkflowRun = buildWorkflowRun(session, {
        currentStage: 'gap_analysis',
        attemptCount: attempt,
      })

      const execution = await analyzeGap(
        session.cvState,
        targetJobDescription,
        session.userId,
        session.id,
      )

      if (!execution.output.success || !execution.result) {
        throw new Error('error' in execution.output ? execution.output.error : 'Gap analysis failed.')
      }

      return execution
    },
    {
      onRetry: (_error, attempt) => {
        logWarn(
          'agent.job_targeting.retry',
          createJobTargetingLogContext(session, 'gap_analysis', { attempt: attempt + 1 }),
        )
      },
    },
  ).then(({ result }) => result).catch(async (error) => {
    const nextAgentState: Session['agentState'] = {
      ...session.agentState,
      workflowMode: 'job_targeting',
      rewriteStatus: 'failed',
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'gap_analysis',
        lastFailureStage: 'gap_analysis',
        lastFailureReason: error instanceof Error ? error.message : 'Gap analysis failed.',
      }),
    }
    await persistPipelineAgentState(nextAgentState)
    logError(
      'agent.job_targeting.failed',
      createJobTargetingLogContext(session, 'gap_analysis', {
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
    )
    return null
  })

  if (!gapAnalysisExecution) {
    logJobTargetingPipelineTrace(trace, 'failed', {
      error: session.agentState.atsWorkflowRun?.lastFailureReason ?? 'Gap analysis failed.',
    })
    return {
      success: false,
      error: session.agentState.atsWorkflowRun?.lastFailureReason ?? 'Gap analysis failed.',
    }
  }

  const gapAnalysisResult = gapAnalysisExecution.result
  if (!gapAnalysisResult) {
    const errorMessage = 'Gap analysis did not return a validated result.'
    logJobTargetingPipelineTrace(trace, 'failed', { error: errorMessage })
    return {
      success: false,
      error: errorMessage,
    }
  }

  const analyzedAt = new Date().toISOString()
  const gapAnalysis = {
    result: gapAnalysisResult,
    analyzedAt,
  } satisfies NonNullable<Session['agentState']['gapAnalysis']>
  trace.gapAnalysis = {
    matchScore: gapAnalysisResult.matchScore,
    missingSkillsCount: gapAnalysisResult.missingSkills.length,
    weakAreasCount: gapAnalysisResult.weakAreas.length,
    repairAttempted: gapAnalysisExecution.repairAttempted,
  }
  const targetFitAssessment = deriveTargetFitAssessment(gapAnalysisResult, analyzedAt)
  const careerFitEvaluation = evaluateCareerFitRisk({
    cvState: session.cvState,
    agentState: {
      ...session.agentState,
      targetJobDescription,
      gapAnalysis,
      targetFitAssessment,
    },
  })
  const compatibilityMode = getJobCompatibilityAssessmentMode()
  let evaluatedJobCompatibilityAssessment: JobCompatibilityAssessment | undefined

  if (compatibilityMode.sourceOfTruthBlocked) {
    logWarn('job_targeting.compatibility.source_of_truth_blocked_without_cutover_approval', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
      userId: session.userId,
      sourceOfTruthRequested: compatibilityMode.sourceOfTruthRequested,
      cutoverApproved: compatibilityMode.cutoverApproved,
      effectiveShadowMode: compatibilityMode.shadowMode,
    })
  }

  if (compatibilityMode.enabled) {
    logInfo('job_targeting.compatibility.started', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
      userId: session.userId,
      cvStatePresent: true,
      targetJobDescriptionPresent: true,
      gapAnalysisPresent: true,
      careerFitEvaluationPresent: Boolean(careerFitEvaluation),
      shadowMode: compatibilityMode.shadowMode,
      sourceOfTruth: compatibilityMode.sourceOfTruth,
    })
    if (compatibilityMode.sourceOfTruth) {
      evaluatedJobCompatibilityAssessment = await runJobCompatibilityLlmAssessment({
        cvState: session.cvState,
        targetJobDescription,
        gapAnalysis: gapAnalysisResult,
        userId: session.userId,
        sessionId: session.id,
      }).catch(async (error) => {
        logWarn('job_targeting.compatibility.llm_source_of_truth_failed_legacy_fallback', {
          workflowMode: 'job_targeting',
          sessionId: session.id,
          userId: session.userId,
          ...serializeError(error),
        })

        return evaluateJobCompatibility({
          cvState: session.cvState,
          targetJobDescription,
          gapAnalysis: gapAnalysisResult,
          userId: session.userId,
          sessionId: session.id,
        })
      })
    } else {
      evaluatedJobCompatibilityAssessment = await evaluateJobCompatibility({
        cvState: session.cvState,
        targetJobDescription,
        gapAnalysis: gapAnalysisResult,
        userId: session.userId,
        sessionId: session.id,
      })
    }
    logCompatibilityAssessmentLifecycle(session, evaluatedJobCompatibilityAssessment)
  }

  if (compatibilityMode.shadowMode) {
    await runJobCompatibilityLlmShadow({
      cvState: session.cvState,
      targetJobDescription,
      userId: session.userId,
      sessionId: session.id,
    }).catch((error) => {
      logWarn('job_targeting.matcher.llm.shadow_failed', {
        workflowMode: 'job_targeting',
        sessionId: session.id,
        userId: session.userId,
        ...serializeError(error),
      })
    })
  }

  const jobCompatibilityAssessment = compatibilityMode.sourceOfTruth
    ? evaluatedJobCompatibilityAssessment
    : undefined
  const compatibilityStatePatch: Partial<Session['agentState']> = {
    ...(jobCompatibilityAssessment === undefined ? {} : { jobCompatibilityAssessment }),
    ...(compatibilityMode.shadowMode && evaluatedJobCompatibilityAssessment
      ? { jobCompatibilityAssessmentShadow: evaluatedJobCompatibilityAssessment }
      : {}),
  }

  await persistPipelineAgentState({
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
    ...compatibilityStatePatch,
    atsWorkflowRun: buildWorkflowRun(session, {
      currentStage: 'targeting_plan',
    }),
  })

  if (careerFitEvaluation) {
    logInfo('career_fit_evaluated', {
      sessionId: session.id,
      riskLevel: careerFitEvaluation.riskLevel,
      riskPoints: careerFitEvaluation.riskPoints,
      signals: JSON.stringify({
        matchScore: careerFitEvaluation.signals.matchScore ?? null,
        missingSkillsCount: careerFitEvaluation.signals.missingSkillsCount ?? null,
        weakAreasCount: careerFitEvaluation.signals.weakAreasCount ?? null,
        familyDistance: careerFitEvaluation.signals.familyDistance ?? null,
        seniorityGapMajor: careerFitEvaluation.signals.seniorityGapMajor,
      }),
    })
  }

  const targetingPlan = await buildTargetedRewritePlan({
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    userId: session.userId,
    sessionId: session.id,
    mode: 'job_targeting',
    rewriteIntent: 'targeted_rewrite',
    careerFitEvaluation: careerFitEvaluation ?? undefined,
    ...(jobCompatibilityAssessment === undefined ? {} : { jobCompatibilityAssessment }),
  })
  if (compatibilityMode.shadowMode && evaluatedJobCompatibilityAssessment) {
    await recordCompatibilityShadowComparison({
      session,
      assessment: evaluatedJobCompatibilityAssessment,
      targetingPlan,
      gapAnalysisScore: gapAnalysisResult.matchScore,
    })
  }
  const jobKeywords = extractJobKeywords({
    gapAnalysis,
    targetingPlan,
    targetFitAssessment,
    targetJobDescription,
  })
  const evidenceRatios = resolveEvidenceRatios(targetingPlan.targetEvidence)
  trace.extraction = {
    targetRole: targetingPlan.targetRole,
    targetRoleConfidence: targetingPlan.targetRoleConfidence,
    targetRoleSource: targetingPlan.targetRoleSource,
    extractionWarning: targetingPlan.targetRoleConfidence === 'low'
      ? 'low_confidence_role'
      : undefined,
    jobKeywordsCount: jobKeywords.length,
    targetEvidenceCount: targetingPlan.targetEvidence
      ? targetingPlan.targetEvidence.length
      : undefined,
    evidenceLevelCounts: targetingPlan.targetEvidence
      ? countEvidenceLevels(targetingPlan.targetEvidence)
      : undefined,
  }
  trace.lowFitGate = {
    evaluated: Boolean(targetingPlan.lowFitWarningGate),
    triggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
    reason: targetingPlan.lowFitWarningGate?.reason,
    acceptedByUser: options?.userAcceptedLowFit === true,
    blockingSkipped: options?.skipLowFitRecoverableBlocking === true,
    matchScore: targetingPlan.lowFitWarningGate?.matchScore ?? gapAnalysisResult.matchScore,
    riskLevel: targetingPlan.lowFitWarningGate?.riskLevel,
    familyDistance: targetingPlan.lowFitWarningGate?.familyDistance,
    explicitEvidenceCount: targetingPlan.lowFitWarningGate?.explicitEvidenceCount ?? evidenceRatios.explicitEvidenceCount,
    unsupportedGapCount: targetingPlan.lowFitWarningGate?.unsupportedGapCount ?? evidenceRatios.unsupportedGapCount,
    unsupportedGapRatio: targetingPlan.lowFitWarningGate?.unsupportedGapRatio ?? evidenceRatios.unsupportedGapRatio,
    explicitEvidenceRatio: targetingPlan.lowFitWarningGate?.explicitEvidenceRatio ?? evidenceRatios.explicitEvidenceRatio,
    coreRequirementCoverage: targetingPlan.lowFitWarningGate?.coreRequirementCoverage ?? {
      total: targetingPlan.coreRequirementCoverage?.total ?? 0,
      supported: targetingPlan.coreRequirementCoverage?.supported ?? 0,
      unsupported: targetingPlan.coreRequirementCoverage?.unsupported ?? 0,
      unsupportedSignals: targetingPlan.coreRequirementCoverage?.unsupportedSignals ?? [],
      topUnsupportedSignalsForDisplay: targetingPlan.coreRequirementCoverage?.topUnsupportedSignalsForDisplay ?? [],
    },
  }

  await persistPipelineAgentState({
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
    ...compatibilityStatePatch,
    targetingPlan,
    atsWorkflowRun: buildWorkflowRun(session, {
      currentStage: 'rewrite_plan',
    }),
  })

  if (targetingPlan.targetRoleConfidence === 'low') {
    logWarn('agent.job_targeting.low_confidence_role_extraction', {
      sessionId: session.id,
      userId: session.userId,
      workflowMode: 'job_targeting',
      stage: 'targeting_plan',
      targetRoleSource: targetingPlan.targetRoleSource,
    })

    await persistPipelineAgentState({
      ...session.agentState,
      workflowMode: 'job_targeting',
      gapAnalysis,
      targetFitAssessment,
      careerFitEvaluation: careerFitEvaluation ?? undefined,
      ...compatibilityStatePatch,
      targetingPlan,
      extractionWarning: 'low_confidence_role',
      atsWorkflowRun: buildWorkflowRun(session, {
        currentStage: 'rewrite_plan',
      }),
    })
  }

  logInfo(
    'agent.job_targeting.plan_built',
    createJobTargetingLogContext(session, 'targeting_plan', {
      targetRole: targetingPlan.targetRole,
      targetRoleConfidence: targetingPlan.targetRoleConfidence,
      targetRoleSource: targetingPlan.targetRoleSource,
      emphasizeCount: targetingPlan.mustEmphasize.length,
      missingCount: targetingPlan.missingButCannotInvent.length,
      targetEvidenceCount: targetingPlan.targetEvidence?.length,
      targetRolePermission: targetingPlan.targetRolePositioning?.permission,
      unsupportedGapRatio: evidenceRatios.unsupportedGapRatio,
      explicitEvidenceRatio: evidenceRatios.explicitEvidenceRatio,
      lowFitGateTriggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
      lowFitGateReason: targetingPlan.lowFitWarningGate?.reason,
      coreRequirementCoverageSupported: targetingPlan.coreRequirementCoverage?.supported,
      coreRequirementCoverageUnsupported: targetingPlan.coreRequirementCoverage?.unsupported,
      explicitSkillCount: targetingPlan.targetEvidence?.filter((evidence) => evidence.evidenceLevel === 'explicit').length ?? 0,
      inferredSkillCount: countInferredEvidence(targetingPlan.targetEvidence),
      missingEvidenceCount: targetingPlan.targetEvidence?.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length ?? 0,
    }),
  )

  logInfo('agent.job_targeting.low_fit_gate.evaluated', {
    sessionId: session.id,
    userId: session.userId,
    workflowMode: 'job_targeting',
    stage: 'targeting_plan',
    targetRole: targetingPlan.targetRole,
    matchScore: targetingPlan.lowFitWarningGate?.matchScore ?? gapAnalysisResult.matchScore,
    riskLevel: targetingPlan.lowFitWarningGate?.riskLevel,
    familyDistance: targetingPlan.lowFitWarningGate?.familyDistance,
    unsupportedGapRatio: targetingPlan.lowFitWarningGate?.unsupportedGapRatio ?? evidenceRatios.unsupportedGapRatio,
    explicitEvidenceRatio: targetingPlan.lowFitWarningGate?.explicitEvidenceRatio ?? evidenceRatios.explicitEvidenceRatio,
    triggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
    reason: targetingPlan.lowFitWarningGate?.reason,
    acceptedByUser: options?.userAcceptedLowFit === true,
    blockingSkipped: options?.skipLowFitRecoverableBlocking === true,
    coreUnsupportedSignals: targetingPlan.lowFitWarningGate?.coreRequirementCoverage.unsupportedSignals ?? [],
    explicitSkillCount: targetingPlan.targetEvidence?.filter((evidence) => evidence.evidenceLevel === 'explicit').length ?? 0,
    inferredSkillCount: countInferredEvidence(targetingPlan.targetEvidence),
    missingEvidenceCount: targetingPlan.targetEvidence?.filter((evidence) => evidence.evidenceLevel === 'unsupported_gap').length ?? 0,
  })

  const preRewriteLowFitBlocked = shouldPreRewriteLowFitBlock({
    lowFitWarningGate: targetingPlan.lowFitWarningGate,
    skipPreRewriteLowFitBlock: options?.skipPreRewriteLowFitBlock === true || options?.userAcceptedLowFit === true,
  })

  if (preRewriteLowFitBlocked) {
    recordMetricCounter('compatibility.probable_detected', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
      riskLevel: targetingPlan.lowFitWarningGate?.riskLevel,
    })
    let validation = applyLowFitWarningGateToValidation({
      validation: {
        blocked: false,
        valid: true,
        hardIssues: [],
        softWarnings: [],
        issues: [],
      },
      lowFitWarningGate: targetingPlan.lowFitWarningGate,
      targetRole: targetingPlan.targetRole,
      targetRolePositioning: targetingPlan.targetRolePositioning,
    })
    validation = sanitizeValidationResultForLogging({
      ...validation,
      recoverable: true,
    })

    trace.rewrite = {
      sectionsAttempted: [],
      sectionsChanged: [],
      sectionsRetried: [],
      sectionsCompacted: [],
      skippedReason: 'pre_rewrite_low_fit_block',
    }
    trace.validation = {
      blocked: true,
      hardIssuesCount: validation.hardIssues.length,
      softWarningsCount: validation.softWarnings.length,
      hardIssues: summarizeValidationIssues(validation.hardIssues),
      softWarnings: summarizeValidationIssues(validation.softWarnings),
      failureStage: 'pre_rewrite_low_fit_block',
      recoverable: true,
      promotedWarnings: validation.promotedWarnings,
    }
    if (trace.lowFitGate) {
      trace.lowFitGate.preRewriteBlocked = true
      trace.lowFitGate.preRewriteBlockReason = targetingPlan.lowFitWarningGate?.reason
    }
    trace.highlight = {
      gate: 'blocked_low_fit',
      generated: false,
      jobKeywordsCount: jobKeywords.length,
    }

    const blockedDraft = createBlockedTargetedRewriteDraft({
      sessionId: session.id,
      userId: session.userId,
      kind: 'pre_rewrite_low_fit_block',
      originalCvState: session.cvState,
      targetJobDescription,
      targetRole: targetingPlan.targetRole,
      validationIssues: validation.issues,
      lowFitGate: targetingPlan.lowFitWarningGate,
      targetEvidence: targetingPlan.targetEvidence,
      safeTargetingEmphasis: targetingPlan.safeTargetingEmphasis,
      coreRequirementCoverage: targetingPlan.coreRequirementCoverage,
      recoverable: true,
    })
    const recoverableValidationBlock = {
      status: 'validation_blocked_recoverable' as const,
      kind: 'pre_rewrite_low_fit_block' as const,
      overrideToken: blockedDraft.token,
      modal: buildUserFacingValidationBlockModal({
        targetRole: targetingPlan.targetRole,
        validationIssues: validation.issues,
        targetEvidence: targetingPlan.targetEvidence,
        lowFitWarningGate: targetingPlan.lowFitWarningGate,
        directClaimsAllowed: targetingPlan.rewritePermissions?.directClaimsAllowed,
        originalProfileLabel: sanitizeText(targetingPlan.targetRolePositioning?.safeRolePositioning ?? '')
          .replace(/^Profissional com experi[êe]ncia em\s*/i, '')
          .replace(/[.]$/u, '') || undefined,
      }),
      userFriendlyReview: buildUserFriendlyJobReviewFromTargetingEvidence({
        targetEvidence: targetingPlan.targetEvidence,
        lowFitWarningGate: targetingPlan.lowFitWarningGate,
      }),
      expiresAt: blockedDraft.expiresAt,
    }
    const validationIssueMessages = validation.issues.map((issue) => issue.message)
    const nextAgentState: Session['agentState'] = {
      ...session.agentState,
      workflowMode: 'job_targeting',
      gapAnalysis,
      targetFitAssessment,
      careerFitEvaluation: careerFitEvaluation ?? undefined,
      ...compatibilityStatePatch,
      targetingPlan,
      extractionWarning: targetingPlan.targetRoleConfidence === 'low' ? 'low_confidence_role' : undefined,
      rewriteStatus: 'failed',
      optimizedCvState: previousOptimizedCvState,
      highlightState: previousHighlightState,
      jobTargetingExplanation: previousJobTargetingExplanation,
      optimizedAt: previousOptimizedAt,
      optimizationSummary: previousOptimizationSummary,
      lastRewriteMode: previousLastRewriteMode,
      rewriteValidation: validation,
      blockedTargetedRewriteDraft: blockedDraft,
      recoverableValidationBlock,
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'pre_rewrite_low_fit_block',
        lastFailureStage: 'pre_rewrite_low_fit_block',
        lastFailureReason: validationIssueMessages[0]
          ? `Job targeting pre-rewrite low-fit block: ${validationIssueMessages[0]}`
          : 'Job targeting pre-rewrite low-fit block triggered.',
      }),
    }
    await persistPipelineAgentState(nextAgentState)

    logHighlightGenerationGate({
      session,
      gate: 'blocked_low_fit',
      jobKeywordsCount: jobKeywords.length,
      validationBlocked: true,
      lowFitRecoverableBlocked: true,
      optimizedChanged: false,
      targetRoleConfidence: targetingPlan.targetRoleConfidence,
      targetRoleSource: targetingPlan.targetRoleSource,
    })
    logHighlightStatePersistence({
      session,
      highlightState: previousHighlightState,
      highlightDetectionInvoked: false,
      highlightStateGenerated: false,
      highlightStatePersisted: false,
      highlightStatePersistedReason: 'low_fit_recoverable_block',
    })
    logWarn('agent.job_targeting.pre_rewrite_low_fit_blocked', {
      sessionId: session.id,
      userId: session.userId,
      targetRole: targetingPlan.targetRole,
      matchScore: targetingPlan.lowFitWarningGate?.matchScore ?? gapAnalysisResult.matchScore,
      riskLevel: targetingPlan.lowFitWarningGate?.riskLevel,
      familyDistance: targetingPlan.lowFitWarningGate?.familyDistance,
      unsupportedGapRatio: targetingPlan.lowFitWarningGate?.unsupportedGapRatio ?? evidenceRatios.unsupportedGapRatio,
      explicitEvidenceRatio: targetingPlan.lowFitWarningGate?.explicitEvidenceRatio ?? evidenceRatios.explicitEvidenceRatio,
      coreRequirementCoverageSupported: targetingPlan.lowFitWarningGate?.coreRequirementCoverage.supported ?? 0,
      coreRequirementCoverageUnsupported: targetingPlan.lowFitWarningGate?.coreRequirementCoverage.unsupported ?? 0,
      reason: targetingPlan.lowFitWarningGate?.reason,
      elapsedMsFromStart: Date.now() - Date.parse(trace.startedAt),
    })
    recordMetricCounter('compatibility.board_fallback_rendered', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
      renderSurface: 'validation_modal',
    })

    logInfo('agent.job_targeting.validation_modal_shown', {
      sessionId: session.id,
      userId: session.userId,
      targetRole: targetingPlan.targetRole,
      issueCount: validation.issues.length,
      hardIssueCount: validation.hardIssues.length,
      softWarningCount: validation.softWarnings.length,
      issueTypes: getIssueTypeList(validation.issues).join(', ') || undefined,
      targetEvidenceCount: targetingPlan.targetEvidence?.length,
      evidenceLevelCounts: targetingPlan.targetEvidence
        ? countEvidenceLevels(targetingPlan.targetEvidence)
        : undefined,
      matchScore: gapAnalysisResult.matchScore,
      riskLevel: careerFitEvaluation?.riskLevel,
      familyDistance: careerFitEvaluation?.signals.familyDistance,
      lowFitGateTriggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
      lowFitGateReason: targetingPlan.lowFitWarningGate?.reason,
      recoverableBlockKind: 'pre_rewrite_low_fit_block',
    })
    logJobTargetingPipelineTrace(trace, 'blocked', {
      error: 'Job targeting pre-rewrite low-fit block triggered.',
    })

    return {
      success: false,
      validation,
      recoverableBlock: recoverableValidationBlock,
      error: 'Job targeting pre-rewrite low-fit block triggered.',
    }
  }

  if (options?.userAcceptedLowFit === true) {
    recordMetricCounter('compatibility.probable_proceeded', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
    })
  }

  const rewriteResult = await rewriteResumeFull({
    mode: 'job_targeting',
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    targetingPlan,
    ...(jobCompatibilityAssessment === undefined ? {} : { jobCompatibilityAssessment }),
    userId: session.userId,
    sessionId: session.id,
  })

  if (!rewriteResult.success || !rewriteResult.optimizedCvState) {
    trace.rewrite = {
      sectionsAttempted: rewriteResult.diagnostics?.sectionAttempts
        ? Object.keys(rewriteResult.diagnostics.sectionAttempts)
        : [],
      sectionsChanged: rewriteResult.summary?.changedSections ?? [],
      sectionsRetried: rewriteResult.diagnostics?.retriedSections ?? [],
      sectionsCompacted: rewriteResult.diagnostics?.compactedSections ?? [],
    }
    const nextAgentState: Session['agentState'] = {
      ...session.agentState,
      workflowMode: 'job_targeting',
      gapAnalysis,
      targetFitAssessment,
      careerFitEvaluation: careerFitEvaluation ?? undefined,
      ...compatibilityStatePatch,
      targetingPlan,
      rewriteStatus: 'failed',
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'rewrite_section',
        sectionAttempts: rewriteResult.diagnostics?.sectionAttempts ?? {},
        retriedSections: rewriteResult.diagnostics?.retriedSections ?? [],
        compactedSections: rewriteResult.diagnostics?.compactedSections ?? [],
        usageTotals: {
          sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
          retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
          compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
        },
        lastFailureStage: 'rewrite_section',
        lastFailureReason: rewriteResult.error ?? 'Job targeting rewrite failed.',
      }),
    }
    await persistPipelineAgentState(nextAgentState)

    logError(
      'agent.job_targeting.failed',
      createJobTargetingLogContext(session, 'rewrite_section', {
        success: false,
        errorMessage: rewriteResult.error ?? 'Job targeting rewrite failed.',
        retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
        compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
      }),
    )
    logJobTargetingPipelineTrace(trace, 'failed', {
      error: rewriteResult.error ?? 'Job targeting rewrite failed.',
    })

    return {
      success: false,
      error: rewriteResult.error ?? 'Job targeting rewrite failed.',
    }
  }

  let finalizedOptimizedCvState = rewriteResult.optimizedCvState
  let finalizedOptimizationSummary = rewriteResult.summary
  let finalizedGeneratedClaimTrace = rewriteResult.generatedClaimTrace
  let finalizedSectionRewritePlans = rewriteResult.sectionRewritePlans
  let validation = validateRewrite(session.cvState, finalizedOptimizedCvState, {
    mode: 'job_targeting',
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    targetingPlan,
    jobCompatibilityAssessment,
    generatedClaimTrace: finalizedGeneratedClaimTrace,
  })
  let summaryRetryAttempted = false
  let summaryRetrySucceeded = false
  let summaryRetryReason: string | undefined

  if (isSummaryOnlyRecoverableValidation(validation)) {
    summaryRetryAttempted = true
    summaryRetryReason = validation.hardIssues[0]?.issueType ?? 'summary_validation_failure'
    logInfo('agent.job_targeting.summary_retry_attempted', {
      sessionId: session.id,
      userId: session.userId,
      targetRole: targetingPlan.targetRole,
      issueCount: validation.issues.length,
      issueTypes: getIssueTypeList(validation.hardIssues).join(', ') || undefined,
    })

    const retryExecution = await rewriteSection({
      section: 'summary',
      current_content: finalizedOptimizedCvState.summary,
      instructions: buildSummaryRetryInstructions(targetingPlan),
      target_keywords: targetingPlan.mustEmphasize,
    }, session.userId, session.id)

    if ('success' in retryExecution.output && retryExecution.output.success && typeof retryExecution.output.section_data === 'string') {
      finalizedOptimizedCvState = {
        ...finalizedOptimizedCvState,
        summary: retryExecution.output.section_data,
      }
      finalizedGeneratedClaimTrace = replaceSummaryGeneratedClaimTrace(
        finalizedGeneratedClaimTrace,
        retryExecution.output.section_data,
      )
      finalizedOptimizationSummary = {
        changedSections: Array.from(new Set([
          ...(finalizedOptimizationSummary?.changedSections ?? []),
          'summary',
        ])),
        notes: [
          ...(finalizedOptimizationSummary?.notes ?? []),
          'Summary retried after targeted factual validation block.',
        ],
        keywordCoverageImprovement: finalizedOptimizationSummary?.keywordCoverageImprovement,
      }
      validation = validateRewrite(session.cvState, finalizedOptimizedCvState, {
        mode: 'job_targeting',
        targetJobDescription,
        gapAnalysis: gapAnalysisResult,
        targetingPlan,
        jobCompatibilityAssessment,
        generatedClaimTrace: finalizedGeneratedClaimTrace,
      })
      summaryRetrySucceeded = !validation.blocked

      logInfo(
        summaryRetrySucceeded
          ? 'agent.job_targeting.summary_retry_succeeded'
          : 'agent.job_targeting.summary_retry_failed',
        {
          sessionId: session.id,
          userId: session.userId,
          targetRole: targetingPlan.targetRole,
          issueCount: validation.issues.length,
          hardIssueCount: validation.hardIssues.length,
          issueTypes: getIssueTypeList(validation.hardIssues).join(', ') || undefined,
        },
      )
    } else {
      logWarn('agent.job_targeting.summary_retry_failed', {
        sessionId: session.id,
        userId: session.userId,
        targetRole: targetingPlan.targetRole,
        issueCount: validation.issues.length,
        error: 'Summary retry rewrite did not produce a valid summary payload.',
      })
    }
  }

  if (
    !options?.userAcceptedLowFit
    && summaryRetryAttempted
    && validation.blocked
    && isSummaryOnlyRecoverableValidation(validation)
  ) {
    const fallbackSummary = buildConservativeSummaryFallback({
      originalSummary: session.cvState.summary,
      targetingPlan,
    })

    finalizedOptimizedCvState = {
      ...finalizedOptimizedCvState,
      summary: fallbackSummary,
    }
    finalizedGeneratedClaimTrace = replaceSummaryGeneratedClaimTrace(
      finalizedGeneratedClaimTrace,
      fallbackSummary,
    )
    finalizedOptimizationSummary = {
      changedSections: Array.from(new Set([
        ...(finalizedOptimizationSummary?.changedSections ?? []),
        'summary',
      ])),
      notes: [
        ...(finalizedOptimizationSummary?.notes ?? []),
        'Conservative summary fallback applied after targeted factual validation block.',
      ],
      keywordCoverageImprovement: finalizedOptimizationSummary?.keywordCoverageImprovement,
    }
    validation = validateRewrite(session.cvState, finalizedOptimizedCvState, {
      mode: 'job_targeting',
      targetJobDescription,
      gapAnalysis: gapAnalysisResult,
      targetingPlan,
      jobCompatibilityAssessment,
      generatedClaimTrace: finalizedGeneratedClaimTrace,
    })
    summaryRetrySucceeded = !validation.blocked

    logInfo(
      summaryRetrySucceeded
        ? 'agent.job_targeting.summary_conservative_fallback_succeeded'
        : 'agent.job_targeting.summary_conservative_fallback_failed',
      {
        sessionId: session.id,
        userId: session.userId,
        targetRole: targetingPlan.targetRole,
        issueCount: validation.issues.length,
        hardIssueCount: validation.hardIssues.length,
        issueTypes: getIssueTypeList(validation.hardIssues).join(', ') || undefined,
      },
    )
  }
  validation = applyLowFitWarningGateToValidation({
    validation,
    lowFitWarningGate: targetingPlan.lowFitWarningGate,
    targetRole: targetingPlan.targetRole,
    targetRolePositioning: targetingPlan.targetRolePositioning,
    skipLowFitRecoverableBlocking: options?.skipLowFitRecoverableBlocking === true,
  })
  let acceptedLowFitFallbackUsed = false

  if (
    options?.userAcceptedLowFit
    && validation.blocked
    && isRecoverableValidationBlock(validation)
    && !shouldBlockAfterAcceptedOverride(validation)
  ) {
    finalizedOptimizedCvState = buildAcceptedLowFitFallbackCvState({
      originalCvState: session.cvState,
      targetingPlan,
    })
    finalizedOptimizationSummary = {
      changedSections: Array.from(new Set([
        ...(finalizedOptimizationSummary?.changedSections ?? []),
        'summary',
      ])),
      notes: [
        ...(finalizedOptimizationSummary?.notes ?? []),
        'Accepted low-fit fallback applied after recoverable validation issues.',
      ],
      keywordCoverageImprovement: finalizedOptimizationSummary?.keywordCoverageImprovement,
    }
    validation = validateRewrite(session.cvState, finalizedOptimizedCvState, {
      mode: 'job_targeting',
      targetJobDescription,
      gapAnalysis: gapAnalysisResult,
      targetingPlan,
      jobCompatibilityAssessment,
    })
    acceptedLowFitFallbackUsed = true
  }

  if (
    options?.userAcceptedLowFit
    && validation.blocked
    && isRecoverableValidationBlock(validation)
    && !shouldBlockAfterAcceptedOverride(validation)
  ) {
    validation = relaxValidationForAcceptedLowFitOverride(validation)
  }

  validation = sanitizeValidationResultForLogging({
    ...validation,
    recoverable: validation.blocked && isRecoverableValidationBlock(validation),
  })
  trace.rewrite = {
    sectionsAttempted: rewriteResult.diagnostics?.sectionAttempts
      ? Object.keys(rewriteResult.diagnostics.sectionAttempts)
      : [],
    sectionsChanged: finalizedOptimizationSummary?.changedSections ?? [],
    sectionsRetried: Array.from(new Set([
      ...(rewriteResult.diagnostics?.retriedSections ?? []),
      ...(summaryRetryAttempted ? ['summary'] : []),
    ])),
    sectionsCompacted: rewriteResult.diagnostics?.compactedSections ?? [],
    summaryRetryAttempted,
    summaryRetrySucceeded,
    summaryRetryReason,
  }
  trace.validation = {
    blocked: validation.blocked,
    hardIssuesCount: validation.hardIssues.length,
    softWarningsCount: validation.softWarnings.length,
    hardIssues: summarizeValidationIssues(validation.hardIssues),
    softWarnings: summarizeValidationIssues(validation.softWarnings),
    failureStage: validation.blocked ? 'validation' : undefined,
    promotedWarnings: validation.promotedWarnings,
  }
  const optimizedAt = new Date().toISOString()
  const optimizedChanged = !cvStatesMatch(
    finalizedOptimizedCvState,
    previousOptimizedCvState ?? session.cvState,
  )
  trace.validation.recoverable = validation.blocked
    ? isRecoverableValidationBlock(validation)
    : undefined
  const lowFitRecoverableBlocked = Boolean(
    !options?.skipLowFitRecoverableBlocking
    && targetingPlan.lowFitWarningGate?.triggered
    && validation.blocked
    && validation.recoverable
  )
  const validationIssueMessages = validation.issues.map((issue) => issue.message)
  const validationIssueSections = Array.from(new Set(validation.issues.map((issue) => issue.section).filter(Boolean)))
  const jobTargetingExplanation = !validation.blocked
    ? buildJobTargetingExplanation({
        session,
        optimizedCvState: finalizedOptimizedCvState,
        targetingPlan,
      })
    : undefined

  if (jobTargetingExplanation) {
    const mustNotInventRecommendationCount = jobTargetingExplanation.targetRecommendations
      .filter((recommendation) => recommendation.mustNotInvent).length

    logInfo('agent.job_targeting.explanation_built', {
      sessionId: session.id,
      userId: session.userId,
      targetRole: targetingPlan.targetRole,
      targetRecommendationCount: jobTargetingExplanation.targetRecommendations.length,
      mustNotInventRecommendationCount,
    })
    recordMetricCounter('architecture.job_targeting.recommendations.count', {
      sessionId: session.id,
      count: jobTargetingExplanation.targetRecommendations.length,
    })
  }
  const highlightGenerationGate = classifyHighlightGenerationGate({
    acceptedLowFitOverride: options?.userAcceptedLowFit === true,
    validationBlocked: validation.blocked,
    lowFitRecoverableBlocked,
    optimizedChanged,
  })
  logHighlightGenerationGate({
    session,
    gate: highlightGenerationGate,
    jobKeywordsCount: jobKeywords.length,
    validationBlocked: validation.blocked,
    lowFitRecoverableBlocked,
    optimizedChanged,
    targetRoleConfidence: targetingPlan.targetRoleConfidence,
    targetRoleSource: targetingPlan.targetRoleSource,
  })
  const shouldGenerateHighlights = highlightGenerationGate === 'allowed'
  let nextHighlightState = previousHighlightState
  let highlightDetectionOutcome: HighlightDetectionOutcome | undefined

  if (shouldGenerateHighlights) {
    try {
      nextHighlightState = await generateCvHighlightState(finalizedOptimizedCvState, {
        userId: session.userId,
        sessionId: session.id,
        workflowMode: 'job_targeting',
        jobKeywords,
        onCompleted: (outcome) => {
          highlightDetectionOutcome = outcome
        },
      })
    } catch (error) {
      nextHighlightState = undefined
      logWarn('agent.job_targeting.highlight_detection_failed', {
        sessionId: session.id,
        userId: session.userId,
        workflowMode: 'job_targeting',
        stage: 'highlight_detection',
        success: false,
        ...serializeError(error),
      })
    }
  }
  const shouldGenerateOverrideReviewHighlights = highlightGenerationGate === 'skipped_after_override'
  if (shouldGenerateOverrideReviewHighlights) {
    logInfo('agent.highlight_state.override_review.started', {
      sessionId: session.id,
      cvVersionId: undefined,
      acceptedLowFit: options?.userAcceptedLowFit === true,
      fallbackUsed: acceptedLowFitFallbackUsed,
      issueCount: validation.issues.length,
    })

    try {
      nextHighlightState = buildOverrideReviewHighlightState({
        session: {
          ...session,
          agentState: {
            ...session.agentState,
            targetingPlan,
            rewriteValidation: validation,
            validationOverride: {
              enabled: true,
              acceptedAt: new Date().toISOString(),
              acceptedByUserId: session.userId,
              validationIssueCount: validation.issues.length,
              hardIssueCount: validation.hardIssues.length,
              issueTypes: getIssueTypeList(validation.issues),
              issues: validation.issues,
              targetRole: targetingPlan.targetRole,
              acceptedLowFit: options?.userAcceptedLowFit === true,
              fallbackUsed: acceptedLowFitFallbackUsed,
            },
          },
        },
        cvState: finalizedOptimizedCvState,
      })
      const summary = summarizeHighlightState(nextHighlightState)
      const reviewCards = nextHighlightState.reviewItems ?? []
      const lowFitCard = reviewCards.find((item) => item.kind === 'low_fit_target_mismatch')
      if (lowFitCard) {
        logInfo('agent.highlight_state.override_review.card_built', {
          sessionId: session.id,
          cvVersionId: undefined,
          acceptedLowFit: options?.userAcceptedLowFit === true,
          cardKind: lowFitCard.kind,
          targetRole: lowFitCard.targetRole,
          jobRequirementCount: lowFitCard.jobRequirements?.length ?? 0,
          missingEvidenceCount: lowFitCard.missingEvidence?.length ?? lowFitCard.unsupportedRequirements?.length ?? 0,
          provenProfilePresent: Boolean(lowFitCard.provenProfile ?? lowFitCard.originalProfileLabel),
          sourceIssueCount: validation.issues.length,
          dedupedCardCount: reviewCards.length,
        })
      }
      logInfo('agent.highlight_state.override_review.completed', {
        sessionId: session.id,
        cvVersionId: undefined,
        acceptedLowFit: options?.userAcceptedLowFit === true,
        fallbackUsed: acceptedLowFitFallbackUsed,
        issueCount: validation.issues.length,
        reviewCardCount: reviewCards.length,
        reviewCount: reviewCards.filter((item) => item.severity === 'review').length,
        cautionCount: reviewCards.filter((item) => item.severity === 'caution').length,
        riskCount: validation.issues.length,
        highlightRangeCount: summary.highlightStateResolvedRangeCount,
        overrideReviewHighlightCount: summary.highlightStateResolvedRangeCount,
      })
    } catch (error) {
      nextHighlightState = {
        source: 'rewritten_cv_state',
        version: 2,
        resolvedHighlights: [],
        highlightSource: 'job_targeting',
        highlightMode: 'override_review',
        reviewItems: validation.issues.map((issue, index) => ({
          id: `fallback-review-${index}`,
          severity: 'risk' as const,
          section: 'general' as const,
          title: 'Revise este ponto antes de enviar',
          explanation: issue.userFacingExplanation ?? issue.message,
          summary: 'A versão foi gerada com pontos que precisam de revisão para manter aderência ao histórico original.',
          whyItMatters: 'Quando o currículo sugere experiências não comprovadas, pode parecer artificial em processos seletivos.',
          suggestedAction: 'Revise o texto e mantenha apenas afirmações sustentadas pelo currículo original antes de enviar.',
          message: issue.userFacingExplanation ?? issue.message,
          issueType: issue.issueType,
          offendingSignal: issue.offendingSignal,
          offendingText: issue.offendingText ?? issue.offendingSignal,
          targetRole: targetingPlan.targetRole,
          provenProfile: sanitizeText(targetingPlan.targetRolePositioning?.safeRolePositioning ?? ''),
          unsupportedRequirements: targetingPlan.coreRequirementCoverage?.topUnsupportedSignalsForDisplay ?? [],
          jobRequirements: targetingPlan.coreRequirementCoverage?.topUnsupportedSignalsForDisplay ?? [],
          inline: false,
        })),
        highlightGeneratedAt: new Date().toISOString(),
        generatedAt: new Date().toISOString(),
      }
      logWarn('agent.highlight_state.override_review.failed', {
        sessionId: session.id,
        cvVersionId: undefined,
        acceptedLowFit: options?.userAcceptedLowFit === true,
        fallbackUsed: acceptedLowFitFallbackUsed,
        issueCount: validation.issues.length,
        ...serializeError(error),
      })
    }
  }
  trace.highlight = {
    gate: highlightGenerationGate,
    generated: shouldGenerateHighlights && Boolean(nextHighlightState),
    highlightSource: shouldGenerateHighlights ? nextHighlightState?.highlightSource : undefined,
    jobKeywordsCount: jobKeywords.length,
    overrideReviewHighlightGenerated: shouldGenerateOverrideReviewHighlights && nextHighlightState?.highlightMode === 'override_review',
    overrideReviewHighlightCount: shouldGenerateOverrideReviewHighlights
      ? summarizeHighlightState(nextHighlightState).highlightStateResolvedRangeCount
      : undefined,
  }

  const blockedDraft = !options?.skipLowFitRecoverableBlocking
    && validation.blocked
    && isRecoverableValidationBlock(validation)
    && (
      optimizedChanged
      || targetingPlan.lowFitWarningGate?.triggered === true
    )
    ? createBlockedTargetedRewriteDraft({
      sessionId: session.id,
      userId: session.userId,
      kind: 'post_rewrite_validation_block',
      optimizedCvState: finalizedOptimizedCvState,
      originalCvState: session.cvState,
      optimizationSummary: finalizedOptimizationSummary,
      targetJobDescription,
      targetRole: targetingPlan.targetRole,
      validationIssues: validation.issues,
      lowFitGate: targetingPlan.lowFitWarningGate,
      targetEvidence: targetingPlan.targetEvidence,
      safeTargetingEmphasis: targetingPlan.safeTargetingEmphasis,
      coreRequirementCoverage: targetingPlan.coreRequirementCoverage,
      recoverable: true,
    })
    : undefined
  const recoverableValidationBlock = blockedDraft
    ? {
      status: 'validation_blocked_recoverable' as const,
      kind: blockedDraft.kind,
      overrideToken: blockedDraft.token,
      modal: buildUserFacingValidationBlockModal({
        targetRole: targetingPlan.targetRole,
        validationIssues: validation.issues,
        targetEvidence: targetingPlan.targetEvidence,
        lowFitWarningGate: targetingPlan.lowFitWarningGate,
        directClaimsAllowed: targetingPlan.rewritePermissions?.directClaimsAllowed,
        originalProfileLabel: sanitizeText(targetingPlan.targetRolePositioning?.safeRolePositioning ?? '')
          .replace(/^Profissional com experi[êe]ncia em\s*/i, '')
          .replace(/[.]$/u, '') || undefined,
      }),
      userFriendlyReview: buildUserFriendlyJobReviewFromTargetingEvidence({
        targetEvidence: targetingPlan.targetEvidence,
        lowFitWarningGate: targetingPlan.lowFitWarningGate,
      }),
      expiresAt: blockedDraft.expiresAt,
    }
    : undefined

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
    ...compatibilityStatePatch,
    targetingPlan,
    extractionWarning: targetingPlan.targetRoleConfidence === 'low' ? 'low_confidence_role' : undefined,
    rewriteStatus: validation.blocked ? 'failed' : 'completed',
    optimizedCvState: validation.blocked ? previousOptimizedCvState : finalizedOptimizedCvState,
    highlightState: validation.blocked ? previousHighlightState : nextHighlightState,
    jobTargetingExplanation: validation.blocked ? previousJobTargetingExplanation : jobTargetingExplanation,
    optimizedAt: validation.blocked ? previousOptimizedAt : optimizedAt,
    optimizationSummary: validation.blocked ? previousOptimizationSummary : finalizedOptimizationSummary,
    lastRewriteMode: validation.blocked ? previousLastRewriteMode : 'job_targeting',
    sectionRewritePlans: finalizedSectionRewritePlans,
    generatedClaimTrace: finalizedGeneratedClaimTrace,
    rewriteValidation: validation,
    blockedTargetedRewriteDraft: blockedDraft,
    recoverableValidationBlock,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: validation.blocked ? 'failed' : 'completed',
      currentStage: validation.blocked ? 'validation' : 'persist_version',
      sectionAttempts: rewriteResult.diagnostics?.sectionAttempts ?? {},
      retriedSections: rewriteResult.diagnostics?.retriedSections ?? [],
      compactedSections: rewriteResult.diagnostics?.compactedSections ?? [],
      usageTotals: {
        sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
        retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
        compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
      },
      lastFailureStage: validation.blocked ? 'validation' : undefined,
      lastFailureReason: validation.blocked
        ? validationIssueMessages[0]
          ? `Job targeting rewrite validation failed: ${validationIssueMessages[0]}`
          : 'Job targeting rewrite validation failed.'
        : undefined,
    }),
  }
  await persistPipelineAgentState(nextAgentState)
  const highlightStatePersistedReason = validation.blocked
    ? lowFitRecoverableBlocked
      ? 'low_fit_recoverable_block'
      : 'validation_failed'
    : highlightGenerationGate === 'skipped_after_override'
      ? 'skipped_after_override'
    : !shouldGenerateHighlights
      ? 'not_generated_for_unchanged_cv_state'
      : highlightDetectionOutcome?.resultKind === 'valid_empty'
        ? 'empty_valid_result'
        : highlightDetectionOutcome?.resultKind === 'all_filtered_out'
          ? 'all_filtered_out'
          : highlightDetectionOutcome?.resultKind === 'invalid_payload'
            ? 'invalid_payload'
            : highlightDetectionOutcome?.resultKind === 'thrown_error'
              ? 'thrown_error'
              : 'generated'

  logHighlightStatePersistence({
    session,
    highlightState: nextAgentState.highlightState,
    highlightDetectionInvoked: shouldGenerateHighlights,
    highlightStateGenerated: shouldGenerateHighlights && Boolean(nextHighlightState),
    highlightStatePersisted: !validation.blocked && Boolean(nextAgentState.highlightState),
    highlightStatePersistedReason,
    highlightDetectionOutcome,
  })

  if (validation.blocked) {
    logWarn(
      'agent.job_targeting.validation_failed',
      createJobTargetingLogContext(session, 'validation', {
        success: false,
        issueCount: validation.issues.length,
        hardIssueCount: validation.hardIssues.length,
        softWarningCount: validation.softWarnings.length,
        recoverable: Boolean(recoverableValidationBlock),
        issueSections: validationIssueSections.join(', ') || undefined,
        issueMessages: validationIssueMessages.join(' | ') || undefined,
        promotedWarningTypes: validation.promotedWarnings?.map((warning) => warning.issueType).join(', ') || undefined,
        lowFitGateTriggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
        lowFitGateReason: targetingPlan.lowFitWarningGate?.reason,
        targetRole: targetingPlan.targetRole,
        targetRoleConfidence: targetingPlan.targetRoleConfidence,
        targetRoleSource: targetingPlan.targetRoleSource,
      }),
    )
    if (recoverableValidationBlock) {
      logInfo('agent.job_targeting.validation_modal_shown', {
        sessionId: session.id,
        userId: session.userId,
        targetRole: targetingPlan.targetRole,
        issueCount: validation.issues.length,
        hardIssueCount: validation.hardIssues.length,
        softWarningCount: validation.softWarnings.length,
        issueTypes: getIssueTypeList(validation.issues).join(', ') || undefined,
        targetEvidenceCount: targetingPlan.targetEvidence?.length,
        evidenceLevelCounts: targetingPlan.targetEvidence
          ? countEvidenceLevels(targetingPlan.targetEvidence)
          : undefined,
        matchScore: gapAnalysisResult.matchScore,
        riskLevel: careerFitEvaluation?.riskLevel,
        familyDistance: careerFitEvaluation?.signals.familyDistance,
        lowFitGateTriggered: targetingPlan.lowFitWarningGate?.triggered ?? false,
        lowFitGateReason: targetingPlan.lowFitWarningGate?.reason,
      })
    }
    logJobTargetingPipelineTrace(trace, 'blocked', {
      error: 'Job targeting rewrite validation failed.',
    })

    return {
      success: false,
      validation,
      recoverableBlock: recoverableValidationBlock,
      error: 'Job targeting rewrite validation failed.',
    }
  }

  const validatedOptimizedCvState = finalizedOptimizedCvState
  let persistedCvVersionId: string | undefined

  try {
    await executeWithStageRetry(
      async (attempt) => {
        session.agentState.atsWorkflowRun = buildWorkflowRun(session, {
          status: 'running',
          currentStage: 'persist_version',
          attemptCount: attempt,
        })
        const createdVersion = await createCvVersion({
          sessionId: session.id,
          snapshot: validatedOptimizedCvState,
          source: 'job-targeting',
        })
        persistedCvVersionId = createdVersion.id
      },
      {
        onRetry: (_error, attempt) => {
          logWarn(
            'agent.job_targeting.retry',
            createJobTargetingLogContext(session, 'persist_version', { attempt: attempt + 1 }),
          )
        },
      },
    )
  } catch (error) {
    const failedAgentState: Session['agentState'] = {
      ...session.agentState,
      rewriteStatus: 'failed',
      optimizedCvState: previousOptimizedCvState,
      highlightState: previousHighlightState,
      optimizedAt: previousOptimizedAt,
      optimizationSummary: previousOptimizationSummary,
      lastRewriteMode: previousLastRewriteMode,
      atsWorkflowRun: buildWorkflowRun(session, {
        status: 'failed',
        currentStage: 'persist_version',
        lastFailureStage: 'persist_version',
        lastFailureReason: error instanceof Error ? error.message : 'Failed to persist job targeting version.',
      }),
    }
    await persistPipelineAgentState(failedAgentState)
    logHighlightStatePersistence({
      session,
      highlightState: failedAgentState.highlightState,
      highlightDetectionInvoked: shouldGenerateHighlights,
      highlightStateGenerated: false,
      highlightStatePersisted: Boolean(failedAgentState.highlightState),
      highlightStatePersistedReason: 'persist_version_rollback',
      highlightDetectionOutcome,
    })
    logError(
      'agent.job_targeting.failed',
      createJobTargetingLogContext(session, 'persist_version', {
        success: false,
        ...serializeError(error),
      }),
    )
    logJobTargetingPipelineTrace(trace, 'failed', {
      error: error instanceof Error ? error.message : 'Failed to persist job targeting version.',
    })

    return {
      success: false,
      validation,
      error: error instanceof Error ? error.message : 'Failed to persist job targeting version.',
    }
  }

  await persistPipelineAgentState({
    ...session.agentState,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: 'completed',
      currentStage: 'persist_version',
      lastFailureStage: undefined,
      lastFailureReason: undefined,
    }),
  })

  if (options?.userAcceptedLowFit === true) {
    recordMetricCounter('compatibility.probable_improved', {
      workflowMode: 'job_targeting',
      sessionId: session.id,
    })
  }

  logInfo(
    'agent.job_targeting.completed',
    createJobTargetingLogContext(session, 'persist_version', {
      success: true,
      issueCount: validation.issues.length,
      hardIssueCount: validation.hardIssues.length,
      softWarningCount: validation.softWarnings.length,
      targetRole: targetingPlan.targetRole,
      targetRoleConfidence: targetingPlan.targetRoleConfidence,
      targetRoleSource: targetingPlan.targetRoleSource,
    }),
  )
  logJobTargetingPipelineTrace(trace, 'success')

  return {
    success: true,
    optimizedCvState: finalizedOptimizedCvState,
    optimizationSummary: finalizedOptimizationSummary,
    jobTargetingExplanation,
    validation,
    acceptedLowFitFallbackUsed,
    cvVersionId: persistedCvVersionId,
  }
}
