import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createInsertTimestamps, createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import type {
  JobErrorRef,
  JobInputRef,
  JobProgress,
  JobResultRef,
  JobStatus,
  JobStatusSnapshot,
  JobType,
} from '@/types/jobs'

type JobRow = {
  id: string
  user_id: string
  session_id: string | null
  resume_target_id: string | null
  idempotency_key: string
  type: JobType
  status: JobStatus
  stage: string | null
  progress: unknown
  dispatch_input_ref: unknown
  terminal_result_ref: unknown
  terminal_error_ref: unknown
  metadata: unknown
  claimed_at: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

type PostgrestErrorLike = {
  code?: string
  message?: string
}

const STALE_RUNNING_MINUTES = 5

function mapProgress(value: unknown): JobProgress | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const progress = value as Record<string, unknown>
  const mapped: JobProgress = {}

  if (typeof progress.percent === 'number') {
    mapped.percent = progress.percent
  }

  if (typeof progress.label === 'string') {
    mapped.label = progress.label
  }

  return Object.keys(mapped).length > 0 ? mapped : undefined
}

function mapJsonRef<T>(value: unknown): T | undefined {
  if (value == null) {
    return undefined
  }

  return structuredClone(value as T)
}

function isDuplicateIdempotencyError(error: PostgrestErrorLike): boolean {
  return error.code === '23505' || error.message?.toLowerCase().includes('duplicate key') === true
}

function isStaleRunning(row: JobRow): boolean {
  if (row.status !== 'running' || !row.claimed_at) {
    return false
  }

  return Date.now() - new Date(row.claimed_at).getTime() > STALE_RUNNING_MINUTES * 60 * 1000
}

async function getJobByIdempotencyKey(
  userId: string,
  type: JobType,
  idempotencyKey: string,
): Promise<JobStatusSnapshot | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle<JobRow>()

  if (error) {
    throw new Error(`Failed to load job by idempotency key: ${error.message}`)
  }

  return data ? mapJobRowToStatusSnapshot(data) : null
}

