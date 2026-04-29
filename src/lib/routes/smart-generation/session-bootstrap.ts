import type { CVState } from '@/types/cv'
import {
  markSmartGenerationStartLockRunningSessionDurable,
  type SmartGenerationStartLockBackend,
} from '@/lib/agent/smart-generation-start-lock'
import { applyToolPatchWithVersion, createSession } from '@/lib/db/sessions'
import { buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'
import { buildGenerationStatePatch } from '@/lib/resume-generation/generation-state'

import type { SmartGenerationContext } from './types'
import { resolveWorkflowMode, type SmartGenerationWorkflowMode } from './workflow-mode'

export function buildPatchedSession(
  session: Awaited<ReturnType<typeof createSession>>,
  params: {
    cvState: CVState
    workflowMode: SmartGenerationWorkflowMode
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
      ...buildGenerationStatePatch({
        workflowMode: params.workflowMode,
        targetJobDescription: params.targetJobDescription,
      }).agentState,
    },
  }
}

export async function bootstrapSmartGenerationSession(
  context: SmartGenerationContext,
  options?: {
    smartGenerationStartIdempotencyKey?: string
    smartGenerationStartLockBackend?: SmartGenerationStartLockBackend
  },
) {
  const workflowMode = resolveWorkflowMode(context.targetJobDescription)
  const sourceResumeText = buildResumeTextFromCvState(context.cvState)
  const session = await createSession(context.appUser.id)

  if (options?.smartGenerationStartIdempotencyKey) {
    await markSmartGenerationStartLockRunningSessionDurable({
      idempotencyKey: options.smartGenerationStartIdempotencyKey,
      sessionId: session.id,
      backend: options.smartGenerationStartLockBackend ?? 'memory_fallback',
    })
  }

  await applyToolPatchWithVersion(session, {
    cvState: context.cvState,
    agentState: {
      parseStatus: 'parsed',
      sourceResumeText,
      // agentState currently stores generation-state fields for backward compatibility.
      // New generation orchestration should use generation-state helpers for these writes.
      ...buildGenerationStatePatch({
        workflowMode,
        targetJobDescription: context.targetJobDescription,
      }).agentState,
    },
  }, 'manual')

  return {
    session,
    patchedSession: buildPatchedSession(session, {
      cvState: context.cvState,
      workflowMode,
      sourceResumeText,
      targetJobDescription: context.targetJobDescription,
    }),
  }
}
