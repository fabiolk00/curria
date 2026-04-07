import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logInfo, logWarn, logError } from '@/lib/observability/structured-log'
import { cleanupOldLinkedInJobs } from '@/lib/linkedin/queue'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

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

  let results: { processedEvents: number; linkedInJobs: number } = {
    processedEvents: 0,
    linkedInJobs: 0,
  }

  // Cleanup processed webhook events (>30 days)
  const { data, error } = await supabase.rpc(
    'cleanup_old_processed_events',
    { p_days_old: 30 }
  )

  if (error) {
    logError('cron.cleanup.webhook_events_failed', {
      error: error.message,
      daysOld: 30,
    })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  results.processedEvents = data?.[0]?.deleted_count ?? 0

  // Cleanup old LinkedIn extraction jobs (>1 day)
  try {
    results.linkedInJobs = await cleanupOldLinkedInJobs(1)
  } catch (error) {
    logError('cron.cleanup.linkedin_jobs_failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    // Don't fail the entire cron if LinkedIn cleanup fails
    // Log it but continue
  }

  const totalDeleted = results.processedEvents + results.linkedInJobs

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
