import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getCurrentAppUser } from '@/lib/auth/app-user'
import { dispatchTool } from '@/lib/agent/tools'
import { getSession } from '@/lib/db/sessions'

import { POST } from './route'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  getSession: vi.fn(),
}))

vi.mock('@/lib/agent/tools', () => ({
  dispatchTool: vi.fn(),
}))

function buildAppUser(id: string) {
  return {
    id,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    authIdentity: {
      id: `identity_${id}`,
      userId: id,
      provider: 'clerk' as const,
      providerSubject: `clerk_${id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    creditAccount: {
      id: `cred_${id}`,
      userId: id,
      creditsRemaining: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }
}

function buildSession() {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    phase: 'dialog' as const,
    stateVersion: 1,
    cvState: {
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [],
      skills: ['TypeScript'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
    },
    generatedOutput: { status: 'idle' as const },
    creditsUsed: 1,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('generate route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches base generation', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      docxUrl: 'https://example.com/docx',
      pdfUrl: 'https://example.com/pdf',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'base' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(dispatchTool).toHaveBeenCalledWith('generate_file', {
      cv_state: expect.objectContaining({ summary: 'Backend engineer' }),
      target_id: undefined,
    }, expect.objectContaining({ id: 'sess_123' }))
  })

  it('dispatches target generation', async () => {
    vi.mocked(getCurrentAppUser).mockResolvedValue(buildAppUser('usr_123'))
    vi.mocked(getSession).mockResolvedValue(buildSession())
    vi.mocked(dispatchTool).mockResolvedValue(JSON.stringify({
      success: true,
      docxUrl: 'https://example.com/docx',
      pdfUrl: 'https://example.com/pdf',
    }))

    const response = await POST(
      new NextRequest('https://example.com/api/session/sess_123/generate', {
        method: 'POST',
        body: JSON.stringify({ scope: 'target', targetId: 'target_123' }),
      }),
      { params: { id: 'sess_123' } },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      success: true,
      scope: 'target',
      targetId: 'target_123',
    })
  })
})
