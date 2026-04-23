import { scoreATS } from '@/lib/ats/score'
import { buildHighlightStateResponseOutcome } from '@/lib/agent/highlight-observability'
import {
  resolveSessionAtsReadiness,
} from '@/lib/ats/scoring'
import { recordMetricCounter } from '@/lib/observability/metric-events'
import { logInfo } from '@/lib/observability/structured-log'
import {
  isLockedPreview,
  getPreviewLockSummary,
  sanitizeGeneratedCvStateForClient,
} from '@/lib/generated-preview/locked-preview'
import { buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'

import type { SessionComparisonContext, SessionComparisonDecision } from './types'

function resolveGenerationType(
  lastRewriteMode?: string,
): Extract<SessionComparisonDecision, { kind: 'success' }>['body']['generationType'] {
  return lastRewriteMode === 'job_targeting' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function resolveScoreLabel(
  generationType: Extract<SessionComparisonDecision, { kind: 'success' }>['body']['generationType'],
): string {
  return generationType === 'JOB_TARGETING' ? 'Aderencia a vaga' : 'ATS Readiness Score'
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
  const label = resolveScoreLabel(generationType)
  const targetJobDescription = context.session.agentState.targetJobDescription

  try {
    const atsReadiness = generationType === 'ATS_ENHANCEMENT'
      ? resolveSessionAtsReadiness({
          session: context.session,
          optimizedCvState,
          emitFallbackTelemetry: true,
        })
      : undefined

    const originalResumeText = buildResumeTextFromCvState(context.session.cvState)
    const optimizedResumeText = buildResumeTextFromCvState(optimizedCvState)

    const originalScore = generationType === 'ATS_ENHANCEMENT' && atsReadiness
      ? atsReadiness.displayedReadinessScoreBefore
      : scoreATS(originalResumeText, targetJobDescription).total
    const optimizedScore = generationType === 'ATS_ENHANCEMENT' && atsReadiness
      ? atsReadiness.displayedReadinessScoreAfter ?? atsReadiness.displayedReadinessScoreCurrent
      : scoreATS(optimizedResumeText, targetJobDescription).total

    if (atsReadiness) {
      recordMetricCounter('architecture.ats_readiness.comparison_rendered', {
        contractVersion: atsReadiness.contractVersion,
        scoreStatus: atsReadiness.scoreStatus,
        confidence: atsReadiness.rawInternalConfidence,
      })
    }

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
        previewLock: getPreviewLockSummary(context.session.generatedOutput),
        optimizationSummary: context.session.agentState.optimizationSummary,
        atsReadiness,
        originalScore: {
          total: originalScore,
          label,
        },
        optimizedScore: {
          total: optimizedScore,
          label,
        },
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
