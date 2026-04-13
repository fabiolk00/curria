import { createDatabaseId } from '@/lib/db/ids'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import type { CVState } from '@/types/cv'

export type UserProfileRow = {
  id: string
  user_id: string
  cv_state: unknown
  source: string
  linkedin_url: string | null
  profile_photo_url: string | null
  extracted_at: string
  created_at: string
  updated_at: string
}

type SaveImportedProfileInput = {
  appUserId: string
  cvState: CVState
  source: 'linkedin' | 'pdf'
  linkedinUrl?: string | null
  profilePhotoUrl?: string | null
}

function normalizeLinkedinUrl(value?: string | null): string | null {
  const trimmed = value?.trim()

  if (!trimmed || !trimmed.includes('linkedin.com/in/')) {
    return null
  }

  return trimmed
}

export async function getExistingUserProfile(appUserId: string): Promise<UserProfileRow | null> {
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

export async function saveImportedUserProfile(input: SaveImportedProfileInput): Promise<UserProfileRow> {
  const existingProfile = await getExistingUserProfile(input.appUserId)
  const supabase = getSupabaseAdminClient()

  const payload = {
    id: existingProfile?.id ?? createDatabaseId(),
    user_id: input.appUserId,
    cv_state: input.cvState,
    source: input.source,
    linkedin_url: input.linkedinUrl !== undefined
      ? normalizeLinkedinUrl(input.linkedinUrl)
      : normalizeLinkedinUrl(input.cvState.linkedin) ?? existingProfile?.linkedin_url ?? null,
    profile_photo_url: input.profilePhotoUrl !== undefined
      ? input.profilePhotoUrl
      : existingProfile?.profile_photo_url ?? null,
    extracted_at: new Date().toISOString(),
    ...createUpdatedAtTimestamp(),
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) {
    throw new Error(`Failed to save profile: ${error.message}`)
  }

  const savedProfile = await getExistingUserProfile(input.appUserId)

  if (savedProfile) {
    return savedProfile
  }

  return {
    id: payload.id,
    user_id: payload.user_id,
    cv_state: payload.cv_state,
    source: payload.source,
    linkedin_url: payload.linkedin_url,
    profile_photo_url: payload.profile_photo_url,
    extracted_at: payload.extracted_at,
    created_at: existingProfile?.created_at ?? payload.extracted_at,
    updated_at: payload.updated_at,
  }
}
