import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import DashboardPage, { dynamic, revalidate } from './page'

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/asaas/quota', () => ({
  getUserBillingInfo: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/components/dashboard/resume-workspace', () => ({
  ResumeWorkspace: ({
    initialSessionId,
    userName,
    activeRecurringPlan,
    currentCredits,
  }: {
    initialSessionId?: string
    userName?: string
    activeRecurringPlan?: string | null
    currentCredits?: number
  }) => (
    <div
      data-testid="resume-workspace"
      data-session-id={initialSessionId ?? ''}
      data-user-name={userName ?? ''}
      data-plan={activeRecurringPlan ?? ''}
      data-credits={currentCredits ?? 0}
    />
  ),
}))

describe('DashboardPage', () => {
  it('exports the dashboard as a force-dynamic page with no revalidation', () => {
    expect(dynamic).toBe('force-dynamic')
    expect(revalidate).toBe(0)
  })

  it('renders safely without a session query param', async () => {
    const jsx = await DashboardPage({})
    render(jsx)

    const workspace = screen.getByTestId('resume-workspace')
    expect(workspace).toHaveAttribute('data-session-id', '')
    expect(workspace).toHaveAttribute('data-user-name', 'Voc\u00EA')
    expect(workspace).toHaveAttribute('data-credits', '0')
  })

  it('passes through a valid-looking session id without server-side resolution', async () => {
    const jsx = await DashboardPage({
      searchParams: {
        session: 'sess_valid_123',
      },
    })
    render(jsx)

    expect(screen.getByTestId('resume-workspace')).toHaveAttribute('data-session-id', 'sess_valid_123')
  })

  it('does not crash on an invalid-looking session id', async () => {
    const jsx = await DashboardPage({
      searchParams: {
        session: 'not-a-real-session',
      },
    })
    render(jsx)

    expect(screen.getByTestId('resume-workspace')).toHaveAttribute('data-session-id', 'not-a-real-session')
  })

  it('normalizes repeated session params to the first value', async () => {
    const jsx = await DashboardPage({
      searchParams: {
        session: ['sess_first', 'sess_second'],
      },
    })
    render(jsx)

    expect(screen.getByTestId('resume-workspace')).toHaveAttribute('data-session-id', 'sess_first')
  })
})