async function atomicClaim(
  jobId: string,
  userId: string,
  fromStatus: JobStatus,
  stage?: string,
  expectedClaimedAt?: string,
): Promise<JobStatusSnapshot | null> {
  const supabase = getSupabaseAdminClient()
  const claimedAt = new Date().toISOString()
  const update: Record<string, unknown> = {
    status: 'running' satisfies JobStatus,
    claimed_at: claimedAt,
    started_at: claimedAt,
    terminal_error_ref: null,
    ...createUpdatedAtTimestamp(),
  }

  if (stage !== undefined) {
    update.stage = stage
  }

  let query = supabase
    .from('jobs')
    .update(update)
    .eq('id', jobId)
    .eq('user_id', userId)
    .eq('status', fromStatus)

  if (expectedClaimedAt !== undefined) {
    query = query.eq('claimed_at', expectedClaimedAt)
  }

  const { data, error } = await query.select('*').single<JobRow>()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to claim job: ${error.message}`)
  }

  return data ? mapJobRowToStatusSnapshot(data) : null
}

async function persistTerminalStatus(input: {
  jobId: string
  userId: string
  ownerClaimedAt: string
  status: Extract<JobStatus, 'completed' | 'failed' | 'cancelled'>
  stage?: string
  progress?: JobProgress
  resultRef?: JobResultRef
  errorRef?: JobErrorRef
}): Promise<JobStatusSnapshot> {
  const supabase = getSupabaseAdminClient()
  const terminalTimestamp = new Date().toISOString()
  const update: Record<string, unknown> = {
    status: input.status,
    progress: input.progress ? structuredClone(input.progress) : null,
    terminal_result_ref: input.resultRef ? structuredClone(input.resultRef) : null,
    terminal_error_ref: input.errorRef ? structuredClone(input.errorRef) : null,
    ...createUpdatedAtTimestamp(),
  }

  if (input.stage !== undefined) {
    update.stage = input.stage
  }

  if (input.status === 'completed' || input.status === 'failed') {
    update.completed_at = terminalTimestamp
    update.cancelled_at = null
  }

  if (input.status === 'cancelled') {
    update.cancelled_at = terminalTimestamp
    update.completed_at = null
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(update)
    .eq('id', input.jobId)
    .eq('user_id', input.userId)
    .eq('claimed_at', input.ownerClaimedAt)
    .select('*')
    .single<JobRow>()

  if (error || !data) {
    throw new Error(
      `Failed to persist ${input.status} for job ${input.jobId}: ${error?.message ?? 'no row returned'}`,
    )
  }

  return mapJobRowToStatusSnapshot(data)
}

export function mapJobRowToStatusSnapshot(row: JobRow): JobStatusSnapshot {
  return {
    jobId: row.id,
    userId: row.user_id,
    sessionId: row.session_id ?? undefined,
    resumeTargetId: row.resume_target_id ?? undefined,
    idempotencyKey: row.idempotency_key,
    type: row.type,
    status: row.status,
    stage: row.stage ?? undefined,
    progress: mapProgress(row.progress),
    dispatchInputRef: mapJsonRef<JobInputRef>(row.dispatch_input_ref)!,
    terminalResultRef: mapJsonRef<JobResultRef>(row.terminal_result_ref),
    terminalErrorRef: mapJsonRef<JobErrorRef>(row.terminal_error_ref),
    claimedAt: row.claimed_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createJob(input: {
  userId: string
  sessionId?: string
  resumeTargetId?: string
  type: JobType
  idempotencyKey: string
  stage?: string
  progress?: JobProgress
  dispatchInputRef: JobInputRef
  metadata?: Record<string, unknown>
}): Promise<{ job: JobStatusSnapshot; wasCreated: boolean }> {
  if (!input.idempotencyKey.trim()) {
    throw new Error('Durable jobs require a non-empty idempotency key.')
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      id: createDatabaseId(),
      user_id: input.userId,
      session_id: input.sessionId ?? null,
      resume_target_id: input.resumeTargetId ?? null,
      idempotency_key: input.idempotencyKey,
      type: input.type,
      status: 'queued' satisfies JobStatus,
      stage: input.stage ?? null,
      progress: input.progress ? structuredClone(input.progress) : null,
      dispatch_input_ref: structuredClone(input.dispatchInputRef),
      metadata: input.metadata ? structuredClone(input.metadata) : null,
      ...createInsertTimestamps(),
    })
    .select('*')
    .single<JobRow>()

  if (error && isDuplicateIdempotencyError(error)) {
    const existing = await getJobByIdempotencyKey(input.userId, input.type, input.idempotencyKey)
    if (existing) {
      return {
        job: existing,
        wasCreated: false,
      }
    }
  }

  if (error || !data) {
    throw new Error(`Failed to create job: ${error?.message ?? 'Unknown error'}`)
  }

  return {
    job: mapJobRowToStatusSnapshot(data),
    wasCreated: true,
  }
}

export async function getJob(
  jobId: string,
  userId: string,
): Promise<JobStatusSnapshot | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle<JobRow>()

  if (error) {
    throw new Error(`Failed to get job: ${error.message}`)
  }

  return data ? mapJobRowToStatusSnapshot(data) : null
}

export async function listJobsForUser(input: {
  userId: string
  type?: JobType
  status?: JobStatus
  limit?: number
}): Promise<JobStatusSnapshot[]> {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('jobs')
    .select('*')
    .eq('user_id', input.userId)

  if (input.type) {
    query = query.eq('type', input.type)
  }

  if (input.status) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 20)

  if (error) {
    throw new Error(`Failed to list jobs: ${error.message}`)
  }

  return ((data ?? []) as JobRow[]).map(mapJobRowToStatusSnapshot)
}

export async function claimJob(input: {
  jobId: string
  userId: string
  stage?: string
}): Promise<JobStatusSnapshot | null> {
  let claimed = await atomicClaim(input.jobId, input.userId, 'queued', input.stage)

  if (!claimed) {
    const current = await getJob(input.jobId, input.userId)
    if (!current) {
      return null
    }

    const currentRow: JobRow = {
      id: current.jobId,
      user_id: current.userId,
      session_id: current.sessionId ?? null,
      resume_target_id: current.resumeTargetId ?? null,
      idempotency_key: current.idempotencyKey,
      type: current.type,
      status: current.status,
      stage: current.stage ?? null,
      progress: current.progress ?? null,
      dispatch_input_ref: current.dispatchInputRef,
      terminal_result_ref: current.terminalResultRef ?? null,
      terminal_error_ref: current.terminalErrorRef ?? null,
      metadata: null,
      claimed_at: current.claimedAt ?? null,
      started_at: current.startedAt ?? null,
      completed_at: current.completedAt ?? null,
      cancelled_at: current.cancelledAt ?? null,
      created_at: current.createdAt,
      updated_at: current.updatedAt,
    }

    if (isStaleRunning(currentRow)) {
      claimed = await atomicClaim(
        input.jobId,
        input.userId,
        'running',
        input.stage,
        current.claimedAt,
      )
    }

    if (!claimed) {
      return current
    }
  }

  return claimed
}

export async function completeJob(input: {
  jobId: string
  userId: string
  ownerClaimedAt: string
  stage?: string
  progress?: JobProgress
  resultRef: JobResultRef
}): Promise<JobStatusSnapshot> {
  return persistTerminalStatus({
    ...input,
    status: 'completed',
  })
}

export async function failJob(input: {
  jobId: string
  userId: string
  ownerClaimedAt: string
  stage?: string
  progress?: JobProgress
  errorRef: JobErrorRef
}): Promise<JobStatusSnapshot> {
  return persistTerminalStatus({
    ...input,
    status: 'failed',
  })
}

export async function cancelJob(input: {
  jobId: string
  userId: string
  ownerClaimedAt?: string
  stage?: string
  progress?: JobProgress
  errorRef?: JobErrorRef
}): Promise<JobStatusSnapshot> {
  if (input.ownerClaimedAt) {
    return persistTerminalStatus({
      jobId: input.jobId,
      userId: input.userId,
      ownerClaimedAt: input.ownerClaimedAt,
      status: 'cancelled',
      stage: input.stage,
      progress: input.progress,
      errorRef: input.errorRef,
    })
  }

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'cancelled' satisfies JobStatus,
      stage: input.stage ?? null,
      progress: input.progress ? structuredClone(input.progress) : null,
      terminal_error_ref: input.errorRef ? structuredClone(input.errorRef) : null,
      cancelled_at: new Date().toISOString(),
      ...createUpdatedAtTimestamp(),
    })
    .eq('id', input.jobId)
    .eq('user_id', input.userId)
    .eq('status', 'queued')
    .select('*')
    .single<JobRow>()

  if (error || !data) {
    throw new Error(`Failed to cancel queued job ${input.jobId}: ${error?.message ?? 'no row returned'}`)
  }

  return mapJobRowToStatusSnapshot(data)
}

export async function resetStaleJobs(input: {
  userId?: string
  type?: JobType
} = {}): Promise<number> {
  const supabase = getSupabaseAdminClient()
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MINUTES * 60 * 1000).toISOString()
  let query = supabase
    .from('jobs')
    .update({
      status: 'queued' satisfies JobStatus,
      claimed_at: null,
      started_at: null,
      progress: null,
      terminal_error_ref: null,
      ...createUpdatedAtTimestamp(),
    })
    .eq('status', 'running')
    .lt('claimed_at', staleCutoff)

  if (input.userId) {
    query = query.eq('user_id', input.userId)
  }

  if (input.type) {
    query = query.eq('type', input.type)
  }

  const { data, error } = await query.select('id')

  if (error) {
    throw new Error(`Failed to reset stale jobs: ${error.message}`)
  }

  return data?.length ?? 0
}
