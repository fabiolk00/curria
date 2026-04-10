import { NextRequest } from 'next/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { E2E_AUTH_COOKIE_NAME, verifySignedE2EAuthCookie } from '@/lib/auth/e2e-auth'

import { DELETE, POST } from './route'

const originalEnabled = process.env.E2E_AUTH_ENABLED
const originalSecret = process.env.E2E_AUTH_BYPASS_SECRET

function buildRequest(
  method: 'POST' | 'DELETE',
  body?: Record<string, unknown>,
  origin = 'http://localhost:3000',
): NextRequest {
  return new NextRequest('http://localhost:3000/api/e2e/auth', {
    method,
    headers: {
      'content-type': 'application/json',
      origin,
      'x-e2e-auth-secret': 'test-e2e-secret',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('e2e auth route', () => {
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

  it('issues a signed auth cookie in E2E mode', async () => {
    const response = await POST(buildRequest('POST', {
      appUserId: 'usr_e2e_route',
      creditsRemaining: 7,
      displayName: 'Route Test User',
      email: 'route@example.com',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, appUserId: 'usr_e2e_route' })

    const cookie = response.cookies.get(E2E_AUTH_COOKIE_NAME)?.value
    expect(cookie).toBeTruthy()
    await expect(verifySignedE2EAuthCookie(cookie)).resolves.toMatchObject({
      appUserId: 'usr_e2e_route',
      creditsRemaining: 7,
      displayName: 'Route Test User',
      primaryEmail: 'route@example.com',
    })
  })

  it('rejects requests when E2E mode is disabled', async () => {
    process.env.E2E_AUTH_ENABLED = 'false'

    const response = await POST(buildRequest('POST'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'Not found' })
  })

  it('rejects invalid secrets', async () => {
    const response = await POST(new NextRequest('http://localhost:3000/api/e2e/auth', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
        'x-e2e-auth-secret': 'wrong-secret',
      },
      body: JSON.stringify({ appUserId: 'usr_blocked' }),
    }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })

  it('rejects cross-origin bootstrap attempts', async () => {
    const response = await POST(buildRequest('POST', undefined, 'https://evil.example.com'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden' })
  })

  it('clears the auth cookie on DELETE', async () => {
    const response = await DELETE(buildRequest('DELETE'))

    expect(response.status).toBe(204)
    expect(response.headers.get('set-cookie')).toContain(`${E2E_AUTH_COOKIE_NAME}=;`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
  })
})
