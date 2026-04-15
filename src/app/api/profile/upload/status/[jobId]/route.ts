import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  getPdfImportJob,
  startPdfImportJobProcessing,
} from '@/lib/profile/pdf-import-jobs'
import { logError, logInfo, logWarn, serializeError } from '@/lib/observability/structured-log'

const TRACK_IMPORT_FAILURE_MESSAGE =
  'Nao foi possivel acompanhar a importacao do curriculo agora. Tente novamente em instantes.'

export async function GET(
  _req: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const requestStartedAt = Date.now()
  const requestPath = _req.nextUrl.pathname
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logWarn('api.profile.upload_status.unauthorized', {
      requestMethod: _req.method,
      requestPath,
      requestedJobId: params.jobId,
      success: false,
      latencyMs: Date.now() - requestStartedAt,
    })
    return NextResponse.json(
      { error: 'Voce precisa estar autenticado para acompanhar a importacao.' },
      { status: 401 },
    )
  }

  try {
    let job = await getPdfImportJob(params.jobId, appUser.id)

    if (!job) {
      logWarn('api.profile.upload_status.not_found', {
        requestMethod: _req.method,
        requestPath,
        jobId: params.jobId,
        appUserId: appUser.id,
        success: false,
        latencyMs: Date.now() - requestStartedAt,
      })
      return NextResponse.json({ error: 'Importacao nao encontrada.' }, { status: 404 })
    }

    if (job.status === 'pending' || job.status === 'processing') {
      job = await startPdfImportJobProcessing(params.jobId, appUser.id)
    }

    logInfo('api.profile.upload_status.completed', {
      requestMethod: _req.method,
      requestPath,
      jobId: job.id,
      appUserId: appUser.id,
      status: job.status,
      success: true,
      latencyMs: Date.now() - requestStartedAt,
    })

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      errorMessage: job.status === 'failed' ? job.error_message ?? undefined : undefined,
      warningMessage: job.status === 'completed' ? job.warning_message ?? undefined : undefined,
    })
  } catch (error) {
    logError('[api/profile/upload/status] Failed to get PDF import status', {
      appUserId: appUser.id,
      jobId: params.jobId,
      requestMethod: _req.method,
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
