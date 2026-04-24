import { CVStateSchema } from '@/lib/cv/schema'
import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { logWarn, serializeError } from '@/lib/observability/structured-log'
import type {
  ResumeGeneration,
  ResumeGenerationHistoryKind,
  ResumeGenerationType,
} from '@/types/agent'
import type { CVState } from '@/types/cv'

type ResumeGenerationRow = {
  id: string
  user_id: string
  session_id?: string | null
  resume_target_id?: string | null
  type: ResumeGenerationType
  status: ResumeGeneration['status']
  idempotency_key?: string | null
  history_kind?: ResumeGenerationHistoryKind | null
  history_title?: string | null
  history_description?: string | null
  target_role?: string | null
  target_job_snippet?: string | null
  source_cv_snapshot: unknown
  generated_cv_state?: unknown
  output_pdf_path?: string | null
  output_docx_path?: string | null
  failure_reason?: string | null
  error_message?: string | null
  version_number: number
  created_at: string
  updated_at: string
  completed_at?: string | null
  failed_at?: string | null
}

type PostgrestErrorLike = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

export type PendingResumeGenerationOperation = 'create' | 'reuse'

export class PendingResumeGenerationPersistenceError extends Error {
  readonly operation: PendingResumeGenerationOperation
  readonly dbCode?: string
  readonly dbDetails?: string
  readonly dbHint?: string
  readonly causeMessage?: string

  constructor(input: {
    message: string
    operation: PendingResumeGenerationOperation
    cause?: unknown
    dbCode?: string
    dbDetails?: string
    dbHint?: string
  }) {
    super(input.message, input.cause ? { cause: input.cause } : undefined)
    this.name = 'PendingResumeGenerationPersistenceError'
    this.operation = input.operation
    this.dbCode = input.dbCode
    this.dbDetails = input.dbDetails
    this.dbHint = input.dbHint
    this.causeMessage = input.cause instanceof Error ? input.cause.message : undefined
  }
}

function mapResumeGenerationRow(row: ResumeGenerationRow): ResumeGeneration {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id ?? undefined,
    resumeTargetId: row.resume_target_id ?? undefined,
    type: row.type,
    status: row.status,
    idempotencyKey: row.idempotency_key ?? undefined,
    historyKind: row.history_kind ?? undefined,
    historyTitle: row.history_title ?? undefined,
    historyDescription: row.history_description ?? undefined,
    targetRole: row.target_role ?? undefined,
    targetJobSnippet: row.target_job_snippet ?? undefined,
    sourceCvSnapshot: structuredClone(CVStateSchema.parse(row.source_cv_snapshot)),
    generatedCvState: row.generated_cv_state == null
      ? undefined
      : structuredClone(CVStateSchema.parse(row.generated_cv_state)),
    outputPdfPath: row.output_pdf_path ?? undefined,
    outputDocxPath: row.output_docx_path ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    errorMessage: row.error_message ?? undefined,
    versionNumber: row.version_number,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    failedAt: row.failed_at ? new Date(row.failed_at) : undefined,
  }
}

export async function getResumeGenerationByIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<ResumeGeneration | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('resume_generations')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle<ResumeGenerationRow>()

  if (error) {
    throw new Error(`Failed to load resume generation by idempotency key: ${error.message}`)
  }

  return data ? mapResumeGenerationRow(data) : null
}

