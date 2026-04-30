import { buildHighlightStateResponseOutcome } from '@/lib/agent/highlight-observability'
import { buildJobTargetingScoreBreakdownFromPlan } from '@/lib/agent/job-targeting/score-breakdown'
import { logInfo } from '@/lib/observability/structured-log'
import {
  isLockedPreview,
  getPreviewLockSummary,
  sanitizeGeneratedCvStateForClient,
} from '@/lib/generated-preview/locked-preview'

import type { SessionComparisonContext, SessionComparisonDecision } from './types'

function resolveGenerationType(
  lastRewriteMode?: string,
): Extract<SessionComparisonDecision, { kind: 'success' }>['body']['generationType'] {
  return lastRewriteMode === 'job_targeting' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function resolveJobTargetingExplanationForClient(
  context: SessionComparisonContext,
  previewLocked: boolean,
) {
  const explanation = context.session.agentState.jobTargetingExplanation

  if (previewLocked || !explanation) {
    return undefined
  }

  if (explanation.scoreBreakdown || !context.session.agentState.targetingPlan) {
    return explanation
  }

  return {
    ...explanation,
    scoreBreakdown: buildJobTargetingScoreBreakdownFromPlan({
      targetingPlan: context.session.agentState.targetingPlan,
      cvState: context.session.cvState,
    }),
  }
}

export async function decideSessionComparison(
  context: SessionComparisonContext,
): Promise<SessionComparisonDecision> {
  const optimizedCvState = sanitizeGeneratedCvStateForClient(
    context.session.agentState.optimizedCvState,
    context.session.generatedOutput,
    'optimized',
  )
  if (!optimizedCvState) {
    return {
      kind: 'no_optimized_resume',
      status: 409,
      body: { error: 'No optimized resume found for this session.' },
    }
  }

  const generationType = resolveGenerationType(
    context.session.agentState.lastRewriteMode ?? context.session.agentState.workflowMode,
  )
  const targetJobDescription = context.session.agentState.targetJobDescription

  try {
    const previewLocked = isLockedPreview(context.session.generatedOutput)
    const highlightStateResponse = buildHighlightStateResponseOutcome({
      previewLocked,
      highlightState: context.session.agentState.highlightState,
      optimizedCvState,
    })

    logInfo('agent.highlight_state.response_evaluated', {
      sessionId: context.session.id,
      userId: context.session.userId,
      workflowMode: context.session.agentState.workflowMode,
      surface: 'session_comparison',
      previewLocked,
      highlightStateResponseKind: highlightStateResponse.highlightStateResponseKind,
      highlightStateAvailable: highlightStateResponse.highlightStateAvailable,
      highlightStateReturned: highlightStateResponse.highlightStateReturned,
      highlightStateOmittedReason: highlightStateResponse.highlightStateOmittedReason,
      highlightStateResolvedItemCount: highlightStateResponse.highlightStateResolvedItemCount,
      highlightStateResolvedRangeCount: highlightStateResponse.highlightStateResolvedRangeCount,
      highlightStateVisibleItemCount: highlightStateResponse.highlightStateVisibleItemCount,
      highlightStateVisibleRangeCount: highlightStateResponse.highlightStateVisibleRangeCount,
      highlightStateRendererMismatch: highlightStateResponse.highlightStateRendererMismatch,
    })

    return {
      kind: 'success',
      body: {
        sessionId: context.session.id,
        workflowMode: context.session.agentState.workflowMode,
        generationType,
        targetJobDescription,
        originalCvState: context.session.cvState,
        optimizedCvState,
        highlightState: highlightStateResponse.highlightStateReturned
          ? context.session.agentState.highlightState
          : undefined,
        jobTargetingExplanation: resolveJobTargetingExplanationForClient(context, previewLocked),
        previewLock: getPreviewLockSummary(context.session.generatedOutput),
        optimizationSummary: context.session.agentState.optimizationSummary,
      },
    }
  } catch {
    return {
      kind: 'internal_error',
      status: 500,
      body: { error: 'Internal server error' },
    }
  }
}
