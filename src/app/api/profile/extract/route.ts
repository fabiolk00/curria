import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { createImportJob } from '@/lib/linkedin/import-jobs'
import { logError, logInfo } from '@/lib/observability/structured-log'

const BodySchema = z.object({
  linkedinUrl: z.string().url('Invalid URL format'),
})

export async function POST(req: NextRequest) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logError('[api/profile/extract] Unauthorized access attempt')
    return NextResponse.json(
      { error: 'Você precisa estar autenticado para importar um perfil do LinkedIn.' },
      { status: 401 },
    )
  }

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    logError('[api/profile/extract] Invalid JSON in request', { appUserId: appUser.id })
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = BodySchema.safeParse(rawBody)
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.flatten() },
      { status: 400 },
    )
  }

  const { linkedinUrl } = body.data

  if (!linkedinUrl.includes('linkedin.com/in/')) {
    return NextResponse.json(
      { error: 'Invalid LinkedIn profile URL. Must be in format: https://www.linkedin.com/in/username/' },
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
    logError('[api/profile/extract] Failed to create job', {
      appUserId: appUser.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Failed to start profile extraction' },
      { status: 500 },
    )
  }
}
