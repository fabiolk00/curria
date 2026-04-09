import type {
  AgentState,
  AgentStatePatch,
  CVVersionSource,
  GeneratedOutput,
  Message,
  Phase,
  Session,
  ToolPatch,
} from '@/types/agent'
import type { ATSScoreResult, CVState } from '@/types/cv'
import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import {
  createCreatedAtTimestamp,
  createInsertTimestamps,
  createUpdatedAtTimestamp,
} from '@/lib/db/timestamps'

// Increment only when the top-level session state bundle shape or interpretation changes.
export const CURRENT_SESSION_STATE_VERSION = 1

const EMPTY_CV_STATE: CVState = {
  fullName: '', email: '', phone: '', summary: '',
  experience: [], skills: [], education: [],
}

const EMPTY_AGENT_STATE: AgentState = {
  parseStatus: 'empty',
  rewriteHistory: {},
}

const EMPTY_GENERATED_OUTPUT: GeneratedOutput = {
  status: 'idle',
}

type SessionRow = {
  id: string
  user_id: string
  state_version?: number | null
  phase: string
  cv_state: CVState | null
  agent_state: unknown
  generated_output: unknown
  ats_score: ATSScoreResult | null
  credits_used: number
  message_count?: number | null
  credit_consumed?: boolean | null
  created_at: string
  updated_at: string
}

function cloneCvState(value?: CVState): CVState {
  if (!value) {
    return {
      ...EMPTY_CV_STATE,
      experience: [],
      skills: [],
      education: [],
    }
  }

  return {
    ...value,
    experience: Array.isArray(value.experience) ? [...value.experience] : [],
    skills: Array.isArray(value.skills) ? [...value.skills] : [],
    education: Array.isArray(value.education) ? [...value.education] : [],
    certifications: Array.isArray(value.certifications) ? [...value.certifications] : undefined,
  }
}

function normalizeAgentState(value: unknown): AgentState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...EMPTY_AGENT_STATE,
      rewriteHistory: {},
    }
  }

  return {
    ...EMPTY_AGENT_STATE,
    ...(value as Partial<AgentState>),
    rewriteHistory: {
      ...EMPTY_AGENT_STATE.rewriteHistory,
      ...((value as Partial<AgentState>).rewriteHistory ?? {}),
    },
  }
}

export function normalizeGeneratedOutput(value: unknown): GeneratedOutput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ...EMPTY_GENERATED_OUTPUT,
    }
  }

  return {
    ...EMPTY_GENERATED_OUTPUT,
    ...(value as Partial<GeneratedOutput>),
  }
}

export function normalizeStateVersion(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return CURRENT_SESSION_STATE_VERSION
  }

  return value
}

function mapSessionRow(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    stateVersion: normalizeStateVersion(row.state_version),
    phase: row.phase as Phase,
    cvState: cloneCvState(row.cv_state ?? EMPTY_CV_STATE),
    agentState: normalizeAgentState(row.agent_state),
    generatedOutput: normalizeGeneratedOutput(row.generated_output),
    atsScore: row.ats_score ?? undefined,
    creditsUsed: row.credits_used,
    messageCount: row.message_count ?? 0,
    creditConsumed: row.credit_consumed ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}

function mergeAgentState(current: AgentState, patch: AgentStatePatch): AgentState {
  return {
    ...current,
    ...patch,
    attachedFile: patch.attachedFile === undefined
      ? current.attachedFile
      : {
          ...(current.attachedFile ?? {}),
          ...patch.attachedFile,
        },
    rewriteHistory: {
      ...current.rewriteHistory,
      ...(patch.rewriteHistory ?? {}),
    },
    phaseMeta: patch.phaseMeta === undefined
      ? current.phaseMeta
      : {
          ...(current.phaseMeta ?? {}),
          ...patch.phaseMeta,
        },
  }
}

export function mergeToolPatch(session: Session, patch: ToolPatch): Session {
  const nextCvState = patch.cvState === undefined
    ? cloneCvState(session.cvState)
    : cloneCvState({
        ...session.cvState,
        ...patch.cvState,
      })

  const nextAgentState = patch.agentState === undefined
    ? normalizeAgentState(session.agentState)
    : normalizeAgentState(mergeAgentState(session.agentState, patch.agentState))

  const nextGeneratedOutput = patch.generatedOutput === undefined
    ? normalizeGeneratedOutput(session.generatedOutput)
    : normalizeGeneratedOutput({
        ...session.generatedOutput,
        ...patch.generatedOutput,
      })

  return {
    ...session,
    stateVersion: session.stateVersion,
    phase: patch.phase ?? session.phase,
    cvState: nextCvState,
    agentState: nextAgentState,
    generatedOutput: nextGeneratedOutput,
    atsScore: patch.atsScore ?? session.atsScore,
    updatedAt: new Date(),
  }
}

