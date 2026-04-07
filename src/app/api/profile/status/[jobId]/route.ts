import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { claimAndProcessJob, getImportJob } from '@/lib/linkedin/import-jobs'
import { logError, logInfo } from '@/lib/observability/structured-log'

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { jobId } = params

  try {
    const job = await getImportJob(jobId, appUser.id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If still pending, atomically claim and process it now.
    // This is the on-demand extraction pattern for serverless.
    if (job.status === 'pending') {
      const result = await claimAndProcessJob(jobId, appUser.id)

      logInfo('[api/profile/status] Job processed on-demand', {
        jobId,
        status: result.status,
        appUserId: appUser.id,
      })

      return NextResponse.json({
        jobId,
        status: result.status,
      })
    }

    return NextResponse.json({
      jobId,
      status: job.status,
    })
  } catch (error) {
    logError('[api/profile/status] Failed to get job status', {
      jobId,
      appUserId: appUser.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 },
    )
  }
}
