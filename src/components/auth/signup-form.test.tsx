import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import React from 'react'

import SignupForm from './signup-form'
import { buildDefaultCheckoutOnboardingPath } from '@/lib/billing/checkout-navigation'

const {
  mockCreate,
  mockPrepareEmailAddressVerification,
  mockAttemptEmailAddressVerification,
  mockSetActive,
  mockNavigateToUrl,
  mockIsSignedIn,
  mockSearchParamsGet,
  mockIsLoaded,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPrepareEmailAddressVerification: vi.fn(),
  mockAttemptEmailAddressVerification: vi.fn(),
  mockSetActive: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockIsSignedIn: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockIsLoaded: vi.fn(),
}))

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isSignedIn: mockIsSignedIn(),
  }),
  useSignUp: () => ({
    isLoaded: mockIsLoaded(),
    signUp: {
      create: mockCreate,
      prepareEmailAddressVerification: mockPrepareEmailAddressVerification,
      attemptEmailAddressVerification: mockAttemptEmailAddressVerification,
      authenticateWithRedirect: vi.fn(),
    },
    setActive: mockSetActive,
  }),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

vi.mock('@/lib/navigation/external', () => ({
  navigateToUrl: mockNavigateToUrl,
}))

vi.mock('@/components/logo', () => ({
  default: () => <div>Logo</div>,
}))

describe('SignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSignedIn.mockReturnValue(false)
    mockSearchParamsGet.mockReturnValue(null)
    mockIsLoaded.mockReturnValue(true)
    mockCreate.mockResolvedValue(undefined)
    mockPrepareEmailAddressVerification.mockResolvedValue(undefined)
    mockAttemptEmailAddressVerification.mockResolvedValue({
      status: 'complete',
      createdSessionId: 'sess_123',
    })
    mockSetActive.mockResolvedValue(undefined)
  })

  it('redirects to the requested safe path after signup verification completes', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'redirect_to' ? '/pricing?checkoutPlan=monthly' : null
    ))
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.type(screen.getByLabelText('Nome completo'), 'Test User')
    await user.type(screen.getByLabelText('E-mail'), 'test@example.com')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: /Criar conta gr[aá]tis/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled()
      expect(mockPrepareEmailAddressVerification).toHaveBeenCalled()
    })

    await user.type(screen.getByLabelText(/C.digo de verifica..o/i), '123456')
    await user.click(screen.getByRole('button', { name: /Confirmar e entrar/i }))

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_123' })
      expect(mockNavigateToUrl).toHaveBeenCalledWith('/pricing?checkoutPlan=monthly')
    })
  })

  it('redirects to the default onboarding flow when no redirect_to is provided', async () => {
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.type(screen.getByLabelText('Nome completo'), 'Test User')
    await user.type(screen.getByLabelText('E-mail'), 'test@example.com')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: /Criar conta gr[aá]tis/i }))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled()
      expect(mockPrepareEmailAddressVerification).toHaveBeenCalled()
    })

    await user.type(screen.getByLabelText(/C.digo de verifica..o/i), '123456')
    await user.click(screen.getByRole('button', { name: /Confirmar e entrar/i }))

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ session: 'sess_123' })
      expect(mockNavigateToUrl).toHaveBeenCalledWith(buildDefaultCheckoutOnboardingPath())
    })
  })

  it('redirects authenticated visitors away from signup using the requested path', async () => {
    mockIsSignedIn.mockReturnValue(true)
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'redirect_to' ? '/pricing?checkoutPlan=pro' : null
    ))

    render(<SignupForm />)

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith('/pricing?checkoutPlan=pro')
    })
  })

  it('resumes the requested path when Clerk reports an existing session during signup', async () => {
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'redirect_to' ? '/pricing?checkoutPlan=monthly' : null
    ))
    mockCreate.mockRejectedValue({
      errors: [{ code: 'session_exists', message: 'Session already exists' }],
    })
    const user = userEvent.setup()

    render(<SignupForm />)

    await user.type(screen.getByLabelText('Nome completo'), 'Test User')
    await user.type(screen.getByLabelText('E-mail'), 'test@example.com')
    await user.type(screen.getByLabelText('Senha'), 'password123')
    await user.click(screen.getByRole('button', { name: /Criar conta gr[aá]tis/i }))

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith('/pricing?checkoutPlan=monthly')
    })
  })

  it('disables signup submission and shows loading feedback while Clerk is not ready', () => {
    mockIsLoaded.mockReturnValue(false)

    render(<SignupForm />)

    expect(screen.getByRole('button', { name: /carregando/i })).toBeDisabled()
    expect(screen.getByText(/Carregando autenticação/i)).toBeInTheDocument()
  })
})
