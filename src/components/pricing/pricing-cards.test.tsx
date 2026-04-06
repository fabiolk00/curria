import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import React from 'react'

import PricingCards from './pricing-cards'

const {
  mockPush,
  mockReplace,
  mockSearchParamsGet,
} = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParamsGet: vi.fn(),
}))

let mockIsLoaded = true
let mockIsSignedIn = false

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    isLoaded: mockIsLoaded,
    isSignedIn: mockIsSignedIn,
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}))

describe('PricingCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoaded = true
    mockIsSignedIn = false
    mockSearchParamsGet.mockReturnValue(null)
  })

  it('disables checkout buttons while Clerk auth is still loading', () => {
    mockIsLoaded = false

    render(<PricingCards />)

    expect(screen.getByRole('button', { name: /Come.*grátis/i })).toBeDisabled()
    for (const button of screen.getAllByRole('button', { name: /Come.*agora/i })) {
      expect(button).toBeDisabled()
    }
  })

  it('shows job management as blocked on free and included on paid plans', () => {
    render(<PricingCards />)

    expect(screen.getAllByText('Gerenciamento de vagas')).toHaveLength(4)
    expect(screen.getAllByLabelText('Recurso incluído')).toHaveLength(3)
    expect(screen.getAllByLabelText('Recurso indisponível')).toHaveLength(1)
  })

  it('redirects signed-out users to signup when they choose the free plan', async () => {
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getByRole('button', { name: /Come.*grátis/i }))

    expect(mockPush).toHaveBeenCalledWith('/signup')
  })

  it('redirects signed-out users to signup with the selected paid plan onboarding path', async () => {
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[0])

    expect(mockPush).toHaveBeenCalledWith('/signup?redirect_to=%2Fpricing%3FcheckoutPlan%3Dunit')
  })

  it('redirects signed-in users to the intermediate checkout onboarding route', async () => {
    mockIsSignedIn = true
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[1])

    expect(mockPush).toHaveBeenCalledWith('/checkout?plan=monthly')
  })

  it('resumes checkout onboarding automatically after auth when checkoutPlan is present in the url', async () => {
    mockIsSignedIn = true
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'checkoutPlan' ? 'pro' : null
    ))

    render(<PricingCards />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/pricing')
      expect(mockPush).toHaveBeenCalledWith('/checkout?plan=pro')
    })
  })

  it('ignores unknown checkoutPlan values in the url', async () => {
    mockIsSignedIn = true
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'checkoutPlan' ? 'enterprise' : null
    ))

    render(<PricingCards />)

    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })
  })
})
