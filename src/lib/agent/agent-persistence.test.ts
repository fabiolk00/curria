import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  appendAssistantTurn,
  appendUserTurn,
  buildDoneChunk,
  createPatchChunk,
  persistPatch,
} from './agent-persistence'

const { mockAppendMessage, mockApplyToolPatchWithVersion } = vi.hoisted(() => ({
  mockAppendMessage: vi.fn(),
  mockApplyToolPatchWithVersion: vi.fn(),
}))

vi.mock('@/lib/db/sessions', () => ({
  appendMessage: mockAppendMessage,
  applyToolPatchWithVersion: mockApplyToolPatchWithVersion,
}))

function buildSession() {
  return {
    id: 'sess_123',
    userId: 'usr_123',
    stateVersion: 3,
    phase: 'analysis' as const,
    cvState: {
      fullName: 'Fabio',
      email: 'fabio@example.com',
      phone: '41999999999',
      summary: 'Resumo',
      experience: [],
      skills: ['SQL'],
      education: [],
    },
    agentState: {
      parseStatus: 'parsed' as const,
      rewriteHistory: {},
    },
    generatedOutput: { status: 'idle' as const },
    atsScore: { total: 82 } as any,
    creditsUsed: 1,
    messageCount: 4,
    creditConsumed: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('agent persistence helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyToolPatchWithVersion.mockImplementation(async (session, patch) => {
      if (patch?.phase) {
        session.phase = patch.phase
      }

      if (patch?.cvState) {
        session.cvState = {
          ...session.cvState,
          ...patch.cvState,
        }
      }
    })
  })

  it('appends user and assistant turns through the shared transcript seam', async () => {
    await appendUserTurn('sess_123', 'Mensagem do usuario')
    await appendAssistantTurn('sess_123', 'Mensagem do assistente')

    expect(mockAppendMessage).toHaveBeenNthCalledWith(1, 'sess_123', 'user', 'Mensagem do usuario')
    expect(mockAppendMessage).toHaveBeenNthCalledWith(2, 'sess_123', 'assistant', 'Mensagem do assistente')
  })

  it('persists patches before packaging the emitted patch chunk', async () => {
    const session = buildSession()
    const patch = await persistPatch(session, {
      phase: 'dialog',
      cvState: {
        summary: 'Resumo atualizado',
      },
    }, 'target-derived')

    const chunk = createPatchChunk(session, patch)

    expect(mockApplyToolPatchWithVersion).toHaveBeenCalledWith(
      session,
      patch,
      'target-derived',
    )
    expect(session.phase).toBe('dialog')
    expect(session.cvState.summary).toBe('Resumo atualizado')
    expect(chunk).toEqual({
      type: 'patch',
      patch,
      phase: 'dialog',
    })
  })

  it('builds done chunks from the persisted session snapshot', () => {
    const session = buildSession()

    expect(buildDoneChunk({
      requestId: 'req_123',
      session,
      isNewSession: false,
      toolIterations: 3,
      maxMessages: 30,
    })).toEqual({
      type: 'done',
      requestId: 'req_123',
      sessionId: 'sess_123',
      phase: 'analysis',
      atsScore: session.atsScore,
      messageCount: 5,
      maxMessages: 30,
      isNewSession: false,
      toolIterations: 3,
    })
  })
})
