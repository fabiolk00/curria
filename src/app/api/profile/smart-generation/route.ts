import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'
import { runJobTargetingPipeline } from '@/lib/agent/job-targeting-pipeline'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { validateGenerationCvState } from '@/lib/agent/tools/generate-file'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { applyToolPatchWithVersion, checkUserQuota, createSession } from '@/lib/db/sessions'
import { logWarn } from '@/lib/observability/structured-log'
import {
  assessAtsEnhancementReadiness,
  buildResumeTextFromCvState,
  getAtsEnhancementBlockingItems,
} from '@/lib/profile/ats-enhancement'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { ResumeGenerationType, WorkflowMode } from '@/types/agent'
import type { CVState } from '@/types/cv'

const SmartGenerationRequestSchema = CVStateSchema.extend({
  targetJobDescription: z.string().trim().max(20_000).optional(),
})

function resolveWorkflowMode(targetJobDescription?: string): WorkflowMode {
  return targetJobDescription?.trim() ? 'job_targeting' : 'ats_enhancement'
}

function buildGenerationCopy(mode: WorkflowMode): {
  incompleteError: string
  creditsError: string
  pipelineError: string
  generationType: ResumeGenerationType
  idempotencyKeyPrefix: string
} {
  if (mode === 'job_targeting') {
    return {
      incompleteError: 'Complete seu currículo para adaptar sua versão para a vaga.',
      creditsError: 'Seus créditos acabaram. Recarregue seu saldo para adaptar seu currículo para a vaga.',
      pipelineError: 'Não foi possível adaptar seu currículo para a vaga agora.',
      generationType: 'JOB_TARGETING',
      idempotencyKeyPrefix: 'profile-target',
    }
  }

  return {
    incompleteError: 'Complete seu currículo para gerar uma versão ATS.',
    creditsError: 'Seus créditos acabaram. Recarregue seu saldo para gerar uma versão ATS.',
    pipelineError: 'Não foi possível melhorar sua versão ATS agora.',
    generationType: 'ATS_ENHANCEMENT',
    idempotencyKeyPrefix: 'profile-ats',
  }
}

function buildPatchedSession(
  session: Awaited<ReturnType<typeof createSession>>,
  params: {
    cvState: CVState
    workflowMode: WorkflowMode
    sourceResumeText: string
    targetJobDescription?: string
  },
) {
  return {
    ...session,
    cvState: params.cvState,
    agentState: {
      ...session.agentState,
      parseStatus: 'parsed' as const,
      sourceResumeText: params.sourceResumeText,
      workflowMode: params.workflowMode,
      targetJobDescription: params.targetJobDescription,
    },
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trust = validateTrustedMutationRequest(request)
  if (!trust.ok) {
    logWarn('api.profile.smart_generation.untrusted_request', {
      appUserId: appUser.id,
      requestMethod: request.method,
      requestPath: request.nextUrl.pathname,
      success: false,
      trustSignal: trust.signal,
      trustReason: trust.reason,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = SmartGenerationRequestSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { targetJobDescription: rawTargetJobDescription, ...cvState } = parsed.data
  const targetJobDescription = rawTargetJobDescription?.trim() || undefined
  const workflowMode = resolveWorkflowMode(targetJobDescription)
  const copy = buildGenerationCopy(workflowMode)
  const sourceResumeText = buildResumeTextFromCvState(cvState)

  const readiness = assessAtsEnhancementReadiness(cvState)
  const missingItems = getAtsEnhancementBlockingItems(cvState)
  if (!readiness.isReady || missingItems.length > 0) {
    return NextResponse.json({
      error: copy.incompleteError,
      reasons: missingItems.length > 0 ? missingItems : readiness.reasons,
      missingItems,
    }, { status: 400 })
  }

  const hasCredits = await checkUserQuota(appUser.id)
  if (!hasCredits) {
    return NextResponse.json({
      error: copy.creditsError,
    }, { status: 402 })
  }

  const generationValidation = validateGenerationCvState(cvState)
  if (!generationValidation.success) {
    return NextResponse.json({
      error: copy.incompleteError,
      reasons: [generationValidation.errorMessage],
      missingItems: [generationValidation.errorMessage],
    }, { status: 400 })
  }

  const session = await createSession(appUser.id)

  await applyToolPatchWithVersion(session, {
    cvState,
    agentState: {
      parseStatus: 'parsed',
      sourceResumeText,
      workflowMode,
      targetJobDescription,
    },
  }, 'manual')

  const patchedSession = buildPatchedSession(session, {
    cvState,
    workflowMode,
    sourceResumeText,
    targetJobDescription,
  })

  const pipeline = workflowMode === 'job_targeting'
    ? await runJobTargetingPipeline(patchedSession)
    : await runAtsEnhancementPipeline(patchedSession)

  if (!pipeline.success || !pipeline.optimizedCvState) {
    return NextResponse.json({
      error: pipeline.error ?? copy.pipelineError,
      reasons: pipeline.validation?.issues.map((issue) => issue.message),
    }, { status: 500 })
  }

  const generationResult = await dispatchToolWithContext('generate_file', {
    cv_state: pipeline.optimizedCvState,
    idempotency_key: `${copy.idempotencyKeyPrefix}:${session.id}`,
  }, session)

  if (generationResult.outputFailure) {
    return NextResponse.json({
      error: generationResult.outputFailure.error,
      code: generationResult.outputFailure.code,
    }, { status: 500 })
  }

  const output = generationResult.output as {
    creditsUsed?: number
    resumeGenerationId?: string
  }

  return NextResponse.json({
    success: true,
    sessionId: session.id,
    creditsUsed: output.creditsUsed ?? 0,
    resumeGenerationId: output.resumeGenerationId,
    generationType: copy.generationType,
    originalCvState: cvState,
    optimizedCvState: pipeline.optimizedCvState,
  })
}
