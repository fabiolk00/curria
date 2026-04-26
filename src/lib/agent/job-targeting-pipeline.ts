import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import { summarizeHighlightState } from '@/lib/agent/highlight-observability'
import { evaluateCareerFitRisk } from '@/lib/agent/profile-review'
import {
  generateCvHighlightState,
  type HighlightDetectionOutcome,
} from '@/lib/agent/tools/detect-cv-highlights'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
import { createCvVersion } from '@/lib/db/cv-versions'
import { updateSession } from '@/lib/db/sessions'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { executeWithStageRetry } from '@/lib/agent/job-targeting-retry'
import { createJobTargetingLogContext } from '@/lib/agent/job-targeting-observability'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'
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

async function persistAgentState(session: Session, agentState: Session['agentState']): Promise<void> {
  await updateSession(session.id, {
    agentState,
  })
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
  validationBlocked: boolean
  optimizedChanged: boolean
}): 'allowed' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state' {
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
  gate: 'allowed' | 'blocked_validation_failed' | 'blocked_unchanged_cv_state'
  jobKeywordsCount: number
  validationBlocked: boolean
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

export async function runJobTargetingPipeline(session: Session): Promise<{
  success: boolean
  optimizedCvState?: Session['agentState']['optimizedCvState']
  optimizationSummary?: Session['agentState']['optimizationSummary']
  validation?: Session['agentState']['rewriteValidation']
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

  await persistAgentState(session, {
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
    await persistAgentState(session, nextAgentState)
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

  await persistAgentState(session, {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
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

  const targetingPlan = await buildTargetingPlan({
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    userId: session.userId,
    sessionId: session.id,
  })
  const jobKeywords = extractJobKeywords({
    gapAnalysis,
    targetingPlan,
    targetFitAssessment,
    targetJobDescription,
  })
  trace.extraction = {
    targetRole: targetingPlan.targetRole,
    targetRoleConfidence: targetingPlan.targetRoleConfidence,
    targetRoleSource: targetingPlan.targetRoleSource,
    extractionWarning: targetingPlan.targetRoleConfidence === 'low'
      ? 'low_confidence_role'
      : undefined,
    jobKeywordsCount: jobKeywords.length,
  }

  await persistAgentState(session, {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
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

    await persistAgentState(session, {
      ...session.agentState,
      workflowMode: 'job_targeting',
      gapAnalysis,
      targetFitAssessment,
      careerFitEvaluation: careerFitEvaluation ?? undefined,
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
    }),
  )

  const rewriteResult = await rewriteResumeFull({
    mode: 'job_targeting',
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    targetingPlan,
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
    await persistAgentState(session, nextAgentState)

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

  const validation = validateRewrite(session.cvState, rewriteResult.optimizedCvState, {
    mode: 'job_targeting',
    targetJobDescription,
    gapAnalysis: gapAnalysisResult,
    targetingPlan,
  })
  trace.rewrite = {
    sectionsAttempted: rewriteResult.diagnostics?.sectionAttempts
      ? Object.keys(rewriteResult.diagnostics.sectionAttempts)
      : [],
    sectionsChanged: rewriteResult.summary?.changedSections ?? [],
    sectionsRetried: rewriteResult.diagnostics?.retriedSections ?? [],
    sectionsCompacted: rewriteResult.diagnostics?.compactedSections ?? [],
  }
  trace.validation = {
    blocked: validation.blocked,
    hardIssuesCount: validation.hardIssues.length,
    softWarningsCount: validation.softWarnings.length,
    hardIssues: summarizeValidationIssues(validation.hardIssues),
    softWarnings: summarizeValidationIssues(validation.softWarnings),
    failureStage: validation.blocked ? 'validation' : undefined,
  }
  const optimizedAt = new Date().toISOString()
  const optimizedChanged = !cvStatesMatch(
    rewriteResult.optimizedCvState,
    previousOptimizedCvState ?? session.cvState,
  )
  const validationIssueMessages = validation.issues.map((issue) => issue.message)
  const validationIssueSections = Array.from(new Set(validation.issues.map((issue) => issue.section).filter(Boolean)))
  const highlightGenerationGate = classifyHighlightGenerationGate({
    validationBlocked: validation.blocked,
    optimizedChanged,
  })
  logHighlightGenerationGate({
    session,
    gate: highlightGenerationGate,
    jobKeywordsCount: jobKeywords.length,
    validationBlocked: validation.blocked,
    optimizedChanged,
    targetRoleConfidence: targetingPlan.targetRoleConfidence,
    targetRoleSource: targetingPlan.targetRoleSource,
  })
  const shouldGenerateHighlights = highlightGenerationGate === 'allowed'
  let nextHighlightState = previousHighlightState
  let highlightDetectionOutcome: HighlightDetectionOutcome | undefined

  if (shouldGenerateHighlights) {
    try {
      nextHighlightState = await generateCvHighlightState(rewriteResult.optimizedCvState, {
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
  trace.highlight = {
    gate: highlightGenerationGate,
    generated: shouldGenerateHighlights && Boolean(nextHighlightState),
    highlightSource: shouldGenerateHighlights ? nextHighlightState?.highlightSource : undefined,
    jobKeywordsCount: jobKeywords.length,
  }

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    careerFitEvaluation: careerFitEvaluation ?? undefined,
    targetingPlan,
    extractionWarning: targetingPlan.targetRoleConfidence === 'low' ? 'low_confidence_role' : undefined,
    rewriteStatus: validation.blocked ? 'failed' : 'completed',
    optimizedCvState: validation.blocked ? previousOptimizedCvState : rewriteResult.optimizedCvState,
    highlightState: validation.blocked ? previousHighlightState : nextHighlightState,
    optimizedAt: validation.blocked ? previousOptimizedAt : optimizedAt,
    optimizationSummary: validation.blocked ? previousOptimizationSummary : rewriteResult.summary,
    lastRewriteMode: validation.blocked ? previousLastRewriteMode : 'job_targeting',
    rewriteValidation: validation,
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
  await persistAgentState(session, nextAgentState)
  const highlightStatePersistedReason = validation.blocked
    ? 'validation_failed'
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
    highlightStatePersisted: Boolean(nextAgentState.highlightState),
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
        issueSections: validationIssueSections.join(', ') || undefined,
        issueMessages: validationIssueMessages.join(' | ') || undefined,
        targetRole: targetingPlan.targetRole,
        targetRoleConfidence: targetingPlan.targetRoleConfidence,
        targetRoleSource: targetingPlan.targetRoleSource,
      }),
    )
    logJobTargetingPipelineTrace(trace, 'blocked', {
      error: 'Job targeting rewrite validation failed.',
    })

    return {
      success: false,
      validation,
      error: 'Job targeting rewrite validation failed.',
    }
  }

  const validatedOptimizedCvState = rewriteResult.optimizedCvState

  try {
    await executeWithStageRetry(
      async (attempt) => {
        session.agentState.atsWorkflowRun = buildWorkflowRun(session, {
          status: 'running',
          currentStage: 'persist_version',
          attemptCount: attempt,
        })
        await createCvVersion({
          sessionId: session.id,
          snapshot: validatedOptimizedCvState,
          source: 'job-targeting',
        })
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
    await persistAgentState(session, failedAgentState)
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

  await persistAgentState(session, {
    ...session.agentState,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: 'completed',
      currentStage: 'persist_version',
      lastFailureStage: undefined,
      lastFailureReason: undefined,
    }),
  })

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
    optimizedCvState: rewriteResult.optimizedCvState,
    optimizationSummary: rewriteResult.summary,
    validation,
  }
}
