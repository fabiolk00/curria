import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Session, ToolPatch } from '@/types/agent'

import {
  applyToolPatch,
  applyToolPatchWithVersion,
  appendMessage,
  createSession,
  CURRENT_SESSION_STATE_VERSION,
  getSession,
  mergeToolPatch,
  normalizeStateVersion,
} from './sessions'
import { getSupabaseAdminClient } from '@/lib/db/supabase-admin'

vi.mock('@/lib/db/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}))

const updateEq = vi.fn()
const update = vi.fn(() => ({
  eq: updateEq,
}))
const single = vi.fn()
const limit = vi.fn()
const order = vi.fn(() => ({
  limit,
}))
const selectEqUser = vi.fn(() => ({
  single,
}))
const selectEqId = vi.fn(() => ({
  eq: selectEqUser,
  single,
}))
const select = vi.fn(() => ({
  eq: selectEqId,
  order,
}))
const insertSingle = vi.fn()
const insertSelect = vi.fn(() => ({
  single: insertSingle,
}))
const insert = vi.fn(() => ({
  select: insertSelect,
}))
const rpc = vi.fn()

const messageInsert = vi.fn()

const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'sessions') {
      return {
        select,
        insert,
        update,
      }
    }

    if (table === 'messages') {
      return {
        insert: messageInsert,
      }
    }

    if (table === 'user_profiles') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  }),
  rpc,
}

function buildSession(): Session {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: CURRENT_SESSION_STATE_VERSION,
    phase: 'intake',
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
      parseStatus: 'attached',
      sourceResumeText: 'existing source',
      targetJobDescription: 'existing target',
      parseError: 'temporary error',
      attachedFile: {
        mimeType: 'application/pdf',
      },
      rewriteHistory: {},
      phaseMeta: {
        analysisCompletedAt: '2026-03-25T12:00:00.000Z',
      },
    },
    generatedOutput: {
      status: 'ready',
      docxPath: 'resume.docx',
      pdfPath: 'resume.pdf',
    },
    atsScore: {
      total: 72,
      breakdown: {
        format: 15,
        structure: 15,
        keywords: 20,
        contact: 10,
        impact: 12,
      },
      issues: [],
      suggestions: [],
    },
    creditsUsed: 0,
    messageCount: 2,
    creditConsumed: true,
    createdAt: new Date('2026-03-25T12:00:00.000Z'),
    updatedAt: new Date('2026-03-25T12:00:00.000Z'),
  }
}

describe('session tool patch application', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateEq.mockResolvedValue({ error: null })
    rpc.mockResolvedValue({ data: true, error: null })
    single.mockResolvedValue({ data: null, error: null })
    limit.mockResolvedValue({ data: [], error: null })
    insertSingle.mockResolvedValue({
      data: {
        id: 'sess_new',
        user_id: 'usr_123',
        state_version: CURRENT_SESSION_STATE_VERSION,
        created_at: '2026-03-27T12:00:00.000Z',
        updated_at: '2026-03-27T12:00:00.000Z',
      },
      error: null,
    })
    messageInsert.mockResolvedValue({ error: null })
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
  })

  it('merges partial patches without erasing unrelated state', () => {
    const session = buildSession()
    const patch: ToolPatch = {
      agentState: {
        targetJobDescription: 'staff backend role',
        attachedFile: {
          receivedAt: '2026-03-27T10:00:00.000Z',
        },
        phaseMeta: {
          confirmRequestedAt: '2026-03-27T10:00:00.000Z',
        },
      },
      generatedOutput: {
        status: 'generating',
      },
    }

    const merged = mergeToolPatch(session, patch)

    expect(merged.cvState.summary).toBe('Backend engineer')
    expect(merged.stateVersion).toBe(CURRENT_SESSION_STATE_VERSION)
    expect(merged.agentState.sourceResumeText).toBe('existing source')
    expect(merged.agentState.targetJobDescription).toBe('staff backend role')
    expect(merged.agentState.attachedFile).toEqual({
      mimeType: 'application/pdf',
      receivedAt: '2026-03-27T10:00:00.000Z',
    })
    expect(merged.agentState.phaseMeta).toEqual({
      analysisCompletedAt: '2026-03-25T12:00:00.000Z',
      confirmRequestedAt: '2026-03-27T10:00:00.000Z',
    })
    expect(merged.generatedOutput).toEqual({
      status: 'generating',
      docxPath: 'resume.docx',
      pdfPath: 'resume.pdf',
    })
  })

  it('persists the merged patch and updates the in-memory session snapshot', async () => {
    const session = buildSession()

    await applyToolPatch(session, {
      agentState: {
        targetJobDescription: 'platform engineer',
        attachedFile: {
          receivedAt: '2026-03-27T11:00:00.000Z',
        },
      },
    })

    expect(update).toHaveBeenCalledTimes(1)

    const updateCalls = update.mock.calls as unknown as unknown[][]
    const persistedPayloadCandidate = updateCalls.at(0)?.[0]
    if (!persistedPayloadCandidate) {
      throw new Error('Expected update to be called once.')
    }

    const persistedPayload = persistedPayloadCandidate as unknown as {
      cv_state?: Session['cvState']
      agent_state: Session['agentState']
    }

    expect(persistedPayload.cv_state).toBeUndefined()
    expect(persistedPayload.agent_state.targetJobDescription).toBe('platform engineer')
    expect(persistedPayload.agent_state.attachedFile).toEqual({
      mimeType: 'application/pdf',
      receivedAt: '2026-03-27T11:00:00.000Z',
    })

    expect(session.cvState.summary).toBe('Backend engineer')
    expect(session.stateVersion).toBe(CURRENT_SESSION_STATE_VERSION)
    expect(session.agentState.targetJobDescription).toBe('platform engineer')
    expect(session.agentState.attachedFile).toEqual({
      mimeType: 'application/pdf',
      receivedAt: '2026-03-27T11:00:00.000Z',
    })
  })

  it('applies session patch and optional CV version in one RPC transaction', async () => {
    const session = buildSession()

    await applyToolPatchWithVersion(session, {
      cvState: {
        summary: 'Platform engineer focused on observability.',
      },
      agentState: {
        targetJobDescription: 'platform engineer',
      },
    }, 'rewrite')

    expect(rpc).toHaveBeenCalledWith('apply_session_patch_with_version', {
      p_session_id: 'sess_123',
      p_user_id: 'usr_123',
      p_phase: 'intake',
      p_cv_state: expect.objectContaining({
        summary: 'Platform engineer focused on observability.',
      }),
      p_agent_state: expect.objectContaining({
        targetJobDescription: 'platform engineer',
      }),
      p_generated_output: expect.any(Object),
      p_ats_score: expect.any(Object),
      p_version_source: 'rewrite',
    })
    expect(session.cvState.summary).toBe('Platform engineer focused on observability.')
    expect(session.agentState.targetJobDescription).toBe('platform engineer')
  })

  it('keeps the in-memory session unchanged when the transactional patch fails', async () => {
    const session = buildSession()
    const originalSession = structuredClone(session)

    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'transaction failed',
      },
    })

    await expect(applyToolPatchWithVersion(session, {
      cvState: {
        summary: 'Should not persist',
      },
    }, 'rewrite')).rejects.toThrow('Failed to apply tool patch transactionally')

    expect(session).toEqual(originalSession)
  })
})

