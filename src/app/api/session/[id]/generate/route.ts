import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getHttpStatusForToolError, isToolFailure } from '@/lib/agent/tool-errors'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchTool } from '@/lib/agent/tools'
import { getSession } from '@/lib/db/sessions'
import { hasConfirmedCareerFitOverride, requiresCareerFitWarning } from '@/lib/agent/profile-review'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

const BodySchema = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('base'),
    clientRequestId: z.string().min(1).max(200).optional(),
  }),
  z.object({
    scope: z.literal('target'),
    targetId: z.string().min(1),
    clientRequestId: z.string().min(1).max(200).optional(),
  }),
])

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const requestStartedAt = Date.now()
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.session.generate.unauthorized', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await getSession(params.id, appUser.id)
  if (!session) {
    logWarn('api.session.generate.not_found', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.id,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = BodySchema.safeParse(await req.json())
  if (!body.success) {
    logWarn('api.session.generate.invalid_body', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }

  try {
    if (body.data.scope === 'target' && requiresCareerFitWarning(session) && !hasConfirmedCareerFitOverride(session)) {
      logWarn('api.session.generate.career_fit_confirmation_required', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: body.data.targetId,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({
        success: false,
        error: 'A vaga parece um encaixe fraco para o perfil atual. Confirme explicitamente no chat que deseja continuar antes de gerar esta versao.',
        code: 'CAREER_FIT_CONFIRMATION_REQUIRED',
      }, { status: 409 })
    }

    const rawResult = await dispatchTool('generate_file', {
      cv_state: session.cvState,
      target_id: body.data.scope === 'target' ? body.data.targetId : undefined,
      idempotency_key: body.data.clientRequestId,
    }, session)
    const result = JSON.parse(rawResult) as unknown

    if (isToolFailure(result)) {
      logWarn('api.session.generate.tool_failed', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
        code: result.code,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json(
        { success: false, error: result.error, code: result.code },
        { status: getHttpStatusForToolError(result.code) },
      )
    }

    if ((result as { inProgress?: boolean }).inProgress) {
      logInfo('api.session.generate.in_progress', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({
        success: true,
        inProgress: true,
        scope: body.data.scope,
        targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
        creditsUsed: (result as { creditsUsed?: number }).creditsUsed ?? 0,
        generationType: body.data.scope === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT',
        resumeGenerationId: (result as { resumeGenerationId?: string }).resumeGenerationId,
      }, { status: 202 })
    }

    logInfo('api.session.generate.completed', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      appUserId: appUser.id,
      scope: body.data.scope,
      targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json({
      success: true,
      scope: body.data.scope,
      targetId: body.data.scope === 'target' ? body.data.targetId : undefined,
      creditsUsed: (result as { creditsUsed?: number }).creditsUsed ?? 0,
      generationType: body.data.scope === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT',
      resumeGenerationId: (result as { resumeGenerationId?: string }).resumeGenerationId,
    })
  } catch (error) {
    logError('api.session.generate.failed', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.id,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(error),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
