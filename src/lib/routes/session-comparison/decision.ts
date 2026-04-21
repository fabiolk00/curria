import { analyzeAtsGeneral } from '@/lib/agent/tools/ats-analysis'
import { scoreATS } from '@/lib/ats/score'
import {
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
  return generationType === 'JOB_TARGETING' ? 'AderÃªncia Ã  vaga' : 'Score ATS'
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
    const originalResumeText = buildResumeTextFromCvState(context.session.cvState)
    const optimizedResumeText = buildResumeTextFromCvState(optimizedCvState)

    const [originalAnalysis, optimizedAnalysis] = generationType === 'ATS_ENHANCEMENT'
      ? await Promise.all([
          analyzeAtsGeneral(context.session.cvState, context.session.userId, context.session.id),
          analyzeAtsGeneral(optimizedCvState, context.session.userId, context.session.id),
        ])
      : await Promise.all([
          Promise.resolve({
            success: true,
            result: {
              overallScore: scoreATS(originalResumeText, targetJobDescription).total,
            },
          }),
          Promise.resolve({
            success: true,
            result: {
              overallScore: scoreATS(optimizedResumeText, targetJobDescription).total,
            },
          }),
        ])

    const originalScore = originalAnalysis.success && originalAnalysis.result
      ? originalAnalysis.result.overallScore
      : scoreATS(originalResumeText, targetJobDescription).total
    const optimizedScore = optimizedAnalysis.success && optimizedAnalysis.result
      ? optimizedAnalysis.result.overallScore
      : scoreATS(optimizedResumeText, targetJobDescription).total

    return {
      kind: 'success',
      body: {
        sessionId: context.session.id,
        workflowMode: context.session.agentState.workflowMode,
        generationType,
        targetJobDescription,
        originalCvState: context.session.cvState,
        optimizedCvState,
        previewLock: getPreviewLockSummary(context.session.generatedOutput),
        optimizationSummary: context.session.agentState.optimizationSummary,
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
