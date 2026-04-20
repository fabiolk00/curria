import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import { logError, logInfo } from '@/lib/observability/structured-log'

import { extractAndSaveProfile } from './extract-profile'
import { toLinkedInImportLimitError } from './import-limits'

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
// Constants
// ---------------------------------------------------------------------------

/** Processing jobs older than this are considered abandoned and reclaimable. */
const STALE_PROCESSING_MINUTES = 5

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createImportJob(
  appUserId: string,
  linkedinUrl: string,
): Promise<{ jobId: string }> {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase.rpc('create_linkedin_import_job', {
    p_user_id: appUserId,
    p_linkedin_url: linkedinUrl,
  })

  const limitError = toLinkedInImportLimitError(error)
  if (limitError) {
    throw limitError
  }

  const row = Array.isArray(data) ? data[0] : data

  if (error || !row || typeof row.id !== 'string') {
    throw new Error(`Failed to create import job: ${error?.message}`)
  }

  logInfo('[import-jobs] Job created', { jobId: row.id, appUserId })

  return { jobId: row.id }
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
// Helpers
// ---------------------------------------------------------------------------

function isStaleProcessing(job: ImportJobRow): boolean {
  if (job.status !== 'processing' || !job.claimed_at) return false
  const claimedMs = new Date(job.claimed_at).getTime()
  return Date.now() - claimedMs > STALE_PROCESSING_MINUTES * 60 * 1000
}

/**
 * Atomically claim a job by transitioning it from the expected status
 * to 'processing'. Returns the claimed row, or null if another request
 * already transitioned it.
 *
 * When reclaiming a stale processing job, pass `expectedClaimedAt` to
 * fence the update on the observed lease value. This prevents two
 * concurrent polls from both reclaiming the same stale row.
 */
async function atomicClaim(
  jobId: string,
  appUserId: string,
  fromStatus: ImportJobStatus,
  expectedClaimedAt?: string,
): Promise<ImportJobRow | null> {
  const supabase = getSupabaseAdminClient()
  const now = new Date().toISOString()

  let query = supabase
    .from('linkedin_import_jobs')
    .update({
      status: 'processing' as ImportJobStatus,
      claimed_at: now,
      error_message: null,
      ...createUpdatedAtTimestamp(),
    })
    .eq('id', jobId)
    .eq('user_id', appUserId)
    .eq('status', fromStatus)

  // Fence reclaim on the observed lease value so concurrent polls
  // cannot both succeed on the same stale row.
  if (expectedClaimedAt !== undefined) {
    query = query.eq('claimed_at', expectedClaimedAt)
  }

  const { data, error } = await query.select('*').single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to claim job: ${error.message}`)
  }

  return (data as ImportJobRow | null) ?? null
}

/**
 * Persist the terminal status (completed or failed) and throw if the
 * write doesn't land. This prevents the API from reporting a state
 * that was never persisted.
 *
 * `ownerClaimedAt` is the `claimed_at` value set when this request
 * claimed the job. The update is fenced on it so that a timed-out
 * request cannot overwrite terminal state written by a later owner.
 */
async function persistTerminalStatus(
  jobId: string,
  ownerClaimedAt: string,
  status: 'completed' | 'failed',
  fields: { errorMessage?: string },
): Promise<ImportJobRow> {
  const supabase = getSupabaseAdminClient()

  const update: Record<string, unknown> = {
    status,
    ...createUpdatedAtTimestamp(),
  }

  if (status === 'completed') {
    update.completed_at = new Date().toISOString()
  }

  if (fields.errorMessage !== undefined) {
    update.error_message = fields.errorMessage.slice(0, 500)
  }

  const { data, error } = await supabase
    .from('linkedin_import_jobs')
    .update(update)
    .eq('id', jobId)
    .eq('claimed_at', ownerClaimedAt)
    .select('*')
    .single()

  if (error || !data) {
    const msg = `Failed to persist ${status} for job ${jobId}: ${error?.message ?? 'no row returned'}`
    logError('[import-jobs] Terminal status write failed', {
      jobId,
      targetStatus: status,
      ownerClaimedAt,
      error: error?.message ?? 'no row returned',
    })
    throw new Error(msg)
  }

  return data as ImportJobRow
}

// ---------------------------------------------------------------------------
// Claim and process
// ---------------------------------------------------------------------------

/**
 * Atomically claims a claimable job and processes it.
 *
 * A job is claimable when it is:
 *   - status = 'pending'  (never started), OR
 *   - status = 'processing' AND claimed_at older than STALE_PROCESSING_MINUTES
 *     (previous request died mid-extraction — lease expired).
 *
 * Uses UPDATE … WHERE status = <expected> as an optimistic lock so that
 * concurrent polls cannot double-process the same job.
 *
 * Terminal-status writes (completed / failed) throw on persistence failure
 * so the API never reports a state the database doesn't reflect.
 */
export async function claimAndProcessJob(
  jobId: string,
  appUserId: string,
): Promise<ImportJobRow> {
  // Try to claim from 'pending' first.
  let claimed = await atomicClaim(jobId, appUserId, 'pending')

  // If not pending, check for stale 'processing' (abandoned lease).
  if (!claimed) {
    const current = await getImportJob(jobId, appUserId)
    if (!current) throw new Error('Job not found')

    if (isStaleProcessing(current)) {
      logInfo('[import-jobs] Reclaiming stale processing job', {
        jobId,
        appUserId,
        claimedAt: current.claimed_at,
      })
      // Fence on the observed claimed_at so a concurrent poll that
      // read the same stale row cannot also reclaim it.
      claimed = await atomicClaim(jobId, appUserId, 'processing', current.claimed_at!)
    }

    // Job is in a state we can't claim (completed, failed, or freshly processing).
    if (!claimed) {
      return current
    }
  }

  // We own this job — run extraction.
  // Thread our claimed_at as the ownership token for terminal writes.
  const ownerClaimedAt = claimed.claimed_at!

  try {
    await extractAndSaveProfile(claimed.linkedin_url, appUserId)

    const completed = await persistTerminalStatus(jobId, ownerClaimedAt, 'completed', {})
    logInfo('[import-jobs] Job completed', { jobId, appUserId })
    return completed
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logError('[import-jobs] Job failed', { jobId, appUserId, error: errorMessage })

    // If extraction failed, try to persist the failure status.
    // If that also fails, let it throw — the route returns 500.
    const failed = await persistTerminalStatus(jobId, ownerClaimedAt, 'failed', { errorMessage })
    return failed
  }
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Delete completed/failed jobs older than the given number of days.
 * Also resets stale processing jobs (lease expired) back to pending
 * so they can be retried on the next poll.
 *
 * Called from /api/cron/cleanup.
 */
export async function cleanupOldImportJobs(daysOld: number = 1): Promise<number> {
  const supabase = getSupabaseAdminClient()
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString()

  // Delete old terminal jobs.
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

  // Reset stale processing jobs back to pending.
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString()
  const { data: resetData, error: resetError } = await supabase
    .from('linkedin_import_jobs')
    .update({
      status: 'pending' as ImportJobStatus,
      claimed_at: null,
      error_message: null,
      ...createUpdatedAtTimestamp(),
    })
    .eq('status', 'processing')
    .lt('claimed_at', staleCutoff)
    .select('id')

  if (resetError) {
    logError('[import-jobs] Stale job reset failed', {
      error: resetError.message,
      staleCutoff,
    })
    throw resetError
  }

  const resetCount = resetData?.length ?? 0

  if (deletedCount > 0 || resetCount > 0) {
    logInfo('[import-jobs] Cleanup completed', { deletedCount, resetCount, daysOld })
  }

  return deletedCount + resetCount
}
