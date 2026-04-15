import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { claimAndProcessJob, getImportJob } from '@/lib/linkedin/import-jobs'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

const TRACK_IMPORT_FAILURE_MESSAGE =
  'Nao foi possivel acompanhar a importacao do LinkedIn agora. Tente novamente em instantes.'

function getSafeImportFailureMessage(errorMessage: string | null): string {
  const normalized = errorMessage?.toLowerCase() ?? ''

  if (
    normalized.includes('not found')
    || normalized.includes('404')
    || normalized.includes('perfil')
  ) {
    return 'Nao conseguimos acessar esse perfil agora. Confira se o link do LinkedIn esta publico e tente novamente.'
  }

  return 'Nao foi possivel importar esse perfil do LinkedIn agora. Confira se o link esta publico e tente novamente em instantes.'
}

export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const requestStartedAt = Date.now()
  const requestPath = req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.profile.status.unauthorized', {
      requestMethod: req.method,
      requestPath,
      requestedJobId: params.jobId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json({ error: 'Voce precisa estar autenticado para acompanhar a importacao.' }, { status: 401 })
  }

  const { jobId } = params

  try {
    const job = await getImportJob(jobId, appUser.id)

    if (!job) {
      logWarn('api.profile.status.not_found', {
        requestMethod: req.method,
        requestPath,
        jobId,
        appUserId: appUser.id,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({ error: 'Importacao nao encontrada.' }, { status: 404 })
    }

    // If still pending, atomically claim and process it now.
    // This is the on-demand extraction pattern for serverless.
    if (job.status === 'pending') {
      const result = await claimAndProcessJob(jobId, appUser.id)

      logInfo('[api/profile/status] Job processed on-demand', {
        jobId,
        status: result.status,
        appUserId: appUser.id,
        requestMethod: req.method,
        requestPath,
        latencyMs: Date.now() - requestStartedAt,
      })

      return NextResponse.json({
        jobId,
        status: result.status,
        errorMessage: result.status === 'failed' ? getSafeImportFailureMessage(result.error_message) : undefined,
      })
    }

    logInfo('api.profile.status.completed', {
      requestMethod: req.method,
      requestPath,
      jobId,
      appUserId: appUser.id,
      status: job.status,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({
      jobId,
      status: job.status,
      errorMessage: job.status === 'failed' ? getSafeImportFailureMessage(job.error_message) : undefined,
    })
  } catch (error) {
    logError('[api/profile/status] Failed to get job status', {
      jobId,
      appUserId: appUser.id,
      requestMethod: req.method,
      requestPath,
      latencyMs: Date.now() - requestStartedAt,
      ...serializeError(error),
    })

    return NextResponse.json(
      { error: TRACK_IMPORT_FAILURE_MESSAGE },
      { status: 500 },
    )
  }
}
