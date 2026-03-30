import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import React from 'react'

import PricingCards from './pricing-cards'

const {
  mockToastError,
  mockPush,
  mockReplace,
  mockSearchParamsGet,
  mockNavigateToUrl,
  mockFetch,
} = vi.hoisted(() => ({
  mockToastError: vi.fn(),
  mockPush: vi.fn(),
  mockReplace: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockFetch: vi.fn(),
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

vi.mock('@/lib/navigation/external', () => ({
  navigateToUrl: mockNavigateToUrl,
}))

vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
  },
}))

describe('PricingCards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsLoaded = true
    mockIsSignedIn = false
    mockSearchParamsGet.mockReturnValue(null)
    vi.stubGlobal('fetch', mockFetch)
  })

  it('disables checkout buttons while Clerk auth is still loading', () => {
    mockIsLoaded = false

    render(<PricingCards />)

    for (const button of screen.getAllByRole('button', { name: /Come.*agora/i })) {
      expect(button).toBeDisabled()
    }
  })

  it('redirects signed-out users to signup with the selected checkout plan', async () => {
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[0])

    expect(mockPush).toHaveBeenCalledWith('/signup?redirect_to=%2Fpricing%3FcheckoutPlan%3Dunit')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('redirects signed-in users to the checkout url returned by the API', async () => {
    mockIsSignedIn = true
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://sandbox.asaas.com/payment-link/test' }),
    })
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[1])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
        method: 'POST',
      }))
    })

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith('https://sandbox.asaas.com/payment-link/test')
    })
  })

  it('resumes checkout automatically after auth when checkoutPlan is present in the url', async () => {
    mockIsSignedIn = true
    mockSearchParamsGet.mockImplementation((key: string) => (
      key === 'checkoutPlan' ? 'pro' : null
    ))
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://sandbox.asaas.com/subscription/test' }),
    })

    render(<PricingCards />)

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/pricing')
    })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/checkout', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ plan: 'pro' }),
      }))
    })

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith('https://sandbox.asaas.com/subscription/test')
    })
  })

  it('retries once after a transient server error and then redirects to checkout', async () => {
    mockIsSignedIn = true
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://sandbox.asaas.com/payment-link/retry-success' }),
      })
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[0])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockNavigateToUrl).toHaveBeenCalledWith('https://sandbox.asaas.com/payment-link/retry-success')
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('redirects to login after a repeated unauthorized response', async () => {
    mockIsSignedIn = true
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      })
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[1])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockPush).toHaveBeenCalledWith('/login?redirect_to=%2Fpricing%3FcheckoutPlan%3Dmonthly')
    })

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('shows a toast when checkout keeps failing with a server error', async () => {
    mockIsSignedIn = true
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' }),
      })
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[2])

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockToastError).toHaveBeenCalledWith('Nao foi possivel iniciar o checkout. Tente novamente.')
    })

    expect(mockNavigateToUrl).not.toHaveBeenCalled()
  })

  it('shows a generic toast when the checkout API returns malformed JSON', async () => {
    mockIsSignedIn = true
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json')
        },
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('invalid json')
        },
      })
    const user = userEvent.setup()

    render(<PricingCards />)

    await user.click(screen.getAllByRole('button', { name: /Come.*agora/i })[0])

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Nao foi possivel iniciar o checkout. Tente novamente.')
    })
  })
})
