import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createInsertTimestamps, createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import { logError, logInfo } from '@/lib/observability/structured-log'

import { extractAndSaveProfile } from './extract-profile'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ImportJobRow = {
  id: string
  user_id: string
  linkedin_url: string
  status: ImportJobStatus
  error_message: string | null
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createImportJob(
  appUserId: string,
  linkedinUrl: string,
): Promise<{ jobId: string }> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('linkedin_import_jobs')
    .insert({
      id: createDatabaseId(),
      user_id: appUserId,
      linkedin_url: linkedinUrl,
      status: 'pending' as ImportJobStatus,
      ...createInsertTimestamps(),
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create import job: ${error?.message}`)
  }

  logInfo('[import-jobs] Job created', { jobId: data.id, appUserId })

  return { jobId: data.id }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function getImportJob(
  jobId: string,
  appUserId: string,
): Promise<ImportJobRow | null> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('linkedin_import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', appUserId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get import job: ${error.message}`)
  }

  return (data as ImportJobRow | null) ?? null
}

// ---------------------------------------------------------------------------
// Claim and process
// ---------------------------------------------------------------------------

/**
 * Atomically claims a pending job and processes it.
 *
 * Uses an UPDATE ... WHERE status = 'pending' as an optimistic lock so that
 * concurrent status polls cannot double-process the same job. If a job is
 * already claimed by another request, this returns the current status without
 * re-processing.
 */
export async function claimAndProcessJob(
  jobId: string,
  appUserId: string,
): Promise<ImportJobRow> {
  const supabase = getSupabaseAdminClient()

  // Atomically claim: UPDATE only if status is still 'pending'.
  // If another request already claimed it, this returns zero rows.
  const now = new Date().toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from('linkedin_import_jobs')
    .update({
      status: 'processing' as ImportJobStatus,
      claimed_at: now,
      ...createUpdatedAtTimestamp(),
    })
    .eq('id', jobId)
    .eq('user_id', appUserId)
    .eq('status', 'pending')
    .select('*')
    .single()

  if (claimError && claimError.code !== 'PGRST116') {
    throw new Error(`Failed to claim job: ${claimError.message}`)
  }

  // Another request already claimed this job — return current state.
  if (!claimed) {
    const current = await getImportJob(jobId, appUserId)
    if (!current) throw new Error('Job not found')
    return current
  }

  // We own this job — run extraction.
  try {
    await extractAndSaveProfile(claimed.linkedin_url, appUserId)

    const { data: completed } = await supabase
      .from('linkedin_import_jobs')
      .update({
        status: 'completed' as ImportJobStatus,
        completed_at: new Date().toISOString(),
        ...createUpdatedAtTimestamp(),
      })
      .eq('id', jobId)
      .select('*')
      .single()

    logInfo('[import-jobs] Job completed', { jobId, appUserId })

    return (completed as ImportJobRow) ?? { ...claimed, status: 'completed' as ImportJobStatus }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    logError('[import-jobs] Job failed', { jobId, appUserId, error: errorMessage })

    const { data: failed } = await supabase
      .from('linkedin_import_jobs')
      .update({
        status: 'failed' as ImportJobStatus,
        error_message: errorMessage.slice(0, 500),
        ...createUpdatedAtTimestamp(),
      })
      .eq('id', jobId)
      .select('*')
      .single()

    return (failed as ImportJobRow) ?? { ...claimed, status: 'failed' as ImportJobStatus, error_message: errorMessage }
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete completed/failed jobs older than the given number of days.
 * Called from /api/cron/cleanup.
 */
export async function cleanupOldImportJobs(daysOld: number = 1): Promise<number> {
  const supabase = getSupabaseAdminClient()
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('linkedin_import_jobs')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('created_at', cutoff)
    .select('id')

  if (error) {
    logError('[import-jobs] Cleanup failed', { error: error.message, daysOld })
    throw error
  }

  const deletedCount = data?.length ?? 0

  if (deletedCount > 0) {
    logInfo('[import-jobs] Old jobs cleaned up', { deletedCount, daysOld })
  }

  return deletedCount
}
