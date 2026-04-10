import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getMessages, getSession } from '@/lib/db/sessions'
import { logError, logWarn } from '@/lib/observability/structured-log'

import { GET } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  getMessages: vi.fn(),
}))

vi.mock('@/lib/observability/structured-log', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  serializeError: (error: unknown) => ({
    errorMessage: error instanceof Error ? error.message : String(error),
  }),
}))

describe('GET /api/session/[id]/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs not-found access with session context', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/messages'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(404)
    expect(logWarn).toHaveBeenCalledWith('api.session.messages_not_found', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session/sess_123/messages',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      success: false,
    }))
  })

  it('logs structured failures when message retrieval throws', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
    } as Awaited<ReturnType<typeof getCurrentAppUser>>)
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_123',
      userId: 'usr_123',
    } as Awaited<ReturnType<typeof getSession>>)
    vi.mocked(getMessages).mockRejectedValue(new Error('messages down'))

    const response = await GET(
      new NextRequest('https://example.com/api/session/sess_123/messages'),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(500)
    expect(logError).toHaveBeenCalledWith('api.session.messages_failed', expect.objectContaining({
      requestMethod: 'GET',
      requestPath: '/api/session/sess_123/messages',
      sessionId: 'sess_123',
      appUserId: 'usr_123',
      success: false,
      errorMessage: 'messages down',
    }))
  })
})
