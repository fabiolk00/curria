import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getSessionWorkspace } from '@/lib/dashboard/workspace-client'

import { useSessionCvState } from './use-session-cv-state'

vi.mock('@/lib/dashboard/workspace-client', () => ({
  getSessionWorkspace: vi.fn(),
}))

const baseCvState = {
  fullName: 'Ana Silva',
  email: 'ana@example.com',
  phone: '555-0100',
  summary: 'Base summary',
  experience: [],
  skills: ['TypeScript'],
  education: [],
}

describe('useSessionCvState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the base session cvState when targetId is absent', async () => {
    vi.mocked(getSessionWorkspace).mockResolvedValue({
      session: {
        id: 'sess_123',
        phase: 'dialog',
        stateVersion: 1,
        cvState: baseCvState,
        agentState: {
          parseStatus: 'parsed',
        },
        generatedOutput: { status: 'idle' },
        messageCount: 0,
        creditConsumed: false,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      targets: [],
    })

    const { result } = renderHook(() => useSessionCvState('sess_123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.cvState?.summary).toBe('Base summary')
    expect(result.current.error).toBeNull()
  })

  it('returns the matching target derived cvState when targetId is present', async () => {
    vi.mocked(getSessionWorkspace).mockResolvedValue({
      session: {
        id: 'sess_123',
        phase: 'dialog',
        stateVersion: 1,
        cvState: baseCvState,
        agentState: {
          parseStatus: 'parsed',
        },
        generatedOutput: { status: 'idle' },
        messageCount: 0,
        creditConsumed: false,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      targets: [
        {
          id: 'target_123',
          sessionId: 'sess_123',
          targetJobDescription: 'AWS role',
          derivedCvState: {
            ...baseCvState,
            summary: 'Target summary',
          },
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
        },
      ],
    })

    const { result } = renderHook(() => useSessionCvState('sess_123', 'target_123'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.cvState?.summary).toBe('Target summary')
    expect(result.current.error).toBeNull()
  })

  it('surfaces an error when the requested target does not exist', async () => {
    vi.mocked(getSessionWorkspace).mockResolvedValue({
      session: {
        id: 'sess_123',
        phase: 'dialog',
        stateVersion: 1,
        cvState: baseCvState,
        agentState: {
          parseStatus: 'parsed',
        },
        generatedOutput: { status: 'idle' },
        messageCount: 0,
        creditConsumed: false,
        createdAt: '2026-04-09T00:00:00.000Z',
        updatedAt: '2026-04-09T00:00:00.000Z',
      },
      targets: [],
    })

    const { result } = renderHook(() => useSessionCvState('sess_123', 'target_missing'))

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.cvState).toBeNull()
    expect(result.current.error).toBe('Target resume not found.')
  })

  it('refetches the state on demand', async () => {
    vi.mocked(getSessionWorkspace)
      .mockResolvedValueOnce({
        session: {
          id: 'sess_123',
          phase: 'dialog',
          stateVersion: 1,
          cvState: baseCvState,
          agentState: {
            parseStatus: 'parsed',
          },
          generatedOutput: { status: 'idle' },
          messageCount: 0,
          creditConsumed: false,
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
        },
        targets: [],
      })
      .mockResolvedValueOnce({
        session: {
          id: 'sess_123',
          phase: 'dialog',
          stateVersion: 1,
          cvState: {
            ...baseCvState,
            summary: 'Updated summary',
          },
          agentState: {
            parseStatus: 'parsed',
          },
          generatedOutput: { status: 'idle' },
          messageCount: 0,
          creditConsumed: false,
          createdAt: '2026-04-09T00:00:00.000Z',
          updatedAt: '2026-04-09T00:00:00.000Z',
        },
        targets: [],
      })

    const { result } = renderHook(() => useSessionCvState('sess_123'))

    await waitFor(() => {
      expect(result.current.cvState?.summary).toBe('Base summary')
    })

    await act(async () => {
      await result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.cvState?.summary).toBe('Updated summary')
    })
  })
})
