import type { CVState } from '@/types/cv'
import {
  markSmartGenerationStartLockRunningSessionDurable,
  type SmartGenerationStartLockBackend,
} from '@/lib/agent/job-targeting-start-lock'
import { applyToolPatchWithVersion, createSession } from '@/lib/db/sessions'
import { buildResumeTextFromCvState } from '@/lib/profile/ats-enhancement'

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
      workflowMode: params.workflowMode,
      targetJobDescription: params.targetJobDescription,
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
      workflowMode,
      targetJobDescription: context.targetJobDescription,
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
