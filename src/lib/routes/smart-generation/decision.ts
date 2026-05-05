import { TOOL_ERROR_CODES, getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import {
  SmartGenerationStartLockBackendError,
  markSmartGenerationStartLockCompletedDurable,
  markSmartGenerationStartLockFailedDurable,
  tryAcquireSmartGenerationStartLockDurable,
  type SmartGenerationStartLockBackend,
} from '@/lib/agent/smart-generation-start-lock'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import type { CVState } from '@/types/cv'

import type { PatchedSmartGenerationSession, SmartGenerationContext, SmartGenerationDecision } from './types'
import { dispatchSmartGenerationArtifact, runSmartGenerationPipeline } from './dispatch'
import { evaluateSmartGenerationValidation } from './generation-validation'
import {
  evaluateSmartGenerationQuotaReadiness,
  evaluateSmartGenerationResumeReadiness,
} from './readiness'
import {
  normalizeSmartGenerationDispatchFailure,
  normalizeSmartGenerationPipelineFailure,
  normalizeSmartGenerationSuccess,
} from './result-normalization'
import { bootstrapSmartGenerationSession } from './session-bootstrap'
import { buildGenerationCopy, resolveWorkflowMode } from './workflow-mode'
export { buildGenerationCopy, resolveWorkflowMode } from './workflow-mode'

const SMART_GENERATION_VERSION_SOURCES = new Set(['ats-enhancement', 'job-targeting'])

function areCvStatesEqual(left: CVState, right: CVState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function buildSmartGenerationHandoffFailure(): Extract<SmartGenerationDecision, { kind: 'validation_error' }> {
  return {
    kind: 'validation_error',
    status: getHttpStatusForToolError(TOOL_ERROR_CODES.PRECONDITION_FAILED),
    body: {
      error: 'The optimized resume state is no longer coherent with the export handoff.',
      code: TOOL_ERROR_CODES.PRECONDITION_FAILED,
    },
  }
}

async function evaluateSmartGenerationHandoff(input: {
  sessionId: string
  patchedSession: PatchedSmartGenerationSession
  optimizedCvState: CVState
}): Promise<Extract<SmartGenerationDecision, { kind: 'validation_error' }> | null> {
  const optimizedSource = input.patchedSession.agentState.optimizedCvState
  if (!optimizedSource || !areCvStatesEqual(optimizedSource, input.optimizedCvState)) {
    return buildSmartGenerationHandoffFailure()
  }

  const latestCvVersion = await getLatestCvVersionForScope(input.sessionId)
  if (
    !latestCvVersion
    || !SMART_GENERATION_VERSION_SOURCES.has(latestCvVersion.source)
    || !areCvStatesEqual(latestCvVersion.snapshot, input.optimizedCvState)
  ) {
    return buildSmartGenerationHandoffFailure()
  }

  return null
}

export async function executeSmartGenerationDecision(
  context: SmartGenerationContext,
): Promise<SmartGenerationDecision> {
  // Execution order:
  // 1. resolve workflow mode and copy
  // 2. validate non-billing readiness and request shape
  // 3. acquire the stable start lock so duplicate replay bypasses fresh quota checks
  // 4. check quota for newly acquired work only
  // 5. bootstrap the session with the request snapshot
  // 6. run the selected pipeline and artifact generation
  // 7. normalize the public outcome
  const workflowMode = resolveWorkflowMode(context.targetJobDescription)
  const copy = buildGenerationCopy(workflowMode)
  const readinessError = evaluateSmartGenerationResumeReadiness(context)
  if (readinessError) {
    return readinessError
  }

  const validationError = evaluateSmartGenerationValidation(context)
  if (validationError) {
    return validationError
  }

  let smartGenerationStartIdempotencyKey: string
  let smartGenerationArtifactIdempotencyKey: string
  let smartGenerationStartLockBackend: SmartGenerationStartLockBackend
  {
    let lock: Awaited<ReturnType<typeof tryAcquireSmartGenerationStartLockDurable>>
    try {
      lock = workflowMode === 'job_targeting'
        ? await tryAcquireSmartGenerationStartLockDurable({
            workflowMode,
            userId: context.appUser.id,
            cvState: context.cvState,
            targetJobDescription: context.targetJobDescription ?? '',
          })
        : await tryAcquireSmartGenerationStartLockDurable({
            workflowMode,
            userId: context.appUser.id,
            cvState: context.cvState,
          })
    } catch (error) {
      if (error instanceof SmartGenerationStartLockBackendError) {
        return {
          kind: 'validation_error',
          status: 503,
          body: {
            error: error.message,
            code: error.code,
          },
        }
      }

      throw error
    }

    if (!lock.acquired) {
      return {
        kind: 'success',
        status: lock.status === 'already_running' ? 202 : 200,
        body: {
          success: true,
          status: lock.status,
          sessionId: lock.sessionId ?? '',
          generationType: copy.generationType,
          message: lock.message,
        },
      }
    }

    smartGenerationStartIdempotencyKey = lock.idempotencyKey
    smartGenerationArtifactIdempotencyKey = `${lock.idempotencyKey}:artifact`
    smartGenerationStartLockBackend = lock.backend
  }

  const quotaError = await evaluateSmartGenerationQuotaReadiness(context)
  if (quotaError) {
    await markSmartGenerationStartLockFailedDurable({
      idempotencyKey: smartGenerationStartIdempotencyKey,
      backend: smartGenerationStartLockBackend,
    })
    return quotaError
  }

  let startLockClosed = false

  const markStartLockFailed = async (): Promise<void> => {
    if (smartGenerationStartIdempotencyKey && smartGenerationStartLockBackend) {
      await markSmartGenerationStartLockFailedDurable({
        idempotencyKey: smartGenerationStartIdempotencyKey,
        backend: smartGenerationStartLockBackend,
      })
      startLockClosed = true
    }
  }

  const markStartLockCompleted = async (sessionId: string): Promise<void> => {
    if (smartGenerationStartIdempotencyKey && smartGenerationStartLockBackend) {
      await markSmartGenerationStartLockCompletedDurable({
        idempotencyKey: smartGenerationStartIdempotencyKey,
        sessionId,
        backend: smartGenerationStartLockBackend,
      })
      startLockClosed = true
    }
  }

  try {
    const { session, patchedSession } = await bootstrapSmartGenerationSession(context, {
      smartGenerationStartIdempotencyKey,
      smartGenerationStartLockBackend,
    })
    const workflow = { workflowMode, copy, session, patchedSession } as const
    const pipeline = await runSmartGenerationPipeline(patchedSession, workflowMode)

    if (!pipeline.success || !pipeline.optimizedCvState) {
      await markStartLockFailed()

      return normalizeSmartGenerationPipelineFailure({
        pipeline,
        workflow,
        sessionId: session.id,
        patchedSession,
      })
    }

    const handoffFailure = await evaluateSmartGenerationHandoff({
      sessionId: session.id,
      patchedSession,
      optimizedCvState: pipeline.optimizedCvState,
    })
    if (handoffFailure) {
      await markStartLockFailed()
      return handoffFailure
    }

    const generationResult = await dispatchSmartGenerationArtifact({
      patchedSession,
      optimizedCvState: pipeline.optimizedCvState,
      idempotencyKey: smartGenerationArtifactIdempotencyKey,
      workflowMode,
    })

    if (generationResult.outputFailure) {
      await markStartLockFailed()
      return normalizeSmartGenerationDispatchFailure(generationResult)
    }

    const decision = normalizeSmartGenerationSuccess({
      context,
      sessionId: session.id,
      optimizedCvState: pipeline.optimizedCvState,
      generationResult,
      workflow,
    })

    await markStartLockCompleted(session.id)

    return decision
  } catch (error) {
    if (!startLockClosed && smartGenerationStartIdempotencyKey && smartGenerationStartLockBackend) {
      await markSmartGenerationStartLockFailedDurable({
        idempotencyKey: smartGenerationStartIdempotencyKey,
        backend: smartGenerationStartLockBackend,
      }).catch(() => undefined)
    }

    throw error
  }
}
