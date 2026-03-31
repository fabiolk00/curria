import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import AuthLayout, { dynamic } from './layout'

const mockGetCurrentAppUser = vi.fn()
const mockGetUserBillingInfo = vi.fn()
const mockRedirect = vi.fn((path: string) => {
  throw new Error(`redirect:${path}`)
})

vi.mock('@/lib/auth/app-user', () => ({
  getCurrentAppUser: () => mockGetCurrentAppUser(),
}))

vi.mock('@/lib/asaas/quota', () => ({
  getUserBillingInfo: () => mockGetUserBillingInfo(),
}))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => mockRedirect(path),
}))

vi.mock('@/components/dashboard/dashboard-shell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-shell">{children}</div>
  ),
}))

describe('AuthLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the auth subtree force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic')
  })

  it('redirects unauthenticated users to /login', async () => {
    mockGetCurrentAppUser.mockResolvedValue(null)

    await expect(
      AuthLayout({
        children: <div>Child</div>,
      }),
    ).rejects.toThrow('redirect:/login')

    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('renders the dashboard shell for authenticated users', async () => {
    mockGetCurrentAppUser.mockResolvedValue({
      id: 'usr_123',
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    mockGetUserBillingInfo.mockResolvedValue({
      plan: 'monthly',
      creditsRemaining: 20,
      maxCredits: 20,
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })

    const jsx = await AuthLayout({
      children: <div>Child</div>,
    })

    render(jsx)

    expect(screen.getByTestId('dashboard-shell')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
  })

  it('renders the dashboard shell even when billing info lookup fails', async () => {
    mockGetCurrentAppUser.mockResolvedValue({
      id: 'usr_123',
      creditAccount: {
        id: 'cred_123',
        userId: 'usr_123',
        creditsRemaining: 20,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    mockGetUserBillingInfo.mockRejectedValue(new Error('billing unavailable'))

    const jsx = await AuthLayout({
      children: <div>Child</div>,
    })

    render(jsx)

    expect(screen.getByTestId('dashboard-shell')).toBeInTheDocument()
    expect(screen.getByText('Child')).toBeInTheDocument()
  })
})
