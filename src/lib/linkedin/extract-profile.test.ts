import { beforeEach, describe, expect, it, vi } from 'vitest'

import { extractAndSaveProfile } from './extract-profile'

const mockUpsert = vi.fn()
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({
  single: mockSingle,
}))
const mockSelect = vi.fn(() => ({
  eq: mockEq,
}))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}))

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

vi.mock('@/lib/db/ids', () => ({
  createDatabaseId: vi.fn(() => 'profile_test_123'),
}))

vi.mock('@/lib/db/timestamps', () => ({
  createUpdatedAtTimestamp: vi.fn(() => ({
    updated_at: '2026-04-07T23:40:00.000Z',
  })),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
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
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'not found' } })
  })

  it('upserts the profile with an explicit generated id', async () => {
    mockUpsert.mockResolvedValueOnce({ error: null })

    const result = await extractAndSaveProfile(
      'https://www.linkedin.com/in/fabio-test/',
      'usr_test_123',
    )

    expect(result.cvState.fullName).toBe('Fabio Test')
    expect(result.profilePhotoUrl).toBe('https://cdn.example.com/profile-photo.jpg')
    expect(mockFrom).toHaveBeenCalledWith('user_profiles')
    expect(mockSelect).toHaveBeenCalledWith('*')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'usr_test_123')
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'profile_test_123',
        user_id: 'usr_test_123',
        cv_state: expect.objectContaining({
          fullName: 'Fabio Test',
        }),
        source: 'linkedin',
        linkedin_url: 'https://www.linkedin.com/in/fabio-test/',
        profile_photo_url: 'https://cdn.example.com/profile-photo.jpg',
        updated_at: '2026-04-07T23:40:00.000Z',
      }),
      { onConflict: 'user_id' },
    )
  })

  it('reuses the existing row id when the profile already exists', async () => {
    mockSingle.mockResolvedValueOnce({ data: { id: 'profile_existing_456' }, error: null })
    mockUpsert.mockResolvedValueOnce({ error: null })

    await extractAndSaveProfile(
      'https://www.linkedin.com/in/fabio-test/',
      'usr_test_123',
    )

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'profile_existing_456',
      }),
      { onConflict: 'user_id' },
    )
  })

  it('throws a wrapped error when the user_profiles upsert fails', async () => {
    mockUpsert.mockResolvedValueOnce({
      error: {
        message: "Could not find the 'cv_state' column of 'user_profiles' in the schema cache",
      },
    })

    await expect(
      extractAndSaveProfile('https://www.linkedin.com/in/fabio-test/', 'usr_test_123'),
    ).rejects.toThrow(
      "Failed to save profile: Could not find the 'cv_state' column of 'user_profiles' in the schema cache",
    )
  })
})