export async function createPendingResumeGeneration(input: {
  userId: string
  sessionId?: string
  resumeTargetId?: string
  type: ResumeGenerationType
  idempotencyKey?: string
  historyKind: ResumeGenerationHistoryKind
  historyTitle: string
  historyDescription?: string | null
  targetRole?: string | null
  targetJobSnippet?: string | null
  sourceCvSnapshot: CVState
}): Promise<{ generation: ResumeGeneration; wasCreated: boolean }> {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()

  let versionQuery = supabase
    .from('resume_generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .eq('type', input.type)

  if (input.sessionId) {
    versionQuery = versionQuery.eq('session_id', input.sessionId)
  }

  if (input.resumeTargetId) {
    versionQuery = versionQuery.eq('resume_target_id', input.resumeTargetId)
  } else {
    versionQuery = versionQuery.is('resume_target_id', null)
  }

  const { count, error: countError } = await versionQuery

  if (countError) {
    throw new PendingResumeGenerationPersistenceError({
      message: `Failed to calculate resume generation version: ${countError.message}`,
      operation: 'create',
      cause: countError,
      dbCode: countError.code,
      dbDetails: countError.details,
      dbHint: countError.hint,
    })
  }

  const { data, error } = await supabase
    .from('resume_generations')
    .insert({
      id: createDatabaseId(),
      user_id: input.userId,
      session_id: input.sessionId ?? null,
      resume_target_id: input.resumeTargetId ?? null,
      type: input.type,
      status: 'pending',
      idempotency_key: input.idempotencyKey ?? null,
      history_kind: input.historyKind,
      history_title: input.historyTitle,
      history_description: input.historyDescription ?? null,
      target_role: input.targetRole ?? null,
      target_job_snippet: input.targetJobSnippet ?? null,
      source_cv_snapshot: structuredClone(input.sourceCvSnapshot),
      version_number: (count ?? 0) + 1,
      updated_at: now,
    })
    .select('*')
    .single<ResumeGenerationRow>()

  if (error && input.idempotencyKey && isDuplicateIdempotencyError(error)) {
    try {
      const existing = await getResumeGenerationByIdempotencyKey(input.userId, input.idempotencyKey)
      if (existing) {
        return {
          generation: existing,
          wasCreated: false,
        }
      }
    } catch (reuseError) {
      throw new PendingResumeGenerationPersistenceError({
        message: 'Failed to reuse the existing pending resume generation after duplicate idempotency detection.',
        operation: 'reuse',
        cause: reuseError,
        dbCode: error.code,
        dbDetails: error.details,
        dbHint: error.hint,
      })
    }
  }

  if (error || !data) {
    logWarn('resume_generation.pending_generation.create_failed', {
      userId: input.userId,
      sessionId: input.sessionId,
      targetId: input.resumeTargetId,
      branch: 'create',
      idempotencyKey: input.idempotencyKey,
      dbCode: error?.code,
      dbDetails: error?.details,
      dbHint: error?.hint,
      ...serializeError(error),
    })
    throw new PendingResumeGenerationPersistenceError({
      message: `Failed to create resume generation: ${error?.message ?? 'Unknown error'}`,
      operation: 'create',
      cause: error,
      dbCode: error?.code,
      dbDetails: error?.details,
      dbHint: error?.hint,
    })
  }

  return {
    generation: mapResumeGenerationRow(data),
    wasCreated: true,
  }
}

function isDuplicateIdempotencyError(error: PostgrestErrorLike): boolean {
  return error.code === '23505' || error.message?.toLowerCase().includes('duplicate key') === true
}

export async function getLatestCompletedResumeGenerationForScope(input: {
  userId: string
  sessionId?: string
  resumeTargetId?: string
  type: ResumeGenerationType
}): Promise<ResumeGeneration | null> {
  const supabase = getSupabaseAdminClient()
  let query = supabase
    .from('resume_generations')
    .select('*')
    .eq('user_id', input.userId)
    .eq('type', input.type)
    .eq('status', 'completed')

  if (input.sessionId) {
    query = query.eq('session_id', input.sessionId)
  } else {
    query = query.is('session_id', null)
  }

  if (input.resumeTargetId) {
    query = query.eq('resume_target_id', input.resumeTargetId)
  } else {
    query = query.is('resume_target_id', null)
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<ResumeGenerationRow>()

  if (error) {
    throw new Error(`Failed to load latest completed resume generation: ${error.message}`)
  }

  return data ? mapResumeGenerationRow(data) : null
}

export async function updateResumeGeneration(input: {
  id: string
  status: ResumeGeneration['status']
  generatedCvState?: CVState
  outputPdfPath?: string
  outputDocxPath?: string
  failureReason?: string
  historyKind?: ResumeGenerationHistoryKind
  historyTitle?: string | null
  historyDescription?: string | null
  targetRole?: string | null
  targetJobSnippet?: string | null
  errorMessage?: string | null
  completedAt?: Date | null
  failedAt?: Date | null
}): Promise<ResumeGeneration> {
  const supabase = getSupabaseAdminClient()
  const update: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  }

  if ('generatedCvState' in input) {
    update.generated_cv_state = input.generatedCvState
      ? structuredClone(input.generatedCvState)
      : null
  }

  if ('outputPdfPath' in input) {
    update.output_pdf_path = input.outputPdfPath ?? null
  }

  if ('outputDocxPath' in input) {
    update.output_docx_path = input.outputDocxPath ?? null
  }

  if ('failureReason' in input) {
    update.failure_reason = input.failureReason ?? null
  }

  if ('historyKind' in input) {
    update.history_kind = input.historyKind
  }

  if ('historyTitle' in input) {
    update.history_title = input.historyTitle ?? null
  }

  if ('historyDescription' in input) {
    update.history_description = input.historyDescription ?? null
  }

  if ('targetRole' in input) {
    update.target_role = input.targetRole ?? null
  }

  if ('targetJobSnippet' in input) {
    update.target_job_snippet = input.targetJobSnippet ?? null
  }

  if ('errorMessage' in input) {
    update.error_message = input.errorMessage ?? null
  }

  if ('completedAt' in input) {
    update.completed_at = input.completedAt?.toISOString() ?? null
  }

  if ('failedAt' in input) {
    update.failed_at = input.failedAt?.toISOString() ?? null
  }

  const { data, error } = await supabase
    .from('resume_generations')
    .update(update)
    .eq('id', input.id)
    .select('*')
    .single<ResumeGenerationRow>()

  if (error || !data) {
    throw new Error(`Failed to update resume generation: ${error?.message ?? 'Unknown error'}`)
  }

  return mapResumeGenerationRow(data)
}

export async function listRecentResumeGenerationsForUser(
  userId: string,
  limit: number,
): Promise<ResumeGeneration[]> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('resume_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to list recent resume generations: ${error.message}`)
  }

  return (data ?? []).map((row) => mapResumeGenerationRow(row as ResumeGenerationRow))
}
