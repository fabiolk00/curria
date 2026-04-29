import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getAiChatAccess } from '@/lib/billing/ai-chat-access.server'
import { getSession } from '@/lib/db/sessions'
import { logInfo, logWarn } from '@/lib/observability/structured-log'
import { withRequestQueryTracking } from '@/lib/observability/request-query-tracking'

// Deprecated compatibility route for legacy AI-chat snapshots.
// Guided generation and generated resume access use ownership/artifact rules instead.
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const aiChatAccess = await getAiChatAccess(appUser.id)
    if (!aiChatAccess.allowed) {
      logWarn('api.session.ai_chat_snapshot_forbidden', {
        requestMethod: req.method,
        requestPath: req.nextUrl.pathname,
        requestedSessionId: params.id,
        appUserId: appUser.id,
        aiChatAccessReason: aiChatAccess.reason,
        aiChatAccessCode: aiChatAccess.code,
        success: false,
      })

      return NextResponse.json({
        error: aiChatAccess.message,
        title: aiChatAccess.title,
        code: aiChatAccess.code,
        upgradeUrl: aiChatAccess.upgradeUrl,
      }, { status: 403 })
    }

    logInfo('api.session.ai_chat_snapshot_loaded', {
      requestMethod: req.method,
      requestPath: req.nextUrl.pathname,
      requestedSessionId: params.id,
      appUserId: appUser.id,
      accessScope: 'ai_chat',
      success: true,
    })

    return NextResponse.json({
      session: {
        id: session.id,
        cvState: session.cvState,
        agentState: {
          workflowMode: session.agentState.workflowMode,
          targetJobDescription: session.agentState.targetJobDescription,
          optimizedCvState: session.agentState.optimizedCvState,
          optimizationSummary: session.agentState.optimizationSummary,
          rewriteValidation: session.agentState.rewriteValidation,
        },
      },
    })
  })
}
