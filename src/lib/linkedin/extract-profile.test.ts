import { beforeEach, describe, expect, it, vi } from 'vitest'

import { extractAndSaveProfile } from './extract-profile'

const { mockSaveImportedUserProfile, mockLogError } = vi.hoisted(() => ({
  mockSaveImportedUserProfile: vi.fn(),
  mockLogError: vi.fn(),
}))

vi.mock('@/lib/profile/user-profiles', () => ({
  saveImportedUserProfile: mockSaveImportedUserProfile,
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: mockLogError,
  logInfo: vi.fn(),
}))

vi.mock('./linkdapi', () => ({
  fetchLinkedInProfile: vi.fn(async () => ({ raw: true })),
  extractLinkedInProfilePhotoUrl: vi.fn(() => 'https://cdn.example.com/profile-photo.jpg'),
  mapLinkdAPIToCvState: vi.fn(() => ({
    fullName: 'Fabio Test',
    email: 'fabio@example.com',
    phone: '11999999999',
    linkedin: 'https://www.linkedin.com/in/fabio-test/',
    location: 'Sao Paulo',
    summary: 'Backend engineer',
    skills: ['TypeScript', 'Node.js'],
    experience: [],
    education: [],
    certifications: [],
  })),
}))

describe('extractAndSaveProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveImportedUserProfile.mockResolvedValue(undefined)
  })

  it('persists the mapped linkedin profile through saveImportedUserProfile', async () => {
    const result = await extractAndSaveProfile(
      'https://www.linkedin.com/in/fabio-test/',
      'usr_test_123',
    )

    expect(result.cvState.fullName).toBe('Fabio Test')
    expect(result.profilePhotoUrl).toBe('https://cdn.example.com/profile-photo.jpg')
    expect(mockSaveImportedUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        appUserId: 'usr_test_123',
        cvState: expect.objectContaining({
          fullName: 'Fabio Test',
        }),
        source: 'linkedin',
        linkedinUrl: 'https://www.linkedin.com/in/fabio-test/',
        profilePhotoUrl: 'https://cdn.example.com/profile-photo.jpg',
      }),
    )
  })

  it('propagates persistence failures from saveImportedUserProfile', async () => {
    mockSaveImportedUserProfile.mockRejectedValueOnce(
      new Error("Failed to save profile: Could not find the 'cv_state' column of 'user_profiles' in the schema cache"),
    )

    await expect(
      extractAndSaveProfile('https://www.linkedin.com/in/fabio-test/', 'usr_test_123'),
    ).rejects.toThrow(
      "Failed to save profile: Could not find the 'cv_state' column of 'user_profiles' in the schema cache",
    )

    expect(mockLogError).toHaveBeenCalledWith(
      '[extract-profile] Database upsert failed',
      expect.objectContaining({
        appUserId: 'usr_test_123',
        error: "Failed to save profile: Could not find the 'cv_state' column of 'user_profiles' in the schema cache",
      }),
    )
  })
})
