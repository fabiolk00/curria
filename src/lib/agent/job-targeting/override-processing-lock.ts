import { createHash } from 'node:crypto'

import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import { mapSessionRow, type SessionRow } from '@/lib/db/session-normalization'
import type {
  AgentState,
  BlockedTargetedRewriteDraft,
  OverrideProcessingState,
  Session,
} from '@/types/agent'

const OVERRIDE_PROCESSING_LOCK_RETRIES = 5

export type AcquireOverrideProcessingLockInput = {
  sessionId: string
  userId: string
  draftId: string
  overrideToken: string
  requestId: string
  now: Date
  lockTtlMs: number
  idempotencyKey: string
}

export type AcquireOverrideProcessingLockResult =
  | {
      acquired: true
      session: Session
      draft: BlockedTargetedRewriteDraft
      processingState: OverrideProcessingState
      expiredLockReclaimed: boolean
      previousRequestId?: string
      previousExpiresAt?: string
    }
  | {
      acquired: false
      reason:
        | 'already_processing'
        | 'token_invalid'
        | 'token_expired'
        | 'draft_missing'
        | 'session_missing'
        | 'already_completed'
      existingRequestId?: string
      processingExpiresAt?: string
      completedResult?: {
        cvVersionId?: string
        resumeGenerationId?: string
      }
    }

export function hashOverrideToken(overrideToken: string): string {
  return createHash('sha256').update(overrideToken).digest('hex')
}

function isExpired(timestamp?: string, now = Date.now()): boolean {
  if (!timestamp) {
    return false
  }

  const parsed = Date.parse(timestamp)
  return Number.isFinite(parsed) && parsed <= now
}

function buildProcessingState(params: {
  requestId: string
  idempotencyKey: string
  overrideTokenHash: string
  startedAt: Date
  lockTtlMs: number
}): OverrideProcessingState {
  return {
    status: 'processing',
    startedAt: params.startedAt.toISOString(),
    expiresAt: new Date(params.startedAt.getTime() + params.lockTtlMs).toISOString(),
    requestId: params.requestId,
    idempotencyKey: params.idempotencyKey,
    overrideTokenHash: params.overrideTokenHash,
  }
}

function applyProcessingState(
  agentState: AgentState,
  draft: BlockedTargetedRewriteDraft,
  processingState: OverrideProcessingState,
): AgentState {
  if (!agentState.recoverableValidationBlock) {
    return agentState
  }

  return {
    ...agentState,
    blockedTargetedRewriteDraft: {
      ...draft,
      overrideProcessing: processingState,
    },
    recoverableValidationBlock: {
      ...agentState.recoverableValidationBlock,
      overrideProcessing: processingState,
    },
  }
}

export async function tryAcquireOverrideProcessingLock(
  input: AcquireOverrideProcessingLockInput,
): Promise<AcquireOverrideProcessingLockResult> {
  const supabase = getSupabaseAdminClient()
  const overrideTokenHash = hashOverrideToken(input.overrideToken)

  for (let attempt = 0; attempt < OVERRIDE_PROCESSING_LOCK_RETRIES; attempt += 1) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .maybeSingle<SessionRow>()

    if (error) {
      throw new Error(`Failed to load session for override processing lock: ${error.message}`)
    }

    if (!data) {
      return {
        acquired: false,
        reason: 'session_missing',
      }
    }

    const session = mapSessionRow(data)
    const validationOverride = session.agentState.validationOverride
    if (
      validationOverride?.enabled
      && validationOverride.overrideTokenHash === overrideTokenHash
    ) {
      return {
        acquired: false,
        reason: 'already_completed',
        completedResult: {
          cvVersionId: validationOverride.cvVersionId,
          resumeGenerationId: validationOverride.resumeGenerationId,
        },
      }
    }

    const draft = session.agentState.blockedTargetedRewriteDraft
    if (!draft || !session.agentState.recoverableValidationBlock || draft.id !== input.draftId) {
      return {
        acquired: false,
        reason: 'draft_missing',
      }
    }

    if (draft.token !== input.overrideToken) {
      return {
        acquired: false,
        reason: 'token_invalid',
      }
    }

    if (isExpired(draft.expiresAt, input.now.getTime())) {
      return {
        acquired: false,
        reason: 'token_expired',
      }
    }

    const existingProcessing = draft.overrideProcessing ?? session.agentState.recoverableValidationBlock.overrideProcessing
    const expiredLock = existingProcessing && isExpired(existingProcessing.expiresAt, input.now.getTime())

    if (existingProcessing && !expiredLock) {
      return {
        acquired: false,
        reason: 'already_processing',
        existingRequestId: existingProcessing.requestId,
        processingExpiresAt: existingProcessing.expiresAt,
      }
    }

    const processingState = buildProcessingState({
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      overrideTokenHash,
      startedAt: input.now,
      lockTtlMs: input.lockTtlMs,
    })
    const nextAgentState = applyProcessingState(session.agentState, draft, processingState)
    const { data: updatedRow, error: updateError } = await supabase
      .from('sessions')
      .update({
        agent_state: nextAgentState,
        state_version: session.stateVersion + 1,
        ...createUpdatedAtTimestamp(),
      })
      .eq('id', session.id)
      .eq('user_id', input.userId)
      .eq('state_version', session.stateVersion)
      .select('*')
      .maybeSingle<SessionRow>()

    if (updateError) {
      throw new Error(`Failed to persist override processing lock: ${updateError.message}`)
    }

    if (!updatedRow) {
      continue
    }

    const updatedSession = mapSessionRow(updatedRow)
    const updatedDraft = updatedSession.agentState.blockedTargetedRewriteDraft

    if (!updatedDraft) {
      return {
        acquired: false,
        reason: 'draft_missing',
      }
    }

    return {
      acquired: true,
      session: updatedSession,
      draft: updatedDraft,
      processingState,
      expiredLockReclaimed: Boolean(expiredLock),
      previousRequestId: existingProcessing?.requestId,
      previousExpiresAt: existingProcessing?.expiresAt,
    }
  }

  return {
    acquired: false,
    reason: 'already_processing',
  }
}