describe('session state versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateEq.mockResolvedValue({ error: null })
    single.mockResolvedValue({ data: null, error: null })
    limit.mockResolvedValue({ data: [], error: null })
    insertSingle.mockResolvedValue({
      data: {
        id: 'sess_new',
        user_id: 'usr_123',
        state_version: CURRENT_SESSION_STATE_VERSION,
        created_at: '2026-03-27T12:00:00.000Z',
        updated_at: '2026-03-27T12:00:00.000Z',
      },
      error: null,
    })
    vi.mocked(getSupabaseAdminClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof getSupabaseAdminClient>,
    )
  })

  it('normalizes a missing stateVersion safely', () => {
    expect(normalizeStateVersion(undefined)).toBe(CURRENT_SESSION_STATE_VERSION)
    expect(normalizeStateVersion(null)).toBe(CURRENT_SESSION_STATE_VERSION)
    expect(normalizeStateVersion('1')).toBe(CURRENT_SESSION_STATE_VERSION)
  })

  it('persists stateVersion = 1 for new sessions', async () => {
    const session = await createSession('usr_123')

    expect(insert).toHaveBeenCalledWith({
      id: expect.any(String),
      created_at: expect.any(String),
      updated_at: expect.any(String),
      user_id: 'usr_123',
      state_version: CURRENT_SESSION_STATE_VERSION,
      phase: 'intake',
      cv_state: expect.any(Object),
      agent_state: expect.any(Object),
      generated_output: expect.any(Object),
      credits_used: 0,
    })
    expect(session.stateVersion).toBe(CURRENT_SESSION_STATE_VERSION)
  })

  it('generates an explicit id when appending messages', async () => {
    await appendMessage('sess_123', 'user', 'Ola')

    expect(messageInsert).toHaveBeenCalledWith({
      id: expect.any(String),
      created_at: expect.any(String),
      session_id: 'sess_123',
      role: 'user',
      content: 'Ola',
    })
  })

  it('loads existing sessions without the field and keeps state intact', async () => {
    single.mockResolvedValue({
      data: {
        id: 'sess_legacy',
        user_id: 'usr_123',
        phase: 'dialog',
        cv_state: {
          fullName: 'Ana Silva',
          email: 'ana@example.com',
          phone: '555-0100',
          summary: 'Backend engineer',
          experience: [],
          skills: ['TypeScript'],
          education: [],
        },
        agent_state: {
          parseStatus: 'parsed',
          sourceResumeText: 'legacy parsed text',
          rewriteHistory: {},
        },
        generated_output: {
          status: 'ready',
          docxPath: 'usr_123/sess_legacy/resume.docx',
          pdfPath: 'usr_123/sess_legacy/resume.pdf',
        },
        ats_score: null,
        credits_used: 0,
        message_count: 3,
        credit_consumed: true,
        created_at: '2026-03-27T12:00:00.000Z',
        updated_at: '2026-03-27T12:05:00.000Z',
      },
      error: null,
    })

    const session = await getSession('sess_legacy', 'usr_123')

    expect(session).not.toBeNull()
    expect(session?.stateVersion).toBe(CURRENT_SESSION_STATE_VERSION)
    expect(session?.cvState).toEqual({
      fullName: 'Ana Silva',
      email: 'ana@example.com',
      phone: '555-0100',
      summary: 'Backend engineer',
      experience: [],
      skills: ['TypeScript'],
      education: [],
    })
    expect(session?.agentState).toMatchObject({
      parseStatus: 'parsed',
      sourceResumeText: 'legacy parsed text',
      rewriteHistory: {},
    })
    expect(session?.generatedOutput).toEqual({
      status: 'ready',
      docxPath: 'usr_123/sess_legacy/resume.docx',
      pdfPath: 'usr_123/sess_legacy/resume.pdf',
    })
  })
})
