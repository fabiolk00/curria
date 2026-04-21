import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logInfo, logWarn, logError } from '@/lib/observability/structured-log'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { cleanupOldImportJobs } from '@/lib/linkedin/import-jobs'
import { cleanupOldPdfImportJobs } from '@/lib/profile/pdf-import-jobs'

const PROCESSED_EVENTS_RETENTION_DAYS = 30

function isMissingCleanupRpcError(message: string | undefined): boolean {
  if (!message) {
    return false
  }

  const normalizedMessage = message.toLowerCase()
  return normalizedMessage.includes('cleanup_old_processed_events')
    && (
      normalizedMessage.includes('could not find the function')
      || normalizedMessage.includes('schema cache')
      || normalizedMessage.includes('does not exist')
    )
}

/**
 * Cleanup old processed webhook events (>30 days).
 * Called by Vercel Crons daily at 2 AM UTC.
 *
 * Uses cleanup_old_processed_events() RPC for:
 * - Timezone-safe date arithmetic (PostgreSQL NOW() not Node.js Date)
 * - Parameterizable retention window
 * - Consistent with CurrIA's RPC-based mutation pattern
 * - Better observability and error handling
 *
 * @see prisma/migrations/20260331_priority_2_operational_improvements.sql
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { processedEvents: number; linkedInJobs: number; pdfImportJobs: number } = {
    processedEvents: 0,
    linkedInJobs: 0,
    pdfImportJobs: 0,
  }
  const supabase = getSupabaseAdminClient()

  // Cleanup processed webhook events (>30 days)
  const { data, error } = await supabase.rpc(
    'cleanup_old_processed_events',
    { p_days_old: PROCESSED_EVENTS_RETENTION_DAYS }
  )

  if (error) {
    if (isMissingCleanupRpcError(error.message)) {
      const cutoff = new Date(Date.now() - PROCESSED_EVENTS_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { count, error: fallbackError } = await supabase
        .from('processed_events')
        .delete({ count: 'exact' })
        .lt('created_at', cutoff)

      if (fallbackError) {
        logError('cron.cleanup.webhook_events_failed', {
          error: fallbackError.message,
          daysOld: PROCESSED_EVENTS_RETENTION_DAYS,
          fallbackUsed: true,
          fallbackCutoff: cutoff,
        })
        return NextResponse.json({ error: fallbackError.message }, { status: 500 })
      }

      logWarn('cron.cleanup.webhook_events_rpc_missing_fallback_used', {
        error: error.message,
        daysOld: PROCESSED_EVENTS_RETENTION_DAYS,
        fallbackCutoff: cutoff,
        deletedCount: count ?? 0,
      })

      results.processedEvents = count ?? 0
    } else {
      logError('cron.cleanup.webhook_events_failed', {
        error: error.message,
        daysOld: PROCESSED_EVENTS_RETENTION_DAYS,
      })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } else {
    results.processedEvents = data?.[0]?.deleted_count ?? 0
  }

  // Cleanup old LinkedIn extraction jobs (>1 day)
  try {
    results.linkedInJobs = await cleanupOldImportJobs(1)
  } catch (error) {
    logError('cron.cleanup.linkedin_jobs_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Don't fail the entire cron if LinkedIn cleanup fails
    // Log it but continue
  }

  try {
    results.pdfImportJobs = await cleanupOldPdfImportJobs(1)
  } catch (error) {
    logError('cron.cleanup.pdf_import_jobs_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
  }

  const totalDeleted = results.processedEvents + results.linkedInJobs + results.pdfImportJobs

  if (totalDeleted > 0) {
    logInfo('cron.cleanup.completed', {
      ...results,
      totalDeleted,
    })
  } else {
    logWarn('cron.cleanup.no_deletes', {
      message: 'No old records found for cleanup',
    })
  }

  return NextResponse.json(results)
}
