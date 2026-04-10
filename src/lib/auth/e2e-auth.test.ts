import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  assertE2EAuthConfigured,
  createSignedE2EAuthCookie,
  resolveE2EAppUser,
  verifySignedE2EAuthCookie,
} from '@/lib/auth/e2e-auth'

const originalEnabled = process.env.E2E_AUTH_ENABLED
const originalSecret = process.env.E2E_AUTH_BYPASS_SECRET

describe('e2e auth helpers', () => {
  beforeEach(() => {
    process.env.E2E_AUTH_ENABLED = 'true'
    process.env.E2E_AUTH_BYPASS_SECRET = 'test-e2e-secret'
  })

  afterAll(() => {
    if (originalEnabled === undefined) {
      delete process.env.E2E_AUTH_ENABLED
    } else {
      process.env.E2E_AUTH_ENABLED = originalEnabled
    }

    if (originalSecret === undefined) {
      delete process.env.E2E_AUTH_BYPASS_SECRET
    } else {
      process.env.E2E_AUTH_BYPASS_SECRET = originalSecret
    }
  })

  it('creates and resolves a signed synthetic app user', async () => {
    const cookie = await createSignedE2EAuthCookie({
      appUserId: 'usr_e2e_123',
      creditsRemaining: 9,
      displayName: 'Ana Teste',
      primaryEmail: 'ana@example.com',
    })

    await expect(verifySignedE2EAuthCookie(cookie)).resolves.toMatchObject({
      appUserId: 'usr_e2e_123',
      creditsRemaining: 9,
      displayName: 'Ana Teste',
      primaryEmail: 'ana@example.com',
    })

    await expect(resolveE2EAppUser(cookie)).resolves.toMatchObject({
      id: 'usr_e2e_123',
      displayName: 'Ana Teste',
      primaryEmail: 'ana@example.com',
      creditAccount: {
        creditsRemaining: 9,
      },
    })
  })

  it('rejects tampered cookies', async () => {
    const cookie = await createSignedE2EAuthCookie({
      appUserId: 'usr_e2e_123',
    })
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('a') ? 'b' : 'a')

    await expect(verifySignedE2EAuthCookie(tampered)).resolves.toBeNull()
    await expect(resolveE2EAppUser(tampered)).resolves.toBeNull()
  })

  it('ignores cookies when E2E auth is disabled', async () => {
    const cookie = await createSignedE2EAuthCookie({
      appUserId: 'usr_e2e_disabled',
    })
    process.env.E2E_AUTH_ENABLED = 'false'

    await expect(verifySignedE2EAuthCookie(cookie)).resolves.toBeNull()
    await expect(resolveE2EAppUser(cookie)).resolves.toBeNull()
  })

  it('fails fast when enabled without a secret', () => {
    delete process.env.E2E_AUTH_BYPASS_SECRET

    expect(() => assertE2EAuthConfigured()).toThrow(
      'Missing required environment variable E2E_AUTH_BYPASS_SECRET when E2E auth is enabled.',
    )
  })
})
