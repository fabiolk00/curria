import { analyzeGap } from '@/lib/agent/tools/gap-analysis'
import { buildTargetingPlan } from '@/lib/agent/tools/build-targeting-plan'
import { rewriteResumeFull } from '@/lib/agent/tools/rewrite-resume-full'
import { validateRewrite } from '@/lib/agent/tools/validate-rewrite'
import { createCvVersion } from '@/lib/db/cv-versions'
import { updateSession } from '@/lib/db/sessions'
import { deriveTargetFitAssessment } from '@/lib/agent/target-fit'
import { executeWithStageRetry } from '@/lib/agent/job-targeting-retry'
import { createJobTargetingLogContext } from '@/lib/agent/job-targeting-observability'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import type { Session } from '@/types/agent'

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
  const previousOptimizedAt = session.agentState.optimizedAt
  const previousOptimizationSummary = session.agentState.optimizationSummary
    ? structuredClone(session.agentState.optimizationSummary)
    : undefined
  const previousLastRewriteMode = session.agentState.lastRewriteMode
  const targetJobDescription = session.agentState.targetJobDescription?.trim()
  if (!targetJobDescription) {
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

      const result = await analyzeGap(
        session.cvState,
        targetJobDescription,
        session.userId,
        session.id,
      )

      if (!result.output.success || !result.result) {
        throw new Error('error' in result.output ? result.output.error : 'Gap analysis failed.')
      }

      return result.result
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
    return {
      success: false,
      error: session.agentState.atsWorkflowRun?.lastFailureReason ?? 'Gap analysis failed.',
    }
  }

  const analyzedAt = new Date().toISOString()
  const gapAnalysis = {
    result: gapAnalysisExecution,
    analyzedAt,
  } satisfies NonNullable<Session['agentState']['gapAnalysis']>
  const targetFitAssessment = deriveTargetFitAssessment(gapAnalysisExecution, analyzedAt)

  await persistAgentState(session, {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    atsWorkflowRun: buildWorkflowRun(session, {
      currentStage: 'targeting_plan',
    }),
  })

  const targetingPlan = buildTargetingPlan({
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisExecution,
  })

  await persistAgentState(session, {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    targetingPlan,
    atsWorkflowRun: buildWorkflowRun(session, {
      currentStage: 'rewrite_plan',
    }),
  })

  logInfo(
    'agent.job_targeting.plan_built',
    createJobTargetingLogContext(session, 'targeting_plan', {
      targetRole: targetingPlan.targetRole,
      targetRoleConfidence: targetingPlan.targetRoleConfidence,
      emphasizeCount: targetingPlan.mustEmphasize.length,
      missingCount: targetingPlan.missingButCannotInvent.length,
    }),
  )

  const rewriteResult = await rewriteResumeFull({
    mode: 'job_targeting',
    cvState: session.cvState,
    targetJobDescription,
    gapAnalysis: gapAnalysisExecution,
    targetingPlan,
    userId: session.userId,
    sessionId: session.id,
  })

  if (!rewriteResult.success || !rewriteResult.optimizedCvState) {
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

    return {
      success: false,
      error: rewriteResult.error ?? 'Job targeting rewrite failed.',
    }
  }

  const validation = validateRewrite(session.cvState, rewriteResult.optimizedCvState, {
    mode: 'job_targeting',
    targetJobDescription,
    gapAnalysis: gapAnalysisExecution,
    targetingPlan,
  })
  const optimizedAt = new Date().toISOString()
  const validationIssueMessages = validation.issues.map((issue) => issue.message)
  const validationIssueSections = Array.from(new Set(validation.issues.map((issue) => issue.section).filter(Boolean)))

  const nextAgentState: Session['agentState'] = {
    ...session.agentState,
    workflowMode: 'job_targeting',
    gapAnalysis,
    targetFitAssessment,
    targetingPlan,
    rewriteStatus: validation.valid ? 'completed' : 'failed',
    optimizedCvState: validation.valid ? rewriteResult.optimizedCvState : previousOptimizedCvState,
    optimizedAt: validation.valid ? optimizedAt : previousOptimizedAt,
    optimizationSummary: validation.valid ? rewriteResult.summary : previousOptimizationSummary,
    lastRewriteMode: validation.valid ? 'job_targeting' : previousLastRewriteMode,
    rewriteValidation: validation,
    atsWorkflowRun: buildWorkflowRun(session, {
      status: validation.valid ? 'completed' : 'failed',
      currentStage: validation.valid ? 'persist_version' : 'validation',
      sectionAttempts: rewriteResult.diagnostics?.sectionAttempts ?? {},
      retriedSections: rewriteResult.diagnostics?.retriedSections ?? [],
      compactedSections: rewriteResult.diagnostics?.compactedSections ?? [],
      usageTotals: {
        sectionAttempts: Object.values(rewriteResult.diagnostics?.sectionAttempts ?? {}).reduce((total, value) => total + (value ?? 0), 0),
        retriedSections: rewriteResult.diagnostics?.retriedSections.length ?? 0,
        compactedSections: rewriteResult.diagnostics?.compactedSections.length ?? 0,
      },
      lastFailureStage: validation.valid ? undefined : 'validation',
      lastFailureReason: validation.valid
        ? undefined
        : validationIssueMessages[0]
          ? `Job targeting rewrite validation failed: ${validationIssueMessages[0]}`
          : 'Job targeting rewrite validation failed.',
    }),
  }
  await persistAgentState(session, nextAgentState)

  if (!validation.valid) {
    logWarn(
      'agent.job_targeting.validation_failed',
      createJobTargetingLogContext(session, 'validation', {
        success: false,
        issueCount: validation.issues.length,
        issueSections: validationIssueSections.join(', ') || undefined,
        issueMessages: validationIssueMessages.join(' | ') || undefined,
        targetRole: targetingPlan.targetRole,
        targetRoleConfidence: targetingPlan.targetRoleConfidence,
      }),
    )

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
    logError(
      'agent.job_targeting.failed',
      createJobTargetingLogContext(session, 'persist_version', {
        success: false,
        ...serializeError(error),
      }),
    )

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
      targetRole: targetingPlan.targetRole,
      targetRoleConfidence: targetingPlan.targetRoleConfidence,
    }),
  )

  return {
    success: true,
    optimizedCvState: rewriteResult.optimizedCvState,
    optimizationSummary: rewriteResult.summary,
    validation,
  }
}
