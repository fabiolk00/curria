import { NextRequest, NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import { logError, logInfo } from '@/lib/observability/structured-log'
import { getExistingUserProfile, type UserProfileRow } from '@/lib/profile/user-profiles'
import { validateTrustedMutationRequest } from '@/lib/security/request-trust'
import type { CVState } from '@/types/cv'

function mapProfileResponse(data: UserProfileRow) {
  return {
    id: data.id,
    source: data.source,
    cvState: data.cv_state,
    linkedinUrl: data.linkedin_url,
    profilePhotoUrl: data.profile_photo_url,
    extractedAt: data.extracted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
}

function normalizeLinkedinUrl(cvState: CVState, currentValue?: string | null): string | null {
  if (currentValue) {
    return currentValue
  }

  const linkedinValue = cvState.linkedin?.trim()
  if (!linkedinValue || !linkedinValue.includes('linkedin.com/in/')) {
    return null
  }

  return linkedinValue
}

export async function GET() {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logError('[api/profile] Unauthorized GET attempt')
    return NextResponse.json(
      { error: 'Você precisa estar autenticado para acessar seu perfil.' },
      { status: 401 },
    )
  }

  try {
    const data = await getExistingUserProfile(appUser.id)

    if (!data) {
      logInfo('[api/profile] No profile found', {
        appUserId: appUser.id,
      })
      return NextResponse.json({
        profile: null,
      })
    }

    logInfo('[api/profile] Profile retrieved', {
      appUserId: appUser.id,
      source: data.source,
    })

    return NextResponse.json({
      profile: mapProfileResponse(data),
    })
  } catch (error) {
    logError('[api/profile] Unexpected error', {
      appUserId: appUser.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logError('[api/profile] Unauthorized PUT attempt')
    return NextResponse.json(
      { error: 'Você precisa estar autenticado para salvar seu perfil.' },
      { status: 401 },
    )
  }

  const trust = validateTrustedMutationRequest(request)
  if (!trust.ok) {
    logError('[api/profile] Rejected untrusted PUT request', {
      appUserId: appUser.id,
      requestPath: request.nextUrl.pathname,
      trustSignal: trust.signal,
      trustReason: trust.reason,
    })
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    logError('[api/profile] Invalid JSON in request', { appUserId: appUser.id })
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = CVStateSchema.safeParse(rawBody)
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }

  try {
    const existingProfile = await getExistingUserProfile(appUser.id)
    const supabase = getSupabaseAdminClient()
    const payload = {
      id: existingProfile?.id ?? createDatabaseId(),
      user_id: appUser.id,
      cv_state: body.data,
      source: existingProfile?.source ?? 'manual',
      linkedin_url: normalizeLinkedinUrl(body.data, existingProfile?.linkedin_url),
      profile_photo_url: existingProfile?.profile_photo_url ?? null,
      extracted_at: existingProfile?.extracted_at ?? new Date().toISOString(),
      ...createUpdatedAtTimestamp(),
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (error || !data) {
      logError('[api/profile] Failed to save profile', {
        appUserId: appUser.id,
        error: error?.message,
      })
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    logInfo('[api/profile] Profile saved', {
      appUserId: appUser.id,
      source: data.source,
    })

    return NextResponse.json({
      profile: mapProfileResponse(data as UserProfileRow),
    })
  } catch (error) {
    logError('[api/profile] Unexpected save error', {
      appUserId: appUser.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
