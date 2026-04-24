import type { NextRequest } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getResumeTargetForSession } from '@/lib/db/resume-targets'
import { getSession } from '@/lib/db/sessions'
import { resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'
import { logWarn } from '@/lib/observability/structured-log'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'

import { buildArtifactJobIdempotencyKey } from './keys'
import type { SessionGenerateContextResult } from './types'

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

export async function resolveSessionGenerateContext(
  req: NextRequest,
  params: { id: string },
): Promise<SessionGenerateContextResult> {
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
    return { kind: 'blocked', response: { status: 401, body: { error: 'Unauthorized' } } }
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
    return { kind: 'blocked', response: { status: 404, body: { error: 'Not found' } } }
  }

  const trust = validateTrustedMutationRequest(req)
  if (!trust.ok) {
    logWarn('api.session.generate.untrusted_request', {
      requestMethod: req.method,
      requestPath,
      requestedSessionId: params.id,
      sessionId: session.id,
      appUserId: appUser.id,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
      trustSignal: trust.signal,
      trustReason: trust.reason,
    })
    return { kind: 'blocked', response: { status: 403, body: { error: 'Forbidden' } } }
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
    return { kind: 'blocked', response: { status: 400, body: { error: body.error.flatten() } } }
  }

  const target = body.data.scope === 'target'
    ? await getResumeTargetForSession(session.id, body.data.targetId)
    : null

  if (body.data.scope === 'target' && !target) {
    logWarn('api.session.generate.target_not_found', {
      requestMethod: req.method,
      requestPath,
      sessionId: session.id,
      appUserId: appUser.id,
      scope: body.data.scope,
      targetId: body.data.targetId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return { kind: 'blocked', response: { status: 404, body: { error: 'Not found' } } }
  }

  return {
    kind: 'allow',
    context: {
      request: req,
      requestStartedAt,
      requestPath,
      params,
      appUser,
      session,
      body: body.data,
      scope: body.data.scope,
      target,
      effectiveSource: resolveEffectiveResumeSource(session, target),
      primaryIdempotencyKey: buildArtifactJobIdempotencyKey({
        session,
        target,
        targetId: target?.id,
        clientRequestId: body.data.clientRequestId,
      }),
    },
  }
}
