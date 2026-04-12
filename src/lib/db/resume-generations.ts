import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import type { ResumeGeneration, ResumeGenerationType } from '@/types/agent'
import type { CVState } from '@/types/cv'

type ResumeGenerationRow = {
  id: string
  user_id: string
  session_id?: string | null
  resume_target_id?: string | null
  type: ResumeGenerationType
  status: ResumeGeneration['status']
  idempotency_key?: string | null
  source_cv_snapshot: CVState
  generated_cv_state?: CVState | null
  output_pdf_path?: string | null
  output_docx_path?: string | null
  failure_reason?: string | null
  version_number: number
  created_at: string
  updated_at: string
}

type PostgrestErrorLike = {
  code?: string
  message?: string
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
    sourceCvSnapshot: structuredClone(row.source_cv_snapshot),
    generatedCvState: row.generated_cv_state ? structuredClone(row.generated_cv_state) : undefined,
    outputPdfPath: row.output_pdf_path ?? undefined,
    outputDocxPath: row.output_docx_path ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    versionNumber: row.version_number,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
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
  sourceCvSnapshot: CVState
}): Promise<{ generation: ResumeGeneration; wasCreated: boolean }> {
  const supabase = getSupabaseAdminClient()

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
    throw new Error(`Failed to calculate resume generation version: ${countError.message}`)
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
      source_cv_snapshot: structuredClone(input.sourceCvSnapshot),
      version_number: (count ?? 0) + 1,
    })
    .select('*')
    .single<ResumeGenerationRow>()

  if (error && input.idempotencyKey && isDuplicateIdempotencyError(error)) {
    const existing = await getResumeGenerationByIdempotencyKey(input.userId, input.idempotencyKey)
    if (existing) {
      return {
        generation: existing,
        wasCreated: false,
      }
    }
  }

  if (error || !data) {
    throw new Error(`Failed to create resume generation: ${error?.message ?? 'Unknown error'}`)
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
}): Promise<ResumeGeneration> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('resume_generations')
    .update({
      status: input.status,
      generated_cv_state: input.generatedCvState ? structuredClone(input.generatedCvState) : null,
      output_pdf_path: input.outputPdfPath ?? null,
      output_docx_path: input.outputDocxPath ?? null,
      failure_reason: input.failureReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.id)
    .select('*')
    .single<ResumeGenerationRow>()

  if (error || !data) {
    throw new Error(`Failed to update resume generation: ${error?.message ?? 'Unknown error'}`)
  }

  return mapResumeGenerationRow(data)
}
