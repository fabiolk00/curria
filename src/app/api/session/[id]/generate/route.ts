import { createHash } from 'crypto'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getHttpStatusForToolError, isToolErrorCode, TOOL_ERROR_CODES } from '@/lib/agent/tool-errors'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  applyGeneratedOutputPatch,
  getSession,
} from '@/lib/db/sessions'
import {
  getResumeTargetForSession,
  updateResumeTargetGeneratedOutput,
} from '@/lib/db/resume-targets'
import { createJob } from '@/lib/jobs/repository'
import { startDurableJobProcessing } from '@/lib/jobs/runtime'
import { resolveEffectiveResumeSource } from '@/lib/jobs/source-of-truth'
import { hasConfirmedCareerFitOverride, requiresCareerFitWarning } from '@/lib/agent/profile-review'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { Session } from '@/types/agent'
import type { JobStatusSnapshot, JobType } from '@/types/jobs'

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

function resolveGenerationType(scope: 'base' | 'target') {
  return scope === 'target' ? 'JOB_TARGETING' : 'ATS_ENHANCEMENT'
}

function resolveJobScopeType(scope: 'base' | 'target'): JobType {
  return 'artifact_generation'
}

function buildArtifactJobIdempotencyKey(input: {
  session: Session
  target?: NonNullable<Awaited<ReturnType<typeof getResumeTargetForSession>>>
  targetId?: string
  clientRequestId?: string
}): string {
  const effectiveSource = resolveEffectiveResumeSource(input.session, input.target)
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      sessionId: input.session.id,
      targetId: input.targetId ?? null,
      clientRequestId: input.clientRequestId ?? null,
      dispatchInputRef: effectiveSource.ref,
      sourceCvState: effectiveSource.cvState,
    }))
    .digest('hex')
    .slice(0, 24)

  return `session-generate:${input.session.id}:${input.targetId ?? 'base'}:${fingerprint}`
}

function buildRetryArtifactJobIdempotencyKey(input: {
  session: Session
  target?: NonNullable<Awaited<ReturnType<typeof getResumeTargetForSession>>>
  targetId?: string
  retryOfJobId: string
}): string {
  const effectiveSource = resolveEffectiveResumeSource(input.session, input.target)
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      sessionId: input.session.id,
      targetId: input.targetId ?? null,
      retryOfJobId: input.retryOfJobId,
      dispatchInputRef: effectiveSource.ref,
      sourceCvState: effectiveSource.cvState,
    }))
    .digest('hex')
    .slice(0, 24)

  return `session-generate:${input.session.id}:${input.targetId ?? 'base'}:retry:${fingerprint}`
}

async function persistGeneratingState(input: {
  session: Session
  targetId?: string
}): Promise<void> {
  if (input.targetId) {
    await updateResumeTargetGeneratedOutput(input.session.id, input.targetId, {
      status: 'generating',
      error: undefined,
    })
    return
  }

  await applyGeneratedOutputPatch(input.session, {
    status: 'generating',
    error: undefined,
  })
}

function buildSuccessResponseBody(input: {
  job: JobStatusSnapshot
  scope: 'base' | 'target'
  targetId?: string
  inProgress?: boolean
}) {
  return {
    success: true,
    ...(input.inProgress ? { inProgress: true } : {}),
    scope: input.scope,
    targetId: input.targetId,
    creditsUsed: 0,
    generationType: resolveGenerationType(input.scope),
    jobId: input.job.jobId,
    billingStage: input.job.stage,
    resumeGenerationId: input.job.terminalResultRef?.kind === 'resume_generation'
      ? input.job.terminalResultRef.resumeGenerationId
      : undefined,
  }
}

function buildFailedJobResponse(job: JobStatusSnapshot): {
  status: number
  body: Record<string, unknown>
} {
  const terminalErrorRef = job.terminalErrorRef

  if (terminalErrorRef?.kind === 'resume_generation_failure') {
    return {
      status: getHttpStatusForToolError(TOOL_ERROR_CODES.GENERATION_ERROR),
      body: {
        success: false,
        code: TOOL_ERROR_CODES.GENERATION_ERROR,
        error: terminalErrorRef.failureReason ?? 'File generation failed.',
        resumeGenerationId: terminalErrorRef.resumeGenerationId,
      },
    }
  }

  if (terminalErrorRef?.kind === 'job_error') {
    const status = isToolErrorCode(terminalErrorRef.code)
      ? getHttpStatusForToolError(terminalErrorRef.code)
      : 500

    return {
      status,
      body: {
        success: false,
        code: terminalErrorRef.code,
        error: terminalErrorRef.message,
      },
    }
  }

  return {
    status: 500,
    body: {
      success: false,
      code: TOOL_ERROR_CODES.GENERATION_ERROR,
      error: 'File generation failed.',
    },
  }
}

function isBillingReconciliationPending(job: JobStatusSnapshot): boolean {
  return (
    (job.status === 'failed' || job.status === 'cancelled')
    && (job.stage === 'release_credit' || job.stage === 'needs_reconciliation')
  )
}

