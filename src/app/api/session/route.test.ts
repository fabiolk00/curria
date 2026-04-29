import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { db } from '@/lib/db/sessions'
import { logError, logWarn } from '@/lib/observability/structured-log'

import { GET, POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  db: {
    getUserSessions: vi.fn(),
  },
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

describe('GET /api/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs unauthorized access attempts', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(null)

    const response = await GET(new NextRequest('https://example.com/api/session'))

    expect(response.status).toBe(401)
    expect(logWarn).toHaveBeenCalledWith('api.session.list_unauthorized', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session',
      success: false,
    }))
  })

  it('logs structured failures when session listing throws', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(db.getUserSessions).mockRejectedValue(new Error('db down'))

    const response = await GET(new NextRequest('https://example.com/api/session'))

    expect(response.status).toBe(500)
    expect(logError).toHaveBeenCalledWith('api.session.list_failed', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session',
      appUserId: 'usr_123',
      success: false,
      errorMessage: 'db down',
    }))
  })

  it('returns owned sessions without AI chat entitlement', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(db.getUserSessions).mockResolvedValue([{ id: 'sess_123' }] as never)

    const response = await GET(new NextRequest('https://example.com/api/session'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      sessions: [{ id: 'sess_123' }],
    })
    expect(db.getUserSessions).toHaveBeenCalledWith('usr_123')
  })
})

describe('POST /api/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs the blocked direct-create path', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)

    const response = await POST(new NextRequest('https://example.com/api/session', { method: 'POST' }))

    expect(response.status).toBe(403)
    expect(logWarn).toHaveBeenCalledWith('api.session.create_blocked', expect.objectContaining({
      requestMethod: 'POST',
      requestPath: '/api/session',
      appUserId: 'usr_123',
      success: false,
    }))
  })
})
