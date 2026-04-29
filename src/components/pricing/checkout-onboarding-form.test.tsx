import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import React from 'react'

import { CheckoutOnboardingForm } from './checkout-onboarding-form'

const { mockPush, mockNavigateToUrl, mockFetch } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockNavigateToUrl: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

vi.mock('@/lib/navigation/external', () => ({
  navigateToUrl: mockNavigateToUrl,
}))

describe('CheckoutOnboardingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', mockFetch)
  })

  it('prefills stored billing info when available', () => {
    render(
      <CheckoutOnboardingForm
        initialPlan="monthly"
        initialBillingInfo={{
          cpfCnpj: '12345678901',
          phoneNumber: '11999999999',
          postalCode: '01001000',
          address: 'Rua das Flores',
          addressNumber: '123',
          province: 'SP',
        }}
      />,
    )

    expect(screen.getByLabelText('CPF ou CNPJ')).toHaveValue('12345678901')
    expect(screen.getByLabelText('Telefone / WhatsApp')).toHaveValue('11999999999')
    expect(screen.getByLabelText('CEP')).toHaveValue('01001000')
    expect(screen.getByLabelText('Rua / Avenida')).toHaveValue('Rua das Flores')
    expect(screen.getByLabelText('Número')).toHaveValue('123')
    expect(screen.getByLabelText('Estado (UF)')).toHaveValue('SP')
    expect(screen.getByText('R$ 39,90')).toBeInTheDocument()
    expect(screen.getByText('R$ 59,90')).toBeInTheDocument()
  })

  it('submits normalized billing data to the checkout route and redirects to the returned url', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ url: 'https://sandbox.asaas.com/checkoutSession/show?id=chk_123' }),
    })
    const user = userEvent.setup()

    render(
      <CheckoutOnboardingForm
        initialPlan="unit"
        initialBillingInfo={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Mensal/ }))
    await user.type(screen.getByLabelText('CPF ou CNPJ'), '123.456.789-01')
    await user.type(screen.getByLabelText('Telefone / WhatsApp'), '+55 (11) 99999-9999')
    await user.type(screen.getByLabelText('CEP'), '08061022')
    await user.type(screen.getByLabelText('Rua / Avenida'), ' Rua das Flores ')
    await user.type(screen.getByLabelText('Número'), '123')
    await user.selectOptions(screen.getByLabelText('Estado (UF)'), 'SP')
    await user.click(screen.getByRole('button', { name: /Finalizar cadastro/i }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'monthly',
          cpfCnpj: '12345678901',
          phoneNumber: '11999999999',
          postalCode: '08061022',
          address: 'Rua das Flores',
          addressNumber: '123',
          province: 'SP',
        }),
      })
    })

    await waitFor(() => {
      expect(mockNavigateToUrl).toHaveBeenCalledWith('https://sandbox.asaas.com/checkoutSession/show?id=chk_123')
    })
  })

  it('redirects back to login with the current onboarding path when the session expires', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    })
    const user = userEvent.setup()

    render(
      <CheckoutOnboardingForm
        initialPlan="pro"
        initialBillingInfo={{
          cpfCnpj: '12345678901',
          phoneNumber: '11999999999',
          postalCode: '01001000',
          address: 'Rua das Flores',
          addressNumber: '123',
          province: 'SP',
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Finalizar cadastro/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/entrar?redirect_to=%2Ffinalizar-compra%3Fplan%3Dpro')
    })
  })
})
