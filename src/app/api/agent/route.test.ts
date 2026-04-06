import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { POST } from './route'
import { getCurrentAppUser } from '@/lib/auth/app-user'
import { getSession, createSessionWithCredit, checkUserQuota, incrementMessageCount } from '@/lib/db/sessions'
import { agentLimiter } from '@/lib/rate-limit'
import { dispatchTool } from '@/lib/agent/tools'

const { createCompletion } = vi.hoisted(() => ({
  createCompletion: vi.fn(),
}))

vi.mock('@/lib/openai/client', () => ({
  openai: {
    chat: {
      completions: {
        create: createCompletion,
      },
    },
  },
}))

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  agentLimiter: {
    limit: vi.fn(),
  },
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
  createSession: vi.fn(),
  createSessionWithCredit: vi.fn(),
  getMessages: vi.fn(),
  appendMessage: vi.fn(),
  checkUserQuota: vi.fn(),
  incrementMessageCount: vi.fn(),
  updateSession: vi.fn(),
}))

vi.mock('@/lib/agent/context-builder', () => ({
  buildSystemPrompt: vi.fn(),
  trimMessages: vi.fn((messages: unknown) => messages),
}))

vi.mock('@/lib/agent/tools', () => ({
  TOOL_DEFINITIONS: [],
  dispatchTool: vi.fn(),
}))

vi.mock('@/lib/agent/agent-loop', () => ({
  runAgentLoop: vi.fn(async function* () {
    yield { type: 'done', requestId: 'test', sessionId: 's1', phase: 'intake', atsScore: undefined, messageCount: 1, maxMessages: 15, isNewSession: true, toolIterations: 0 }
  }),
}))

vi.mock('@/lib/agent/usage-tracker', () => ({
  trackApiUsage: vi.fn(),
}))

vi.mock('@/lib/agent/url-extractor', () => ({
  extractUrl: vi.fn(() => null),
}))

vi.mock('@/lib/agent/scraper', () => ({
  scrapeJobPosting: vi.fn(),
}))

