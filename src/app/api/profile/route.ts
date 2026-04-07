import { NextResponse } from 'next/server'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { CVStateSchema } from '@/lib/cv/schema'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { logError, logInfo } from '@/lib/observability/structured-log'
import type { CVState } from '@/types/cv'

type UserProfileRow = {
  id: string
  user_id: string
  cv_state: unknown
  source: string
  linkedin_url: string | null
  extracted_at: string
  created_at: string
  updated_at: string
}

function mapProfileResponse(data: UserProfileRow) {
  return {
    id: data.id,
    source: data.source,
    cvState: data.cv_state,
    linkedinUrl: data.linkedin_url,
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

async function getExistingProfile(appUserId: string): Promise<UserProfileRow | null> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', appUserId)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return (data as UserProfileRow | null) ?? null
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
    const data = await getExistingProfile(appUser.id)

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

export async function PUT(request: Request) {
  const appUser = await getCurrentAppUser()
  if (!appUser) {
    logError('[api/profile] Unauthorized PUT attempt')
    return NextResponse.json(
      { error: 'Você precisa estar autenticado para salvar seu perfil.' },
      { status: 401 },
    )
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
    const existingProfile = await getExistingProfile(appUser.id)
    const supabase = getSupabaseAdminClient()
    const payload = {
      user_id: appUser.id,
      cv_state: body.data,
      source: existingProfile?.source ?? 'manual',
      linkedin_url: normalizeLinkedinUrl(body.data, existingProfile?.linkedin_url),
      extracted_at: existingProfile?.extracted_at ?? new Date().toISOString(),
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
