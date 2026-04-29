import { NextRequest, NextResponse } from 'next/server'

import { buildHighlightStateResponseOutcome } from '@/lib/agent/highlight-observability'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  recordAtsReadinessCompatFieldEmission,
  resolveSessionAtsReadiness,
} from '@/lib/ats/scoring'
import { buildCareerFitCheckpoint } from '@/lib/agent/profile-review'
import { getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import {
  isLockedPreview,
  sanitizeGeneratedCvStateForClient,
  sanitizeGeneratedOutputForClient,
} from '@/lib/generated-preview/locked-preview'
import { listJobsForSession } from '@/lib/jobs/repository'
import { logInfo } from '@/lib/observability/structured-log'
import { withRequestQueryTracking } from '@/lib/observability/request-query-tracking'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  return withRequestQueryTracking(req, async () => {
    const appUser = await getCurrentAppUser()
    if (!appUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await getSession(params.id, appUser.id)
    if (!session) {
      return NextResponse.json({
        error: 'Forbidden',
        code: 'forbidden_owner_mismatch',
      }, { status: 403 })
    }

    try {
      logInfo('api.session.snapshot_loaded', {
        requestMethod: req.method,
        requestPath: req.nextUrl.pathname,
        requestedSessionId: params.id,
        appUserId: appUser.id,
        accessScope: 'history_editor',
        success: true,
      })

      const atsReadiness = resolveSessionAtsReadiness({
        session,
        emitFallbackTelemetry: true,
      })

      const targets = await getResumeTargetsForSession(session.id)
      const jobs = await listJobsForSession({
        userId: appUser.id,
        sessionId: session.id,
        limit: 10,
      })

      if (session.internalHeuristicAtsScore) {
        recordAtsReadinessCompatFieldEmission({
          surface: 'session_response',
          workflowMode: session.agentState.workflowMode,
          hasCanonicalReadiness: Boolean(atsReadiness),
          contractVersion: atsReadiness?.contractVersion,
        })
      }

      const optimizedCvState = sanitizeGeneratedCvStateForClient(
        session.agentState.optimizedCvState,
        session.generatedOutput,
        'optimized',
      )
      const previewLocked = isLockedPreview(session.generatedOutput)
      const highlightStateResponse = buildHighlightStateResponseOutcome({
        previewLocked,
        highlightState: session.agentState.highlightState,
        optimizedCvState,
      })

      logInfo('agent.highlight_state.response_evaluated', {
        sessionId: session.id,
        userId: appUser.id,
        workflowMode: session.agentState.workflowMode,
        surface: 'session_route',
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

      return NextResponse.json({
        session: {
          id: session.id,
          phase: session.phase,
          stateVersion: session.stateVersion,
          cvState: session.cvState,
          agentState: {
            workflowMode: session.agentState.workflowMode,
            parseStatus: session.agentState.parseStatus,
            parseError: session.agentState.parseError,
            parseConfidenceScore: session.agentState.parseConfidenceScore,
            targetJobDescription: session.agentState.targetJobDescription,
            targetFitAssessment: session.agentState.targetFitAssessment,
            careerFitEvaluation: session.agentState.careerFitEvaluation,
            careerFitCheckpoint: buildCareerFitCheckpoint(session),
            gapAnalysis: session.agentState.gapAnalysis,
            targetingPlan: session.agentState.targetingPlan,
            atsAnalysis: session.agentState.atsAnalysis,
            atsReadiness,
            atsWorkflowRun: session.agentState.atsWorkflowRun,
            rewriteStatus: session.agentState.rewriteStatus,
            optimizedCvState,
            highlightState: highlightStateResponse.highlightStateReturned
              ? session.agentState.highlightState
              : undefined,
            jobTargetingExplanation: previewLocked
              ? undefined
              : session.agentState.jobTargetingExplanation,
            optimizedAt: session.agentState.optimizedAt,
            optimizationSummary: session.agentState.optimizationSummary,
            lastRewriteMode: session.agentState.lastRewriteMode,
            rewriteValidation: session.agentState.rewriteValidation,
            recoverableValidationBlock: session.agentState.recoverableValidationBlock,
          },
          generatedOutput: sanitizeGeneratedOutputForClient(session.generatedOutput),
          atsReadiness,
          // Deprecated raw/internal heuristic score retained for compatibility-only consumers.
          atsScore: session.internalHeuristicAtsScore,
          messageCount: session.messageCount,
          creditConsumed: session.creditConsumed,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
        },
        jobs,
        targets: targets.map((target) => ({
          ...target,
          derivedCvState: sanitizeGeneratedCvStateForClient(
            target.derivedCvState,
            target.generatedOutput,
            'target',
          ) ?? target.derivedCvState,
          generatedOutput: sanitizeGeneratedOutputForClient(target.generatedOutput),
        })),
      })
    } catch {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}
