import { logError, logInfo } from '@/lib/observability/structured-log'
import { saveImportedUserProfile } from '@/lib/profile/user-profiles'
import type { CVState } from '@/types/cv'

import {
  extractLinkedInProfilePhotoUrl,
  fetchLinkedInProfile,
  mapLinkdAPIToCvState,
} from './linkdapi'

/**
 * Pure orchestration: fetch LinkedIn profile, map to cvState, persist to UserProfile.
 *
 * This function has no queue or worker dependencies.
 * It is called inline during a status poll when a pending job is claimed.
 */
export async function extractAndSaveProfile(
  linkedinUrl: string,
  appUserId: string,
): Promise<{ cvState: CVState; profilePhotoUrl?: string }> {
  const profileData = await fetchLinkedInProfile(linkedinUrl)
  const cvState = mapLinkdAPIToCvState(profileData)
  const profilePhotoUrl = extractLinkedInProfilePhotoUrl(profileData)

  try {
    await saveImportedUserProfile({
      appUserId,
      cvState,
      source: 'linkedin',
      linkedinUrl,
      profilePhotoUrl: profilePhotoUrl ?? null,
    })
  } catch (error) {
    logError('[extract-profile] Database upsert failed', {
      appUserId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
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

  return { cvState, profilePhotoUrl }
}
