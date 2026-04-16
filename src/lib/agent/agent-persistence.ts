import { appendMessage, applyToolPatchWithVersion } from '@/lib/db/sessions'
import type { AgentDoneChunk, AgentPatchChunk, Session } from '@/types/agent'

type SessionPatch = NonNullable<Parameters<typeof applyToolPatchWithVersion>[1]>
type PatchOrigin = Parameters<typeof applyToolPatchWithVersion>[2]

export async function appendUserTurn(sessionId: string, userMessage: string): Promise<void> {
  await appendMessage(sessionId, 'user', userMessage)
}

export async function appendAssistantTurn(sessionId: string, assistantText: string): Promise<void> {
  await appendMessage(sessionId, 'assistant', assistantText)
}

export async function persistAsyncAcknowledgement(params: {
  sessionId: string
  userMessage: string
  assistantText: string
}): Promise<void> {
  await appendUserTurn(params.sessionId, params.userMessage)
  await appendAssistantTurn(params.sessionId, params.assistantText)
}

export async function persistPatch(
  session: Session,
  patch: SessionPatch,
  origin?: PatchOrigin,
): Promise<SessionPatch> {
  await applyToolPatchWithVersion(session, patch, origin)
  return patch
}

export function createPatchChunk(
  session: Session,
  patch: SessionPatch,
): AgentPatchChunk {
  return {
    type: 'patch',
    patch,
    phase: session.phase,
  }
}

export function buildDoneChunk(params: {
  requestId: string
  session: Session
  isNewSession: boolean
  toolIterations: number
  maxMessages: number
}): AgentDoneChunk {
  return {
    type: 'done',
    requestId: params.requestId,
    sessionId: params.session.id,
    phase: params.session.phase,
    atsScore: params.session.atsScore,
    messageCount: params.session.messageCount + 1,
    maxMessages: params.maxMessages,
    isNewSession: params.isNewSession,
    toolIterations: params.toolIterations,
  }
}