describe('agent route billing guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentAppUser).mockResolvedValue({
      id: 'usr_123',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      authIdentity: {
        id: 'identity_123',
        userId: 'usr_123',
        provider: 'clerk',
        providerSubject: 'clerk_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(agentLimiter.limit).mockResolvedValue({
      success: true,
      limit: 15,
      remaining: 14,
      reset: 0,
      pending: Promise.resolve(),
    })
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(false)
  })

  it('returns 402 when trying to create a new session with zero credits', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Help me improve my resume',
      }),
    }))

    expect(response.status).toBe(402)
    expect(await response.json()).toEqual({
      error: 'Seus créditos acabaram. Faça upgrade do seu plano para continuar.',
      upgradeUrl: '/pricing',
    })
  })

  it('returns 400 when body is not valid JSON', async () => {
    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: 'not valid json',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid JSON body.' })
  })

  it('returns 404 when a stale sessionId is provided instead of consuming a credit', async () => {
    vi.mocked(getSession).mockResolvedValue(null)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'stale_session_id',
        message: 'Continue our conversation',
      }),
    }))

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body.error).toBe('Sessão não encontrada. Inicie uma nova análise.')
    expect(body.action).toBe('new_session')
    expect(checkUserQuota).not.toHaveBeenCalled()
    expect(createSessionWithCredit).not.toHaveBeenCalled()
  })

  it('returns 429 with action metadata when session hits message cap', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_full',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 15,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'sess_full',
        message: 'One more message',
      }),
    }))

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.action).toBe('new_session')
    expect(body.messageCount).toBe(15)
    expect(body.maxMessages).toBe(15)
    expect(incrementMessageCount).not.toHaveBeenCalled()
  })

  it('does not consume an existing-session message when file preprocessing fails', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_existing_file_fail',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(dispatchTool).mockRejectedValue(new Error('Storage unavailable'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'sess_existing_file_fail',
        message: 'Continue',
        file: 'base64data',
        fileMime: 'application/pdf',
      }),
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'Algo deu errado. Por favor, tente novamente.',
    })
    expect(incrementMessageCount).not.toHaveBeenCalled()
  })

  it('streams SSE done event for a valid new session', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_new',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Start my resume analysis',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    const doneEvent = events.find((e) => e.includes('"done":true'))
    expect(doneEvent).toBeDefined()

    const doneData = JSON.parse(doneEvent!.replace('data: ', ''))
    expect(doneData.done).toBe(true)
    expect(doneData.sessionId).toBe('s1')
    expect(doneData.phase).toBe('intake')
    expect(doneData.isNewSession).toBe(true)
  })

  it('emits sessionCreated as the very first SSE event for new sessions', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_early',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    expect(events.length).toBeGreaterThanOrEqual(2)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ sessionCreated: true, sessionId: 'sess_early' })
  })

  it('returns X-Session-Id header for new sessions', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_header',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.headers.get('X-Session-Id')).toBe('sess_header')
  })

  it('does not emit sessionCreated for existing sessions', async () => {
    vi.mocked(getSession).mockResolvedValue({
      id: 'sess_existing',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'dialog',
      cvState: {
        fullName: 'Test',
        email: 'test@test.com',
        phone: '123',
        summary: 'test',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'parsed',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 2,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'sess_existing',
        message: 'Continue',
      }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBeNull()

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)
    const hasSessionCreated = events.some((e) => e.includes('"sessionCreated"'))
    expect(hasSessionCreated).toBe(false)
  })

  it('aborts new-session stream with error when incrementMessageCount fails', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_inc_fail',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: {
        fullName: '',
        email: '',
        phone: '',
        summary: '',
        experience: [],
        skills: [],
        education: [],
      },
      agentState: {
        parseStatus: 'empty',
        rewriteHistory: {},
      },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(false)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)
    expect(response.headers.get('X-Session-Id')).toBe('sess_inc_fail')

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    // sessionCreated is still the first event (frontend already has the ID)
    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ sessionCreated: true, sessionId: 'sess_inc_fail' })

    // Second event is the error, stream closes without a done event
    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.error).toBe('Erro interno ao registrar mensagem. Tente novamente.')

    const hasDone = events.some((e) => e.includes('"done":true'))
    expect(hasDone).toBe(false)
  })

  it('sends SSE error and closes stream when incrementMessageCount throws', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_throw_inc',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockRejectedValue(new Error('DB connection lost'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    expect(response.status).toBe(200)
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ sessionCreated: true, sessionId: 'sess_throw_inc' })

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.error).toBe('Algo deu errado. Por favor, tente novamente.')

    expect(events.some((e) => e.includes('"done":true'))).toBe(false)
  })

  it('sends SSE error and closes stream when handleFileAttachment throws', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_throw_file',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(incrementMessageCount).mockResolvedValue(true)
    vi.mocked(dispatchTool).mockRejectedValue(new Error('Storage unavailable'))

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello', file: 'base64data', fileMime: 'application/pdf' }),
    }))

    expect(response.status).toBe(200)
    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const firstData = JSON.parse(events[0].replace('data: ', ''))
    expect(firstData).toEqual({ sessionCreated: true, sessionId: 'sess_throw_file' })

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.error).toBe('Algo deu errado. Por favor, tente novamente.')

    expect(incrementMessageCount).not.toHaveBeenCalled()
    expect(events.some((e) => e.includes('"done":true'))).toBe(false)
  })

  it('sends AbortError-specific message when pre-loop work is aborted', async () => {
    vi.mocked(getSession).mockResolvedValue(null)
    vi.mocked(checkUserQuota).mockResolvedValue(true)
    vi.mocked(createSessionWithCredit).mockResolvedValue({
      id: 'sess_abort',
      userId: 'usr_123',
      stateVersion: 1,
      phase: 'intake',
      cvState: { fullName: '', email: '', phone: '', summary: '', experience: [], skills: [], education: [] },
      agentState: { parseStatus: 'empty', rewriteHistory: {} },
      generatedOutput: { status: 'idle' },
      creditsUsed: 1,
      messageCount: 0,
      creditConsumed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    vi.mocked(incrementMessageCount).mockRejectedValue(abortError)

    const response = await POST(new NextRequest('http://localhost/api/agent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello' }),
    }))

    const text = await response.text()
    const events = text.split('\n\n').filter(Boolean)

    const secondData = JSON.parse(events[1].replace('data: ', ''))
    expect(secondData.error).toBe('A requisição demorou muito. Por favor, tente novamente.')
  })
})
