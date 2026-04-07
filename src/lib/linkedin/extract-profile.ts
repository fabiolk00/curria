import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'
import { createUpdatedAtTimestamp } from '@/lib/db/timestamps'
import { logError, logInfo } from '@/lib/observability/structured-log'
import type { CVState } from '@/types/cv'

import { fetchLinkedInProfile, mapLinkdAPIToCvState } from './linkdapi'

/**
 * Pure orchestration: fetch LinkedIn profile, map to cvState, persist to UserProfile.
 *
 * This function has no queue or worker dependencies.
 * It is called inline during a status poll when a pending job is claimed.
 */
export async function extractAndSaveProfile(
  linkedinUrl: string,
  appUserId: string,
): Promise<{ cvState: CVState }> {
  const profileData = await fetchLinkedInProfile(linkedinUrl)
  const cvState = mapLinkdAPIToCvState(profileData)

  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('user_profiles').upsert(
    {
      user_id: appUserId,
      cv_state: cvState,
      source: 'linkedin',
      linkedin_url: linkedinUrl,
      extracted_at: new Date().toISOString(),
      ...createUpdatedAtTimestamp(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    logError('[extract-profile] Database upsert failed', {
      appUserId,
      error: error.message,
    })
    throw new Error(`Failed to save profile: ${error.message}`)
  }

  logInfo('[extract-profile] Profile extracted and saved', {
    appUserId,
    linkedinUrl,
    hasFullName: Boolean(cvState.fullName),
    hasEmail: Boolean(cvState.email),
    experienceCount: cvState.experience.length,
    educationCount: cvState.education.length,
    skillsCount: cvState.skills.length,
  })

  return { cvState }
}
