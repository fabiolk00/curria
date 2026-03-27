import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetsForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'

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

  try {
    const targets = await getResumeTargetsForSession(session.id)

    return NextResponse.json({
      session: {
        id: session.id,
        phase: session.phase,
        stateVersion: session.stateVersion,
        cvState: session.cvState,
        agentState: {
          parseStatus: session.agentState.parseStatus,
          parseError: session.agentState.parseError,
          parseConfidenceScore: session.agentState.parseConfidenceScore,
          targetJobDescription: session.agentState.targetJobDescription,
          gapAnalysis: session.agentState.gapAnalysis,
        },
        generatedOutput: session.generatedOutput,
        atsScore: session.atsScore,
        messageCount: session.messageCount,
        creditConsumed: session.creditConsumed,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      targets,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
