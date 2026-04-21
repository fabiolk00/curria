import { TOOL_ERROR_CODES, getHttpStatusForToolError } from '@/lib/agent/tool-errors'
import { getLatestCvVersionForScope } from '@/lib/db/cv-versions'
import type { CVState } from '@/types/cv'

import type { PatchedSmartGenerationSession, SmartGenerationContext, SmartGenerationDecision } from './types'
import { dispatchSmartGenerationArtifact, runSmartGenerationPipeline } from './dispatch'
import { evaluateSmartGenerationValidation } from './generation-validation'
import { evaluateSmartGenerationReadiness } from './readiness'
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
  // 2. validate readiness and quota
  // 3. bootstrap the session with the request snapshot
  // 4. run the selected pipeline and artifact generation
  // 5. normalize the public outcome
  const workflowMode = resolveWorkflowMode(context.targetJobDescription)
  const copy = buildGenerationCopy(workflowMode)
  const readinessError = await evaluateSmartGenerationReadiness(context)
  if (readinessError) {
    return readinessError
  }

  const validationError = evaluateSmartGenerationValidation(context)
  if (validationError) {
    return validationError
  }

  const { session, patchedSession } = await bootstrapSmartGenerationSession(context)
  const workflow = { workflowMode, copy, session, patchedSession } as const
  const pipeline = await runSmartGenerationPipeline(patchedSession, workflowMode)

  if (!pipeline.success || !pipeline.optimizedCvState) {
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
    return handoffFailure
  }

  const generationResult = await dispatchSmartGenerationArtifact({
    patchedSession,
    optimizedCvState: pipeline.optimizedCvState,
    idempotencyKey: `${copy.idempotencyKeyPrefix}:${session.id}`,
  })

  if (generationResult.outputFailure) {
    return normalizeSmartGenerationDispatchFailure(generationResult)
  }

  return normalizeSmartGenerationSuccess({
    context,
    sessionId: session.id,
    optimizedCvState: pipeline.optimizedCvState,
    generationResult,
    workflow,
  })
}
