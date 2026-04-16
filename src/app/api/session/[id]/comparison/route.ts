import { NextRequest, NextResponse } from 'next/server'

import { analyzeAtsGeneral } from '@/lib/agent/tools/ats-analysis'
import { scoreATS } from '@/lib/ats/score'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession } from '@/lib/db/sessions'
import { buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'
import type { ResumeComparisonResponse } from '@/types/dashboard'

function resolveGenerationType(lastRewriteMode?: string): ResumeComparisonResponse['generationType'] {
  return lastRewriteMode === 'job_targeting' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function resolveScoreLabel(generationType: ResumeComparisonResponse['generationType']): string {
  return generationType === 'JOB_TARGETING' ? 'Aderência à vaga' : 'Score ATS'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.id, appUser.id)
  if (!session) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const optimizedCvState = session.agentState.optimizedCvState
  if (!optimizedCvState) {
    return NextResponse.json({ error: 'No optimized resume found for this session.' }, { status: 409 })
  }

  const generationType = resolveGenerationType(session.agentState.lastRewriteMode ?? session.agentState.workflowMode)
  const label = resolveScoreLabel(generationType)
  const targetJobDescription = session.agentState.targetJobDescription

  try {
    const originalResumeText = buildResumeTextFromCvState(session.cvState)
    const optimizedResumeText = buildResumeTextFromCvState(optimizedCvState)

    const [originalAnalysis, optimizedAnalysis] = generationType === 'ATS_ENHANCEMENT'
      ? await Promise.all([
          analyzeAtsGeneral(session.cvState, session.userId, session.id),
          analyzeAtsGeneral(optimizedCvState, session.userId, session.id),
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

    return NextResponse.json({
      sessionId: session.id,
      workflowMode: session.agentState.workflowMode,
      generationType,
      targetJobDescription,
      originalCvState: session.cvState,
      optimizedCvState,
      optimizationSummary: session.agentState.optimizationSummary,
      originalScore: {
        total: originalScore,
        label,
      },
      optimizedScore: {
        total: optimizedScore,
        label,
      },
    } satisfies ResumeComparisonResponse)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
