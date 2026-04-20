import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import {
  LinkedInImportLimitError,
} from '@/lib/linkedin/import-limits'
import { createImportJob } from '@/lib/linkedin/import-jobs'
import {
  logError,
  logInfo,
  logWarn,
  serializeError,
} from '@/lib/observability/structured-log'

const BodySchema = z.object({
  linkedinUrl: z.string().url('Informe um link válido do LinkedIn.'),
})

const AUTH_REQUIRED_MESSAGE = 'Você precisa estar autenticado para importar um perfil do LinkedIn.'
const INVALID_REQUEST_MESSAGE = 'Não foi possível ler sua solicitação. Revise o link do LinkedIn e tente novamente.'
const INVALID_LINKEDIN_URL_MESSAGE = 'Informe um link público de perfil do LinkedIn no formato https://www.linkedin.com/in/seu-perfil/.'
const START_IMPORT_FAILURE_MESSAGE = 'Não foi possível iniciar a importação do LinkedIn agora. Tente novamente em instantes.'

export async function POST(req: NextRequest) {
  const appUser = await getCurrentAppUser(req)
  if (!appUser) {
    logError('[api/profile/extract] Unauthorized access attempt')
    return NextResponse.json(
      { error: AUTH_REQUIRED_MESSAGE },
      { status: 401 },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    logError('[api/profile/extract] Invalid JSON in request', { appUserId: appUser.id })
    return NextResponse.json({ error: INVALID_REQUEST_MESSAGE }, { status: 400 })
  }

  const body = BodySchema.safeParse(rawBody)
  if (!body.success) {
    const firstIssue = body.error.issues[0]?.message
    const errorMessage = firstIssue === 'Required'
      ? INVALID_LINKEDIN_URL_MESSAGE
      : (firstIssue ?? INVALID_LINKEDIN_URL_MESSAGE)

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 },
    )
  }

  const { linkedinUrl } = body.data

  if (!linkedinUrl.includes('linkedin.com/in/')) {
    return NextResponse.json(
      { error: INVALID_LINKEDIN_URL_MESSAGE },
      { status: 400 },
    )
  }

  try {
    const { jobId } = await createImportJob(appUser.id, linkedinUrl)

    logInfo('[api/profile/extract] Job created', {
      jobId,
      appUserId: appUser.id,
    })

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Profile extraction started',
    })
  } catch (error) {
    if (error instanceof LinkedInImportLimitError) {
      logWarn('[api/profile/extract] LinkedIn import limit reached', {
        appUserId: appUser.id,
        linkedinUrl,
        errorCode: error.code,
        retryAfterSeconds: error.retryAfterSeconds ?? null,
      })

      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        {
          status: error.status,
          headers: error.retryAfterSeconds
            ? { 'Retry-After': String(error.retryAfterSeconds) }
            : undefined,
        },
      )
    }

    logError('[api/profile/extract] Failed to create job', {
      appUserId: appUser.id,
      linkedinUrl,
      ...serializeError(error),
    })

    return NextResponse.json(
      { error: START_IMPORT_FAILURE_MESSAGE },
      { status: 500 },
    )
  }
}
