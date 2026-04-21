import { NextRequest, NextResponse } from 'next/server'

import { getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { dispatchToolWithContext } from '@/lib/agent/tools'
import { validateGenerationCvState } from '@/lib/agent/tools/generate-file'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { checkUserQuota } from '@/lib/db/sessions'
import { logWarn } from '@/lib/observability/structured-log'
import {
  assessAtsEnhancementReadiness,
  buildResumeTextFromCvState,
  getAtsEnhancementBlockingItems,
} from '@/lib/profile/ats-enhancement'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import { createSession, applyToolPatchWithVersion } from '@/lib/db/sessions'
import { runAtsEnhancementPipeline } from '@/lib/agent/ats-enhancement-pipeline'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const trust = validateTrustedMutationRequest(request)
  if (!trust.ok) {
    logWarn('api.profile.ats_enhancement.untrusted_request', {
      appUserId: appUser.id,
      requestMethod: request.method,
      requestPath: request.nextUrl.pathname,
      success: false,
      trustSignal: trust.signal,
      trustReason: trust.reason,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = CVStateSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const readiness = assessAtsEnhancementReadiness(parsed.data)
  const missingItems = getAtsEnhancementBlockingItems(parsed.data)
  if (!readiness.isReady || missingItems.length > 0) {
    return NextResponse.json({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: missingItems.length > 0 ? missingItems : readiness.reasons,
      missingItems,
    }, { status: 400 })
  }

  const hasCredits = await checkUserQuota(appUser.id)
  if (!hasCredits) {
    return NextResponse.json({
      error: 'Seus créditos acabaram. Recarregue seu saldo para gerar uma versão ATS.',
    }, { status: 402 })
  }

  const generationValidation = validateGenerationCvState(parsed.data)
  if (!generationValidation.success) {
    return NextResponse.json({
      error: 'Complete seu currículo para gerar uma versão ATS.',
      reasons: [generationValidation.errorMessage],
      missingItems: [generationValidation.errorMessage],
    }, { status: 400 })
  }

  const session = await createSession(appUser.id)

  await applyToolPatchWithVersion(session, {
    cvState: parsed.data,
    agentState: {
      parseStatus: 'parsed',
      sourceResumeText: buildResumeTextFromCvState(parsed.data),
      workflowMode: 'ats_enhancement',
    },
  }, 'manual')

  const pipeline = await runAtsEnhancementPipeline(session)
  if (!pipeline.success || !pipeline.optimizedCvState) {
    return NextResponse.json({
      error: pipeline.error ?? 'Não foi possível melhorar sua versão ATS agora.',
      reasons: pipeline.validation?.issues.map((issue) => issue.message),
    }, { status: 500 })
  }

  const generationResult = await dispatchToolWithContext('generate_file', {
    cv_state: pipeline.optimizedCvState,
    idempotency_key: `profile-ats:${session.id}`,
  }, session)

  if (generationResult.outputFailure) {
    return NextResponse.json({
      error: generationResult.outputFailure.error,
      code: generationResult.outputFailure.code,
    }, {
      status: generationResult.outputFailure.code
        ? getHttpStatusForToolError(generationResult.outputFailure.code)
        : 500,
    })
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
    generationType: 'ATS_ENHANCEMENT',
  })
}
