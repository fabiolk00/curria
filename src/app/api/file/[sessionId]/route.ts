import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import { createSignedResumeArtifactUrls } from '@/lib/agent/tools/generate-file'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
): Promise<NextResponse> {
  const requestStartedAt = Date.now()
  const targetId = req.nextUrl.searchParams.get('targetId')
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.file.download_urls_unauthorized', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.sessionId,
      targetId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.sessionId, appUser.id)
  if (!session) {
    logWarn('api.file.download_urls_not_found', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.sessionId,
      targetId,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const target = targetId
    ? await getResumeTargetForSession(session.id, targetId)
    : null

  if (targetId && !target) {
    logWarn('api.file.download_urls_target_not_found', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      targetId,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const artifactMetadata = target?.generatedOutput ?? session.generatedOutput
  const { pdfPath, status } = artifactMetadata

  if (status !== 'ready' || !pdfPath) {
    logInfo('api.file.download_urls_unavailable', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      targetId,
      appUserId: appUser.id,
      generationStatus: status,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json(
      {
        docxUrl: null,
        pdfUrl: null,
        available: false,
      },
      { status: 200 },
    )
  }

  try {
    const signedUrls = await createSignedResumeArtifactUrls(undefined, pdfPath)

    logInfo('api.file.download_urls_ready', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      targetId,
      appUserId: appUser.id,
      generationStatus: status,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({
      docxUrl: null,
      pdfUrl: signedUrls.pdfUrl,
    })
  } catch (error) {
    logError('api.file.download_urls_failed', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      targetId,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(error),
    })

    return NextResponse.json(
      { error: 'Generated resume artifacts could not be retrieved.' },
      { status: 404 },
    )
  }
}