async function getUserSessions(appUserId: string, limit = 20): Promise<Session[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', appUserId)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return data.map(row => mapSessionRow(row as SessionRow))
}

export async function getSession(sessionId: string, appUserId: string): Promise<Session | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('user_id', appUserId)
    .single()

  if (error || !data) return null

  return mapSessionRow(data as SessionRow)
}

/**
 * Fetch and seed cvState from UserProfile if available.
 * Returns the seeded cvState or empty cvState if no profile exists.
 */
async function seedCvStateFromProfile(appUserId: string): Promise<CVState> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('cv_state')
    .eq('user_id', appUserId)
    .single()

  if (data && data.cv_state) {
    return cloneCvState(data.cv_state as CVState)
  }

  return cloneCvState()
}

export async function createSession(appUserId: string): Promise<Session> {
  const supabase = getSupabaseAdminClient()
  const timestamps = createInsertTimestamps()

  // Seed cvState from UserProfile if available
  const cvState = await seedCvStateFromProfile(appUserId)

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      id: createDatabaseId(),
      ...timestamps,
      user_id:      appUserId,
      state_version: CURRENT_SESSION_STATE_VERSION,
      phase:        'intake',
      cv_state:     cvState,
      agent_state:  normalizeAgentState(undefined),
      generated_output: normalizeGeneratedOutput(undefined),
      credits_used: 0,
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Failed to create session: ${error?.message}`)

  return {
    id:             data.id,
    userId:         data.user_id,
    stateVersion:   normalizeStateVersion((data as SessionRow).state_version),
    phase:          'intake',
    cvState:        cloneCvState(cvState),
    agentState:     normalizeAgentState(undefined),
    generatedOutput: normalizeGeneratedOutput(undefined),
    creditsUsed:    0,
    messageCount:   0,
    creditConsumed: false,
    createdAt:      new Date(data.created_at),
    updatedAt:      new Date(data.updated_at),
  }
}

/**
 * Atomically consumes one credit and creates a new session in a single transaction.
 * Returns the new session if successful, or null if no credits are available.
 * Prevents credit loss when session creation would fail after a non-atomic credit decrement.
 * Seeds cvState from UserProfile if available.
 */
export async function createSessionWithCredit(appUserId: string): Promise<Session | null> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase.rpc('consume_credit_and_create_session', {
    p_user_id: appUserId,
  })

  if (error) throw new Error(`Failed to create session with credit: ${error.message}`)

  // RPC returns NULL when no credits available
  if (!data) return null

  const session = mapSessionRow(data as SessionRow)

  // If session has empty cvState, seed from UserProfile
  if (!session.cvState || Object.keys(session.cvState).length === 0 ||
      (session.cvState.fullName === '' && session.cvState.email === '')) {
    const profileCvState = await seedCvStateFromProfile(appUserId)
    if (profileCvState && Object.keys(profileCvState).length > 0) {
      // Update session with seeded cvState
      await updateSession(session.id, { cvState: profileCvState })
      session.cvState = profileCvState
    }
  }

  return session
}

export async function updateSession(
  sessionId: string,
  patch: Partial<{
    phase: Phase
    cvState: CVState
    agentState: AgentState
    generatedOutput: GeneratedOutput
    atsScore: ATSScoreResult
    creditsUsed: number
    messageCount: number
    creditConsumed: boolean
  }>,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  const update: Record<string, unknown> = { ...createUpdatedAtTimestamp() }
  if (patch.phase           !== undefined) update.phase            = patch.phase
  if (patch.cvState         !== undefined) update.cv_state         = patch.cvState
  if (patch.agentState      !== undefined) update.agent_state      = patch.agentState
  if (patch.generatedOutput !== undefined) update.generated_output = patch.generatedOutput
  if (patch.atsScore        !== undefined) update.ats_score        = patch.atsScore
  if (patch.creditsUsed     !== undefined) update.credits_used     = patch.creditsUsed
  if (patch.messageCount    !== undefined) update.message_count    = patch.messageCount
  if (patch.creditConsumed  !== undefined) update.credit_consumed  = patch.creditConsumed

  const { error } = await supabase.from('sessions').update(update).eq('id', sessionId)
  if (error) throw new Error(`Failed to update session: ${error.message}`)
}

export async function applyToolPatch(session: Session, patch?: ToolPatch): Promise<void> {
  if (!patch || Object.keys(patch).length === 0) {
    return
  }

  const mergedSession = mergeToolPatch(session, patch)

  await updateSession(session.id, {
    phase: patch.phase !== undefined ? mergedSession.phase : undefined,
    cvState: patch.cvState !== undefined ? mergedSession.cvState : undefined,
    agentState: patch.agentState !== undefined ? mergedSession.agentState : undefined,
    generatedOutput: patch.generatedOutput !== undefined ? mergedSession.generatedOutput : undefined,
    atsScore: patch.atsScore !== undefined ? mergedSession.atsScore : undefined,
  })

  session.phase = mergedSession.phase
  session.cvState = mergedSession.cvState
  session.agentState = mergedSession.agentState
  session.generatedOutput = mergedSession.generatedOutput
  session.atsScore = mergedSession.atsScore
  session.updatedAt = mergedSession.updatedAt
}

export async function applyGeneratedOutputPatch(
  session: Session,
  generatedOutputPatch: Partial<GeneratedOutput>,
): Promise<void> {
  const nextGeneratedOutput = normalizeGeneratedOutput({
    ...session.generatedOutput,
    ...generatedOutputPatch,
  })

  await updateSession(session.id, {
    generatedOutput: nextGeneratedOutput,
  })

  session.generatedOutput = nextGeneratedOutput
  session.updatedAt = new Date()
}

export async function applyToolPatchWithVersion(
  session: Session,
  patch: ToolPatch | undefined,
  versionSource?: CVVersionSource,
): Promise<void> {
  if (!patch || Object.keys(patch).length === 0) {
    return
  }

  const mergedSession = mergeToolPatch(session, patch)
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('apply_session_patch_with_version', {
    p_session_id: session.id,
    p_user_id: session.userId,
    p_phase: mergedSession.phase,
    p_cv_state: mergedSession.cvState,
    p_agent_state: mergedSession.agentState,
    p_generated_output: mergedSession.generatedOutput,
    p_ats_score: mergedSession.atsScore ?? null,
    p_version_source: versionSource ?? null,
  })

  if (error || data !== true) {
    throw new Error(`Failed to apply tool patch transactionally: ${error?.message ?? 'Unknown RPC failure'}`)
  }

  session.phase = mergedSession.phase
  session.cvState = mergedSession.cvState
  session.agentState = mergedSession.agentState
  session.generatedOutput = mergedSession.generatedOutput
  session.atsScore = mergedSession.atsScore
  session.updatedAt = mergedSession.updatedAt
}

export async function incrementMessageCount(sessionId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.rpc('increment_message_count', { session_id: sessionId })

  // Fallback: if RPC doesn't exist, use optimistic locking
  if (error && error.message.includes('function') && error.message.includes('does not exist')) {
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('message_count')
      .eq('id', sessionId)
      .single()

    if (!sessionData || sessionData.message_count >= 15) return false

    // Atomic update with optimistic lock
    const { data: updateData } = await supabase
      .from('sessions')
      .update({
        message_count: sessionData.message_count + 1,
        ...createUpdatedAtTimestamp(),
      })
      .eq('id', sessionId)
      .eq('message_count', sessionData.message_count)  // Only update if value hasn't changed
      .lt('message_count', 15)  // Only update if below cap
      .select('message_count')

    return updateData !== null && updateData.length > 0
  }

  if (error) throw new Error(`Failed to increment message count: ${error.message}`)
  return data === true
}

export async function getMessages(sessionId: string, limit = 12): Promise<Message[]> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data) return []

  return data
    .reverse()
    .map(r => ({ role: r.role as Message['role'], content: r.content, createdAt: new Date(r.created_at) }))
}

export async function appendMessage(
  sessionId: string,
  role: Message['role'],
  content: string,
): Promise<void> {
  const supabase = getSupabaseAdminClient()
  await supabase.from('messages').insert({
    id: createDatabaseId(),
    ...createCreatedAtTimestamp(),
    session_id: sessionId,
    role,
    content,
  })
}

export async function checkUserQuota(appUserId: string): Promise<boolean> {
  const { checkUserQuota: check } = await import('@/lib/asaas/quota')
  return check(appUserId)
}

export const db = {
  getUserSessions,
  getSession,
  createSession,
  updateSession,
  applyGeneratedOutputPatch,
  applyToolPatch,
  applyToolPatchWithVersion,
  getMessages,
  appendMessage,
  checkUserQuota,
  incrementMessageCount,
}