function hasReadyGeneratedArtifact(input: {
  session: Session
  target?: NonNullable<Awaited<ReturnType<typeof getResumeTargetForSession>>> | null
  scope: 'base' | 'target'
}): boolean {
  const generatedOutput = input.scope === 'target'
    ? input.target?.generatedOutput
    : input.session.generatedOutput

  return generatedOutput?.status === 'ready' && Boolean(generatedOutput.pdfPath)
}

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
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
        error: 'A vaga parece um encaixe fraco para o perfil atual. Confirme explicitamente no chat que deseja continuar antes de gerar esta versão.',
        code: 'CAREER_FIT_CONFIRMATION_REQUIRED',
      }, { status: 409 })
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const effectiveSource = resolveEffectiveResumeSource(session, target)
    const primaryIdempotencyKey = buildArtifactJobIdempotencyKey({
      session,
      target: target ?? undefined,
      targetId: target?.id,
      clientRequestId: body.data.clientRequestId,
    })
    let createdJob = await createJob({
      userId: appUser.id,
      sessionId: session.id,
      resumeTargetId: target?.id,
      type: resolveJobScopeType(body.data.scope),
      idempotencyKey: primaryIdempotencyKey,
      stage: 'queued',
      dispatchInputRef: effectiveSource.ref,
      metadata: {
        scope: body.data.scope,
        clientRequestId: body.data.clientRequestId ?? null,
      },
    })

    if (
      !body.data.clientRequestId
      && !createdJob.wasCreated
      && isBillingReconciliationPending(createdJob.job)
    ) {
      logWarn('api.session.generate.billing_reconciliation_pending', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: target?.id,
        jobId: createdJob.job.jobId,
        stage: createdJob.job.stage,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({
        success: false,
        code: 'BILLING_RECONCILIATION_PENDING',
        error: 'Previous generation billing is still being reconciled.',
      }, { status: 409 })
    }

    if (
      !body.data.clientRequestId
      && !createdJob.wasCreated
      && (createdJob.job.status === 'failed' || createdJob.job.status === 'cancelled')
    ) {
      createdJob = await createJob({
        userId: appUser.id,
        sessionId: session.id,
        resumeTargetId: target?.id,
        type: 'artifact_generation',
        idempotencyKey: buildRetryArtifactJobIdempotencyKey({
          session,
          target: target ?? undefined,
          targetId: target?.id,
          retryOfJobId: createdJob.job.jobId,
        }),
        stage: 'queued',
        dispatchInputRef: effectiveSource.ref,
        metadata: {
          scope: body.data.scope,
          retryOf: createdJob.job.jobId,
        },
      })
    }

    const startedJob = await startDurableJobProcessing({
      jobId: createdJob.job.jobId,
      userId: appUser.id,
    })
    const job = startedJob ?? createdJob.job

    if (job.status === 'failed' || job.status === 'cancelled') {
      const failure = buildFailedJobResponse(job)
      const failureCode = typeof failure.body.code === 'string'
        ? failure.body.code
        : undefined
      logWarn('api.session.generate.job_failed', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: target?.id,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
        code: failureCode,
      })
      return NextResponse.json(failure.body, { status: failure.status })
    }

    if (job.status === 'completed' && job.terminalResultRef?.kind === 'resume_generation') {
      logInfo('api.session.generate.completed', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: target?.id,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json(buildSuccessResponseBody({
        job,
        scope: body.data.scope,
        targetId: target?.id,
      }))
    }

    if (job.status === 'completed') {
      const refreshedSession = await getSession(params.id, appUser.id)
      const refreshedTarget = body.data.scope === 'target' && target?.id
        ? await getResumeTargetForSession(params.id, target.id)
        : target

      if (refreshedSession && hasReadyGeneratedArtifact({
        session: refreshedSession,
        target: refreshedTarget,
        scope: body.data.scope,
      })) {
        logInfo('api.session.generate.completed', {
          requestMethod: req.method,
          requestPath,
          sessionId: refreshedSession.id,
          appUserId: appUser.id,
          scope: body.data.scope,
          targetId: refreshedTarget?.id,
          success: true,
          degradedPersistence: true,
          latencyMs: Date.now() - requestStartedAt,
        })
        return NextResponse.json(buildSuccessResponseBody({
          job,
          scope: body.data.scope,
          targetId: refreshedTarget?.id,
        }))
      }
    }

    await persistGeneratingState({
      session,
      targetId: target?.id,
    })

    if (job.status === 'queued' || job.status === 'running') {
      logInfo('api.session.generate.in_progress', {
        requestMethod: req.method,
        requestPath,
        sessionId: session.id,
        appUserId: appUser.id,
        scope: body.data.scope,
        targetId: target?.id,
        success: true,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json(buildSuccessResponseBody({
        job,
        scope: body.data.scope,
        targetId: target?.id,
        inProgress: true,
      }), { status: 202 })
    }

    throw new Error(`Unsupported durable artifact job status: ${job.status}`)
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
