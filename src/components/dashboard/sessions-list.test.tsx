import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SessionsList } from './sessions-list'

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('SessionsList', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPush.mockReset()
  })

  it('renders flat API session objects sorted by createdAt descending', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        sessions: [
          { id: 'sess_old', createdAt: '2026-04-01T10:00:00.000Z' },
          { id: 'sess_new', createdAt: '2026-04-09T10:00:00.000Z' },
          { id: 'sess_mid', createdAt: '2026-04-05T10:00:00.000Z' },
        ],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    render(<SessionsList />)

    await waitFor(() => {
      expect(screen.getByText(/Sessão #sess_n/i)).toBeInTheDocument()
    })

    const sessionButtons = screen.getAllByRole('button')
    expect(sessionButtons[0]).toHaveTextContent('Sessão #sess_n')
    expect(sessionButtons[1]).toHaveTextContent('Sessão #sess_m')
    expect(sessionButtons[2]).toHaveTextContent('Sessão #sess_o')

    await userEvent.click(sessionButtons[0])
    expect(mockPush).toHaveBeenCalledWith('/dashboard/resume/compare/sess_new')
  })
})
